/**
 * @license Copyright (c) 2003-2020, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module table/commands/removerowcommand
 */

import Command from '@ckeditor/ckeditor5-core/src/command';

import TableWalker from '../tablewalker';
import { findAncestor, updateNumericAttribute } from './utils';

/**
 * The remove row command.
 *
 * The command is registered by {@link module:table/tableediting~TableEditing} as `'removeTableRow'` editor command.
 *
 * To remove the row containing the selected cell, execute the command:
 *
 *		editor.execute( 'removeTableRow' );
 *
 * @extends module:core/command~Command
 */
export default class RemoveRowCommand extends Command {
	/**
	 * @inheritDoc
	 */
	refresh() {
		const model = this.editor.model;
		const doc = model.document;

		const tableCell = findAncestor( 'tableCell', doc.selection.getFirstPosition() );

		this.isEnabled = !!tableCell && tableCell.parent.parent.childCount > 1;
	}

	/**
	 * @inheritDoc
	 */
	execute() {
		const model = this.editor.model;
		const selection = model.document.selection;

		const firstPosition = selection.getFirstPosition();
		const tableCell = findAncestor( 'tableCell', firstPosition );
		const tableRow = tableCell.parent;
		const table = tableRow.parent;

		const removedRow = table.getChildIndex( tableRow );

		const tableMap = [ ...new TableWalker( table, { endRow: removedRow } ) ];

		const cellData = tableMap.find( value => value.cell === tableCell );

		const headingRows = table.getAttribute( 'headingRows' ) || 0;

		const columnToFocus = cellData.column;

		model.change( writer => {
			if ( headingRows && removedRow <= headingRows ) {
				updateNumericAttribute( 'headingRows', headingRows - 1, table, writer, 0 );
			}

			const cellsToMove = new Map();

			// Get cells from removed row that are spanned over multiple rows.
			tableMap
				.filter( ( { row, rowspan } ) => row === removedRow && rowspan > 1 )
				.forEach( ( { column, cell, rowspan } ) => cellsToMove.set( column, { cell, rowspanToSet: rowspan - 1 } ) );

			// Reduce rowspan on cells that are above removed row and overlaps removed row.
			tableMap
				.filter( ( { row, rowspan } ) => row <= removedRow - 1 && row + rowspan > removedRow )
				.forEach( ( { cell, rowspan } ) => updateNumericAttribute( 'rowspan', rowspan - 1, cell, writer ) );

			// Move cells to another row.
			const targetRow = removedRow + 1;
			const tableWalker = new TableWalker( table, { includeSpanned: true, startRow: targetRow, endRow: targetRow } );

			let previousCell;

			for ( const { row, column, cell } of [ ...tableWalker ] ) {
				if ( cellsToMove.has( column ) ) {
					const { cell: cellToMove, rowspanToSet } = cellsToMove.get( column );
					const targetPosition = previousCell ?
						writer.createPositionAfter( previousCell ) :
						writer.createPositionAt( table.getChild( row ), 0 );

					writer.move( writer.createRangeOn( cellToMove ), targetPosition );
					updateNumericAttribute( 'rowspan', rowspanToSet, cellToMove, writer );

					previousCell = cellToMove;
				} else {
					previousCell = cell;
				}
			}

			writer.remove( tableRow );

			const cellToFocus = getCellToFocus( table, removedRow, columnToFocus );
			writer.setSelection( writer.createPositionAt( cellToFocus, 0 ) );
		} );
	}
}

// Returns a cell to focus on the same column of the focused table cell before removing a row.
function getCellToFocus( table, removedRow, columnToFocus ) {
	const row = table.getChild( removedRow );

	// Default to first table cell.
	let cellToFocus = row.getChild( 0 );
	let column = 0;

	for ( const tableCell of row.getChildren() ) {
		if ( column > columnToFocus ) {
			return cellToFocus;
		}

		cellToFocus = tableCell;
		column += parseInt( tableCell.getAttribute( 'colspan' ) || 1 );
	}
}
