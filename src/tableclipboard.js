/**
 * @license Copyright (c) 2003-2020, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module table/tableclipboard
 */

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import TableSelection from './tableselection';
import { getColumnIndexes, getRowIndexes } from './utils';
import TableWalker from './tablewalker';
import { findAncestor } from './commands/utils';

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
		return [ TableSelection ];
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
		const tableSelection = this.editor.plugins.get( 'TableSelection' );

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
	 * Handles...
	 *
	 * @private
	 * @param evt
	 * @param {module:engine/model/documentfragment~DocumentFragment|module:engine/model/item~Item} content The content to insert.
	 * @param {module:engine/model/selection~Selectable} [selectable=model.document.selection]
	 * The selection into which the content should be inserted. If not provided the current model document selection will be used.
	 * @param {Number|'before'|'end'|'after'|'on'|'in'} [placeOrOffset] To be used when a model item was passed as `selectable`.
	 * This param defines a position in relation to that item.
	 */
	_onInsertContent( evt, content ) {
		if ( this.editor.isReadOnly ) {
			return;
		}

		const tableSelection = this.editor.plugins.get( 'TableSelection' );
		const selectedTableCells = tableSelection.getSelectedTableCells();

		if ( !selectedTableCells ) {
			return;
		}

		const table = getTable( content );

		if ( table ) {
			evt.stop();

			if ( selectedTableCells.length === 1 ) {
				// @if CK_DEBUG // console.log( 'Single table cell is selected. Not handled.' );

				return;
			}

			const tableUtils = this.editor.plugins.get( 'TableUtils' );

			const rowIndexes = getRowIndexes( selectedTableCells );
			const columnIndexes = getColumnIndexes( selectedTableCells );
			const selectionHeight = rowIndexes.last - rowIndexes.first + 1;
			const selectionWidth = columnIndexes.last - columnIndexes.first + 1;
			const insertHeight = tableUtils.getRows( table );
			const insertWidth = tableUtils.getColumns( table );

			const contentTable = findAncestor( 'table', selectedTableCells[ 0 ] );

			if ( selectionHeight === insertHeight && selectionWidth === insertWidth ) {
				const model = this.editor.model;

				model.change( writer => {
					const insertionMap = new Map();

					for ( const { column, row, cell } of new TableWalker( table ) ) {
						insertionMap.set( `${ row }x${ column }`, cell );
					}

					for ( const { column, row, cell } of new TableWalker( contentTable, {
						startRow: rowIndexes.first,
						endRow: rowIndexes.last
					} ) ) {
						if ( column < columnIndexes.first || column > columnIndexes.last ) {
							continue;
						}

						const toGet = `${ row - rowIndexes.first }x${ column - columnIndexes.first }`;

						const cellToInsert = insertionMap.get( toGet );
						writer.remove( writer.createRangeIn( cell ) );

						for ( const child of cellToInsert.getChildren() ) {
							writer.insert( child, cell, 'end' );
						}
					}
				} );

				return;
			}

			if ( selectionHeight > insertHeight || selectionWidth > insertWidth ) {
				// @if CK_DEBUG // console.log( 'Pasted table extends selection area.' );
			} else {
				// @if CK_DEBUG // console.log( 'Pasted table is smaller than selection area.' );
			}
		}
	}
}

function getTable( content ) {
	for ( const child of Array.from( content ) ) {
		if ( child.is( 'table' ) ) {
			return child;
		}
	}

	return null;
}
