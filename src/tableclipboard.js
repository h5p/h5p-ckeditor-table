/**
 * @license Copyright (c) 2003-2020, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module table/tableclipboard
 */

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';

import TableSelection from './tableselection';
import TableWalker from './tablewalker';
import {
	getColumnIndexes,
	getHorizontallyOverlappingCells,
	getRowIndexes,
	getSelectionAffectedTableCells,
	getVerticallyOverlappingCells,
	isSelectionRectangular,
	splitHorizontally,
	splitVertically
} from './utils';
import { findAncestor } from './commands/utils';
import { cropTableToDimensions } from './tableselection/croptable';
import TableUtils from './tableutils';

/**
 * This plugin adds support for copying/cutting/pasting fragments of tables.
 * It is loaded automatically by the {@link module:table/table~Table} plugin.
 *
 * @extends module:core/plugin~Plugin
 */
export default class TableClipboard extends Plugin {
	/**
	 * @inheritDoc
	 */
	static get pluginName() {
		return 'TableClipboard';
	}

	/**
	 * @inheritDoc
	 */
	static get requires() {
		return [ TableSelection, TableUtils ];
	}

	/**
	 * @inheritDoc
	 */
	init() {
		const editor = this.editor;
		const viewDocument = editor.editing.view.document;

		this.listenTo( viewDocument, 'copy', ( evt, data ) => this._onCopyCut( evt, data ) );
		this.listenTo( viewDocument, 'cut', ( evt, data ) => this._onCopyCut( evt, data ) );
		this.listenTo( editor.model, 'insertContent', ( evt, args ) => this._onInsertContent( evt, ...args ), { priority: 'high' } );
	}

	/**
	 * Copies table content to a clipboard on "copy" & "cut" events.
	 *
	 * @private
	 * @param {module:utils/eventinfo~EventInfo} evt An object containing information about the handled event.
	 * @param {Object} data Clipboard event data.
	 */
	_onCopyCut( evt, data ) {
		const tableSelection = this.editor.plugins.get( TableSelection );

		if ( !tableSelection.getSelectedTableCells() ) {
			return;
		}

		if ( evt.name == 'cut' && this.editor.isReadOnly ) {
			return;
		}

		data.preventDefault();
		evt.stop();

		const dataController = this.editor.data;
		const viewDocument = this.editor.editing.view.document;

		const content = dataController.toView( tableSelection.getSelectionAsFragment() );

		viewDocument.fire( 'clipboardOutput', {
			dataTransfer: data.dataTransfer,
			content,
			method: evt.name
		} );
	}

