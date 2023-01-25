/**
 * @license Copyright (c) 2003-2023, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module table/tablecellproperties/commands/tablecellborderstylecommand
 */

import type { Editor } from 'ckeditor5/src/core';
import type { Element } from 'ckeditor5/src/engine';

import TableCellPropertyCommand from './tablecellpropertycommand';
import { getSingleValue } from '../../utils/table-properties';

/**
 * The table cell border style command.
 *
 * The command is registered by the {@link module:table/tablecellproperties/tablecellpropertiesediting~TableCellPropertiesEditing} as
 * the `'tableCellBorderStyle'` editor command.
 *
 * To change the border style of selected cells, execute the command:
 *
 *		editor.execute( 'tableCellBorderStyle', {
 *			value: 'dashed'
 *		} );
 *
 * @extends module:table/tablecellproperties/commands/tablecellpropertycommand~TableCellPropertyCommand
 */
export default class TableCellBorderStyleCommand extends TableCellPropertyCommand {
	/**
	 * Creates a new `TableCellBorderStyleCommand` instance.
	 *
	 * @param {module:core/editor/editor~Editor} editor An editor in which this command will be used.
	 * @param {String} defaultValue The default value of the attribute.
	 */
	constructor( editor: Editor, defaultValue: string ) {
		super( editor, 'tableCellBorderStyle', defaultValue );
	}

	/**
	 * @inheritDoc
	 */
	public override _getAttribute( tableCell: Element ): string | undefined {
		if ( !tableCell ) {
			return;
		}

		const value = getSingleValue( tableCell.getAttribute( this.attributeName ) as string );

		if ( value === this._defaultValue ) {
			return;
		}

		return value;
	}
}

declare module '@ckeditor/ckeditor5-core' {
	interface CommandsMap {
		tableCellBorderStyle: TableCellBorderStyleCommand;
	}
}
