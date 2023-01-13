/**
 * @license Copyright (c) 2003-2022, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module table/commands/insertcolumncommand
 */

import { Command, type Editor } from 'ckeditor5/src/core';

/**
 * The insert column command.
 *
 * The command is registered by {@link module:table/tableediting~TableEditing} as the `'insertTableColumnLeft'` and
 * `'insertTableColumnRight'` editor commands.
 *
 * To insert a column to the left of the selected cell, execute the following command:
 *
 *		editor.execute( 'insertTableColumnLeft' );
 *
 * To insert a column to the right of the selected cell, execute the following command:
 *
 *		editor.execute( 'insertTableColumnRight' );
 *
 * @extends module:core/command~Command
 */
export default class InsertColumnCommand extends Command {
	/**
	 * The order of insertion relative to the column in which the caret is located.
	 */
	public readonly order: string;

	/**
	 * Creates a new `InsertColumnCommand` instance.
	 *
	 * @param {module:core/editor/editor~Editor} editor An editor on which this command will be used.
	 * @param {Object} options
	 * @param {String} [options.order="right"] The order of insertion relative to the column in which the caret is located.
	 * Possible values: `"left"` and `"right"`.
	 */
	constructor( editor: Editor, options: { order?: string } = {} ) {
		super( editor );

		this.order = options.order || 'right';
	}

	/**
	 * @inheritDoc
	 */
	public override refresh(): void {
		const selection = this.editor.model.document.selection;
		const tableUtils = this.editor.plugins.get( 'TableUtils' );
		const isAnyCellSelected = !!tableUtils.getSelectionAffectedTableCells( selection ).length;

		this.isEnabled = isAnyCellSelected;
	}

	/**
	 * Executes the command.
	 *
	 * Depending on the command's {@link #order} value, it inserts a column to the `'left'` or `'right'` of the column
	 * in which the selection is set.
	 *
	 * @fires execute
	 */
	public override execute(): void {
		const editor = this.editor;
		const selection = editor.model.document.selection;
		const tableUtils = editor.plugins.get( 'TableUtils' );
		const insertBefore = this.order === 'left';

		const affectedTableCells = tableUtils.getSelectionAffectedTableCells( selection );
		const columnIndexes = tableUtils.getColumnIndexes( affectedTableCells );

		const column = insertBefore ? columnIndexes.first : columnIndexes.last;
		const table = affectedTableCells[ 0 ].findAncestor( 'table' )!;

		tableUtils.insertColumns( table, { columns: 1, at: insertBefore ? column : column + 1 } );
	}
}

declare module '@ckeditor/ckeditor5-core' {
	interface CommandsMap {
		insertColumn: InsertColumnCommand;
	}
}
