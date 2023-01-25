/**
 * @license Copyright (c) 2003-2023, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module table/commands/insertrowcommand
 */

import { Command, type Editor } from 'ckeditor5/src/core';

/**
 * The insert row command.
 *
 * The command is registered by {@link module:table/tableediting~TableEditing} as the `'insertTableRowBelow'` and
 * `'insertTableRowAbove'` editor commands.
 *
 * To insert a row below the selected cell, execute the following command:
 *
 *		editor.execute( 'insertTableRowBelow' );
 *
 * To insert a row above the selected cell, execute the following command:
 *
 *		editor.execute( 'insertTableRowAbove' );
 *
 * @extends module:core/command~Command
 */
export default class InsertRowCommand extends Command {
	/**
	 * The order of insertion relative to the row in which the caret is located.
	 */
	public readonly order: string;

	/**
	 * Creates a new `InsertRowCommand` instance.
	 *
	 * @param editor The editor on which this command will be used.
	 * @param options.order The order of insertion relative to the row in which the caret is located.
	 * Possible values: `"above"` and `"below"`. Default value is "below"
	 */
	constructor( editor: Editor, options: { order?: string } = {} ) {
		super( editor );

		this.order = options.order || 'below';
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
	 * Depending on the command's {@link #order} value, it inserts a row `'below'` or `'above'` the row in which selection is set.
	 *
	 * @fires execute
	 */
	public override execute(): void {
		const editor = this.editor;
		const selection = editor.model.document.selection;
		const tableUtils = editor.plugins.get( 'TableUtils' );
		const insertAbove = this.order === 'above';

		const affectedTableCells = tableUtils.getSelectionAffectedTableCells( selection );
		const rowIndexes = tableUtils.getRowIndexes( affectedTableCells );

		const row = insertAbove ? rowIndexes.first : rowIndexes.last;
		const table = affectedTableCells[ 0 ].findAncestor( 'table' )!;

		tableUtils.insertRows( table, { at: insertAbove ? row : row + 1, copyStructureFromAbove: !insertAbove } );
	}
}

declare module '@ckeditor/ckeditor5-core' {
	interface CommandsMap {
		insertRow: InsertRowCommand;
	}
}