	/**
	 * Overrides default {@link module:engine/model/model~Model#insertContent `model.insertContent()`} method to handle pasting table inside
	 * selected table fragment.
	 *
	 * Depending on selected table fragment:
	 * - If a selected table fragment is smaller than paste table it will crop pasted table to match dimensions.
	 * - If dimensions are equal it will replace selected table fragment with a pasted table contents.
	 *
	 * @private
	 * @param evt
	 * @param {module:engine/model/documentfragment~DocumentFragment|module:engine/model/item~Item} content The content to insert.
	 * @param {module:engine/model/selection~Selectable} [selectable=model.document.selection]
	 * The selection into which the content should be inserted. If not provided the current model document selection will be used.
	 */
	_onInsertContent( evt, content, selectable ) {
		if ( selectable && !selectable.is( 'documentSelection' ) ) {
			return;
		}

		const model = this.editor.model;
		const tableUtils = this.editor.plugins.get( TableUtils );

		const selectedTableCells = getSelectionAffectedTableCells( model.document.selection );

		if ( !selectedTableCells.length ) {
			return;
		}

		// We might need to crop table before inserting so reference might change.
		let pastedTable = getTableIfOnlyTableInContent( content );

		if ( !pastedTable ) {
			return;
		}

		// Override default model.insertContent() handling at this point.
		evt.stop();

		model.change( writer => {
			const columnIndexes = getColumnIndexes( selectedTableCells );
			const rowIndexes = getRowIndexes( selectedTableCells );

			let { last: lastColumnOfSelection, first: firstColumnOfSelection } = columnIndexes;
			let { first: firstRowOfSelection, last: lastRowOfSelection } = rowIndexes;

			const pasteHeight = tableUtils.getRows( pastedTable );
			const pasteWidth = tableUtils.getColumns( pastedTable );

			// Content table to which we insert a pasted table.
			const selectedTable = findAncestor( 'table', selectedTableCells[ 0 ] );

			if ( selectedTableCells.length === 1 ) {
				lastRowOfSelection += pasteHeight - 1;
				lastColumnOfSelection += pasteWidth - 1;

				expandTableSize( selectedTable, lastRowOfSelection + 1, lastColumnOfSelection + 1, writer, tableUtils );
			}

			let lastRowOfSelectionArea = lastRowOfSelection;
			let lastColumnOfSelectionArea = lastColumnOfSelection;

			// For a non- rectangular selection (ie in which some cells sticks out from a virtual selection rectangle) we need to create
			// a table layout that has a rectangular selection. This will split cells so the selection become rectangular.
			// Beyond this point we will operate on fixed content table.
			if ( !isSelectionRectangular( selectedTableCells, tableUtils ) ) {
				splitCellsToRectangularSelection( selectedTableCells, writer );
			}
			// However a rectangular selection might consist an invalid sub-table (if the selected cell would be moved outside the table).
			// This happens in a table which has:
			// - last row has empty slots (so are covered by cells from rows above) and/or
			// - last column has empty slots (are covered by cells from previous columns)
			// This case needs only adjusting the selection dimension as the rest of the algorithm operates on empty slots also.
			else {
				lastRowOfSelectionArea = adjustLastRowOfSelection( selectedTable, rowIndexes, columnIndexes );
				lastColumnOfSelectionArea = adjustLastColumnOfSelection( selectedTable, rowIndexes, columnIndexes );
			}

			const selectionHeight = lastRowOfSelectionArea - firstRowOfSelection + 1;
			const selectionWidth = lastColumnOfSelectionArea - firstColumnOfSelection + 1;

			// The if below is temporal and will be removed when handling this case.
			// This if to be removed as handling of replicating cells should be done in replaceSelectedCellsWithPasted().
			// See: https://github.com/ckeditor/ckeditor5/issues/6769.
			if ( selectionHeight > pasteHeight || selectionWidth > pasteWidth ) {
				// @if CK_DEBUG // console.log( 'NOT IMPLEMENTED YET: Pasted table is smaller than selection area.' );

				return;
			}

			// Crop pasted table if:
			// - Pasted table dimensions exceeds selection area.
			// - Pasted table has broken layout (ie some cells sticks out by the table dimensions established by the first and last row).
			//
			// Note: The table dimensions are established by the width of the first row and the total number of rows.
			// It is possible to programmatically create a table that has rows which would have cells anchored beyond first row width but
			// such table will not be created by other editing solutions.
			const cropDimensions = {
				startRow: 0,
				startColumn: 0,
				endRow: Math.min( selectionHeight - 1, pasteHeight - 1 ),
				endColumn: Math.min( selectionWidth - 1, pasteWidth - 1 )
			};

			pastedTable = cropTableToDimensions( pastedTable, cropDimensions, writer, tableUtils );

			const selectionDimensions = {
				firstColumnOfSelection,
				firstRowOfSelection,
				lastColumnOfSelection: lastColumnOfSelectionArea,
				lastRowOfSelection: lastRowOfSelectionArea,
				selectionHeight,
				selectionWidth
			};

			replaceSelectedCellsWithPasted( pastedTable, selectedTable, selectionDimensions, writer );
		} );
	}
}

