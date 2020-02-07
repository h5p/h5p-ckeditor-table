/**
 * @license Copyright (c) 2003-2020, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module table/tablecellproperties/commands/tablecellheightcommand
 */

import { addDefaultUnitToNumericValue } from '../../commands/utils';
import TableCellPropertyCommand from './tablecellpropertycommand';

/**
 * The table cell height command.
 *
 * The command is registered by the {@link module:table/tablecellproperties/tablecellpropertiesediting~TableCellPropertiesEditing} as
 * `'tableCellHeight'` editor command.
 *
 * To change the height of selected cells, execute the command:
 *
 *		editor.execute( 'tableCellHeight', {
 *			value: '50px'
 *		} );
 *
 * **Note**: This command adds a default `'px'` unit to a numeric values. Executing:
 *
 *		editor.execute( 'tableCellHeight', {
 *			value: '50'
 *		} );
 *
 * Will set `height` attribute to `'50px'` in the model.
 *
 * @extends module:table/tablecellproperties/commands/tablecellpropertycommand
 */
export default class TableCellHeightCommand extends TableCellPropertyCommand {
	/**
	 * Creates a new `TableCellHeightCommand` instance.
	 *
	 * @param {module:core/editor/editor~Editor} editor An editor in which this command will be used.
	 */
	constructor( editor ) {
		super( editor, 'height' );
	}

	/**
	 * @inheritDoc
	 */
	_getValueToSet( value ) {
		return addDefaultUnitToNumericValue( value, 'px' );
	}
}
