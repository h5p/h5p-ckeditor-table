/**
 * @license Copyright (c) 2003-2020, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module table/tableselection
 */

/* global setTimeout */

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';

import TableWalker from './tablewalker';
import TableUtils from './tableutils';
import { getTableCellsInSelection, clearTableCellsContents } from './tableselection/utils';
import { findAncestor } from './commands/utils';

import '../theme/tableselection.css';

/**
 * TODO
 *
 * @extends module:core/plugin~Plugin
 */
export default class TableSelection extends Plugin {
	/**
	 * @inheritDoc
	 */
	static get pluginName() {
		return 'TableSelection';
	}

	/**
	 * @inheritDoc
	 */
	static get requires() {
		return [ TableUtils ];
	}

	/**
	 * @inheritDoc
	 */
	init() {
		const editor = this.editor;
		const model = editor.model;

		this.listenTo( model, 'deleteContent', ( evt, args ) => this._handleDeleteContent( evt, args ), { priority: 'high' } );

		this._defineConverters();
		this._enableShiftClickSelection();
	}

	getSelectedTableCells() {
		const selection = this.editor.model.document.selection;

		const selectedCells = getTableCellsInSelection( selection );

		if ( selectedCells.length == 0 ) {
			return null;
		}

		// @if CK_DEBUG //	if ( selectedCells.length != selection.rangeCount ) {
		// @if CK_DEBUG //		console.warn( 'Mixed selection warning. The selection contains table cells and some other ranges.' );
		// @if CK_DEBUG //	}

		return selectedCells;
	}

	_defineConverters() {
		const editor = this.editor;
		const highlighted = new Set();

		editor.conversion.for( 'editingDowncast' ).add( dispatcher => dispatcher.on( 'selection', ( evt, data, conversionApi ) => {
			const viewWriter = conversionApi.writer;
			// const viewSelection = viewWriter.document.selection;

			clearHighlightedTableCells( viewWriter );

			const selectedCells = this.getSelectedTableCells();

			if ( !selectedCells ) {
				return;
			}

			for ( const tableCell of selectedCells ) {
				const viewElement = conversionApi.mapper.toViewElement( tableCell );

				viewWriter.addClass( 'ck-editor__editable_selected', viewElement );
				highlighted.add( viewElement );
			}

			const lastViewCell = conversionApi.mapper.toViewElement( selectedCells[ selectedCells.length - 1 ] );
			viewWriter.setSelection( lastViewCell, 0 );
		}, { priority: 'lowest' } ) );

		function clearHighlightedTableCells( writer ) {
			for ( const previouslyHighlighted of highlighted ) {
				writer.removeClass( 'ck-editor__editable_selected', previouslyHighlighted );
			}

			highlighted.clear();
		}
	}

	_enableShiftClickSelection() {
		const editor = this.editor;
		const model = editor.model;
		let blockNextSelectionChange = false;

		this.listenTo( editor.editing.view.document, 'mousedown', ( evt, domEventData ) => {
			if ( !domEventData.domEvent.shiftKey ) {
				return;
			}

			const anchorCell = findAncestor( 'tableCell', model.document.selection.anchor.parent );

			if ( !anchorCell ) {
				return;
			}

			const targetCell = this._getModelTableCellFromDomEvent( domEventData );

			if ( !targetCell ) {
				return;
			}

			const cellsToSelect = this._getCellsBetweenAnchorAndTarget( anchorCell, targetCell );

			model.change( writer => {
				blockNextSelectionChange = true;
				writer.setSelection( cellsToSelect.map( cell => writer.createRangeOn( cell ) ) );
			} );

			domEventData.preventDefault();

			setTimeout( () => {
				blockNextSelectionChange = false;
			}, 0 );
		} );

		// We need to ignore a `selectionChange` event that is fired after we render our new table cells selection.
		// When downcasting table cells selection to the view, we put the view selection in the last selected cell
		// in a place that may not be natively a "correct" location. This is – we put it directly in the `<td>` element.
		// All browsers fire the native `selectionchange` event.
		// However, all browsers except Safari return the selection in the exact place where we put it
		// (even though it's visually normalized). Safari returns `<td><p>^foo` that makes our selection observer
		// fire our `selectionChange` event (because the view selection that we set in the first step differs from the DOM selection).
		// Since `selectionChange` is fired, we automatically update the model selection that moves it that paragraph.
		// This breaks our dear cells selection.
		//
		// Theoretically this issue concerns only Safari that is the only browser that do normalize the selection.
		// However, to avoid code branching and to have a good coverage for this event blocker, I
		this.listenTo( editor.editing.view.document, 'selectionChange', evt => {
			if ( blockNextSelectionChange ) {
				// @if CK_DEBUG // console.log( 'Blocked selectionChange.' );

				evt.stop();
			}
		}, { priority: 'highest' } );
	}

	/**
	 * It overrides default `model.deleteContent()` behavior over a selected table fragment.
	 *
	 * @private
	 * @param {module:utils/eventinfo~EventInfo} event
	 * @param {Array.<*>} args Delete content method arguments.
	 */
	_handleDeleteContent( event, args ) {
		const [ selection, options ] = args;
		const model = this.editor.model;
		const isBackward = !options || options.direction == 'backward';
		const selectedTableCells = getTableCellsInSelection( selection );

		if ( !selectedTableCells.length ) {
			return;
		}

		event.stop();

		model.change( writer => {
			const tableCellToSelect = selectedTableCells[ isBackward ? selectedTableCells.length - 1 : 0 ];

			clearTableCellsContents( model, selectedTableCells );

			// The insertContent() helper passes the actual DocumentSelection,
			// while the deleteContent() helper always operates on the abstract clones.
			if ( selection.is( 'documentSelection' ) ) {
				writer.setSelection( tableCellToSelect, 'in' );
			} else {
				selection.setTo( tableCellToSelect, 'in' );
			}
		} );
	}

	_getModelTableCellFromDomEvent( domEventData ) {
		const viewTargetElement = domEventData.target;
		const modelElement = this.editor.editing.mapper.toModelElement( viewTargetElement );

		if ( !modelElement ) {
			return;
		}

		if ( modelElement.is( 'tableCell' ) ) {
			return modelElement;
		}

		return findAncestor( 'tableCell', modelElement );
	}

	/**
	 * TODO
	 *
	 * @returns {Array.<module:engine/model/element~Element>}
	 */
	_getCellsBetweenAnchorAndTarget( anchorCell, targetCell ) {
		const tableUtils = this.editor.plugins.get( 'TableUtils' );
		const startLocation = tableUtils.getCellLocation( anchorCell );
		const endLocation = tableUtils.getCellLocation( targetCell );

		const startRow = Math.min( startLocation.row, endLocation.row );
		const endRow = Math.max( startLocation.row, endLocation.row );

		const startColumn = Math.min( startLocation.column, endLocation.column );
		const endColumn = Math.max( startLocation.column, endLocation.column );

		const cells = [];

		for ( const cellInfo of new TableWalker( findAncestor( 'table', anchorCell ), { startRow, endRow } ) ) {
			if ( cellInfo.column >= startColumn && cellInfo.column <= endColumn ) {
				cells.push( cellInfo.cell );
			}
		}

		if ( checkIsBackward( startLocation, endLocation ) ) {
			cells.reverse();
		}

		return cells;
	}
}

function checkIsBackward( startLocation, endLocation ) {
	if ( startLocation.row > endLocation.row ) {
		return true;
	}

	if ( startLocation.row == endLocation.row && startLocation.column > endLocation.column ) {
		return true;
	}

	return false;
}