// Replaces the part of selectedTable with pastedTable.
//
// @param {module:engine/model/element~Element} pastedTable
// @param {module:engine/model/element~Element} selectedTable
// @param {Object} selectionDimensions
// @param {Number} selectionDimensions.firstColumnOfSelection
// @param {Number} selectionDimensions.firstRowOfSelection
// @param {Number} selectionDimensions.lastColumnOfSelection
// @param {Number} selectionDimensions.lastRowOfSelection
// @param {Number} selectionDimensions.selectionHeight
// @param {Number} selectionDimensions.selectionWidth
// @param {module:engine/model/writer~Writer} writer
function replaceSelectedCellsWithPasted( pastedTable, selectedTable, selectionDimensions, writer ) {
	const {
		firstColumnOfSelection, lastColumnOfSelection,
		selectionWidth, selectionHeight,
		firstRowOfSelection, lastRowOfSelection
	} = selectionDimensions;

	// Holds two-dimensional array that is addressed by [ row ][ column ] that stores cells anchored at given location.
	const pastedTableLocationMap = createLocationMap( pastedTable, selectionWidth, selectionHeight );

	const selectedTableMap = [ ...new TableWalker( selectedTable, {
		startRow: firstRowOfSelection,
		endRow: lastRowOfSelection,
		includeSpanned: true
	} ) ];

	// Selection must be set to pasted cells (some might be removed or new created).
	const cellsToSelect = [];

	// Store previous cell in order to insert a new table cells after it (if required).
	let previousCellInRow;

	// Content table replace cells algorithm iterates over a selected table fragment and:
	//
	// - Removes existing table cells at current slot (location).
	// - Inserts cell from a pasted table for a matched slots.
	//
	// This ensures proper table geometry after the paste
	for ( const { row, column, cell, isSpanned } of selectedTableMap ) {
		if ( column === 0 ) {
			previousCellInRow = null;
		}

		// Could use startColumn, endColumn. See: https://github.com/ckeditor/ckeditor5/issues/6785.
		if ( column < firstColumnOfSelection || column > lastColumnOfSelection ) {
			// Only update the previousCellInRow for non-spanned slots.
			if ( !isSpanned ) {
				previousCellInRow = cell;
			}

			continue;
		}

		// If the slot is occupied by a cell in a selected table - remove it.
		// The slot of this cell will be either:
		// - Replaced by a pasted table cell.
		// - Spanned by a previously pasted table cell.
		if ( !isSpanned ) {
			writer.remove( cell );
		}

		// Map current table slot location to an pasted table slot location.
		const pastedCell = pastedTableLocationMap[ row - firstRowOfSelection ][ column - firstColumnOfSelection ];

		// There is no cell to insert (might be spanned by other cell in a pasted table) - advance to the next content table slot.
		if ( !pastedCell ) {
			continue;
		}

		// Clone cell to insert (to duplicate its attributes and children).
		// Cloning is required to support repeating pasted table content when inserting to a bigger selection.
		const cellToInsert = pastedCell._clone( true );

		let insertPosition;

		if ( !previousCellInRow ) {
			insertPosition = writer.createPositionAt( selectedTable.getChild( row ), 0 );
		} else {
			insertPosition = writer.createPositionAfter( previousCellInRow );
		}

		writer.insert( cellToInsert, insertPosition );
		cellsToSelect.push( cellToInsert );
		previousCellInRow = cellToInsert;
	}

	writer.setSelection( cellsToSelect.map( cell => writer.createRangeOn( cell ) ) );
}

// Expand table (in place) to expected size (rows and columns).
function expandTableSize( table, rows, columns, writer, tableUtils ) {
	const tableWidth = tableUtils.getColumns( table );
	const tableHeight = tableUtils.getRows( table );

	if ( columns > tableWidth ) {
		tableUtils.insertColumns( table, {
			batch: writer.batch,
			at: tableWidth,
			columns: columns - tableWidth
		} );
	}

	if ( rows > tableHeight ) {
		tableUtils.insertRows( table, {
			batch: writer.batch,
			at: tableHeight,
			rows: rows - tableHeight
		} );
	}
}

function getTableIfOnlyTableInContent( content ) {
	// Table passed directly.
	if ( content.is( 'table' ) ) {
		return content;
	}

	// We do not support mixed content when pasting table into table.
	// See: https://github.com/ckeditor/ckeditor5/issues/6817.
	if ( content.childCount != 1 || !content.getChild( 0 ).is( 'table' ) ) {
		return null;
	}

	return content.getChild( 0 );
}

// Returns two-dimensional array that is addressed by [ row ][ column ] that stores cells anchored at given location.
//
// At given row & column location it might be one of:
//
// * cell - cell from pasted table anchored at this location.
// * null - if no cell is anchored at this location.
//
// For instance, from a table below:
//
//		+----+----+----+----+
//		| 00 | 01 | 02 | 03 |
//		+    +----+----+----+
//		|    | 11      | 13 |
//		+----+         +----+
//		| 20 |         | 23 |
//		+----+----+----+----+
//
// The method will return an array (numbers represents cell element):
//
//	const map = [
//		[ '00', '01', '02', '03' ],
//		[ null, '11', null, '13' ],
//		[ '20', null, null, '23' ]
//	]
//
// This allows for a quick access to table at give row & column. For instance to access table cell "13" from pasted table call:
//
//		const cell = map[ 1 ][ 3 ]
//
function createLocationMap( table, width, height ) {
	// Create height x width (row x column) two-dimensional table to store cells.
	const map = new Array( height ).fill( null )
		.map( () => new Array( width ).fill( null ) );

	for ( const { column, row, cell } of new TableWalker( table ) ) {
		map[ row ][ column ] = cell;
	}

	return map;
}

// Make selected cells rectangular by splitting the cells that stand out from a rectangular selection.
//
// In the table below a selection is shown with "::" and slots with anchor cells are named.
//
// +----+----+----+----+----+                    +----+----+----+----+----+
// | 00 | 01 | 02 | 03      |                    | 00 | 01 | 02 | 03      |
// +    +----+    +----+----+                    |    ::::::::::::::::----+
// |    | 11 |    | 13 | 14 |                    |    ::11 |    | 13:: 14 |    <- first row
// +----+----+    +    +----+                    +----::---|    |   ::----+
// | 20 | 21 |    |    | 24 |   select cells:    | 20 ::21 |    |   :: 24 |
// +----+----+    +----+----+     11 -> 33       +----::---|    |---::----+
// | 30      |    | 33 | 34 |                    | 30 ::   |    | 33:: 34 |    <- last row
// +         +    +----+    +                    |    ::::::::::::::::    +
// |         |    | 43 |    |                    |         |    | 43 |    |
// +----+----+----+----+----+                    +----+----+----+----+----+
//                                                      ^          ^
//                                                     first & last columns
//
// Will update table to:
//
//                       +----+----+----+----+----+
//                       | 00 | 01 | 02 | 03      |
//                       +    +----+----+----+----+
//                       |    | 11 |    | 13 | 14 |
//                       +----+----+    +    +----+
//                       | 20 | 21 |    |    | 24 |
//                       +----+----+    +----+----+
//                       | 30 |    |    | 33 | 34 |
//                       +    +----+----+----+    +
//                       |    |    |    | 43 |    |
//                       +----+----+----+----+----+
//
// In th example above:
// - Cell "02" which have `rowspan = 4` must be trimmed at first and at after last row.
// - Cell "03" which have `rowspan = 2` and `colspan = 2` must be trimmed at first column and after last row.
// - Cells "00", "03" & "30" which cannot be cut by this algorithm as they are outside the trimmed area.
// - Cell "13" cannot be cut as it is inside the trimmed area.
function splitCellsToRectangularSelection( selectedTableCells, writer ) {
	const table = findAncestor( 'table', selectedTableCells[ 0 ] );

	const rowIndexes = getRowIndexes( selectedTableCells );
	const columnIndexes = getColumnIndexes( selectedTableCells );
	const { first: firstRow, last: lastRow } = rowIndexes;
	const { first: firstColumn, last: lastColumn } = columnIndexes;

	// 1. Split cells vertically in two steps as first step might create cells that needs to split again.
	doVerticalSplit( table, firstColumn, rowIndexes, writer );
	doVerticalSplit( table, lastColumn + 1, rowIndexes, writer );

	// 2. Split cells horizontally in two steps as first step might create cells that needs to split again.
	doHorizontalSplit( table, firstRow, columnIndexes, writer );
	doHorizontalSplit( table, lastRow + 1, columnIndexes, writer, firstRow );
}

function doHorizontalSplit( table, splitRow, limitColumns, writer, startRow = 0 ) {
	// If selection starts at first row then no split is needed.
	if ( splitRow < 1 ) {
		return;
	}

	const overlappingCells = getHorizontallyOverlappingCells( table, splitRow, startRow );

	// Filter out cells that are not touching insides of the rectangular selection.
	const { first, last } = limitColumns;
	const cellsToSplit = overlappingCells.filter( ( { column, colspan } ) => isAffectedBySelection( column, colspan, first, last ) );

	for ( const { cell } of cellsToSplit ) {
		splitHorizontally( cell, splitRow, writer );
	}
}

function doVerticalSplit( table, splitColumn, limitRows, writer ) {
	// If selection starts at first column then no split is needed.
	if ( splitColumn < 1 ) {
		return;
	}

	const overlappingCells = getVerticallyOverlappingCells( table, splitColumn );

	// Filter out cells that are not touching insides of the rectangular selection.
	const { first, last } = limitRows;
	const cellsToSplit = overlappingCells.filter( ( { row, rowspan } ) => isAffectedBySelection( row, rowspan, first, last ) );

	for ( const { cell, column } of cellsToSplit ) {
		splitVertically( cell, column, splitColumn, writer );
	}
}

// Checks if cell at given row (column) is affected by a rectangular selection defined by first/last column (row).
//
// The same check is used for row as for column.
function isAffectedBySelection( rowOrColumn, rowOrColumnSpan, first, last ) {
	const endIndexOfCell = rowOrColumn + rowOrColumnSpan - 1;

	const isInsideSelection = rowOrColumn >= first && rowOrColumn <= last;
	const overlapsSelectionFromOutside = rowOrColumn < first && endIndexOfCell >= first;

	return isInsideSelection || overlapsSelectionFromOutside;
}

// Returns adjusted last row index if selection covers part of a row with empty slots (spanned by other cells).
function adjustLastRowOfSelection( selectedTable, rowIndexes, columnIndexes ) {
	const lastRowMap = Array.from( new TableWalker( selectedTable, {
		startRow: rowIndexes.last,
		endRow: rowIndexes.last
	} ) ).filter( ( { column } ) => {
		// Could use startColumn, endColumn. See: https://github.com/ckeditor/ckeditor5/issues/6785.
		return columnIndexes.first <= column && column <= columnIndexes.last;
	} );

	const everyCellHasSingleRowspan = lastRowMap.every( ( { rowspan } ) => rowspan === 1 );

	if ( !everyCellHasSingleRowspan ) {
		const rowspanAdjustment = lastRowMap.pop().rowspan - 1;
		return rowIndexes.last + rowspanAdjustment;
	}

	// Default to the last row index.
	return rowIndexes.last;
}

// Returns adjusted last column index if selection covers part of a column with empty slots (spanned by other cells).
function adjustLastColumnOfSelection( selectedTable, rowIndexes, columnIndexes ) {
	const lastColumnMap = Array.from( new TableWalker( selectedTable, {
		startRow: rowIndexes.first,
		endRow: rowIndexes.last,
		column: columnIndexes.last
	} ) );

	const everyCellHasSingleColspan = lastColumnMap.every( ( { colspan } ) => colspan === 1 );

	if ( !everyCellHasSingleColspan ) {
		const colspanAdjustment = lastColumnMap.pop().colspan - 1;
		return columnIndexes.last + colspanAdjustment;
	}

	// Default to the last column index.
	return columnIndexes.last;
}
