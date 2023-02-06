/**
 * @license Copyright (c) 2003-2023, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module table/tablecolumnresize/converters
 */

import { normalizeColumnWidths, updateColumnElements } from './utils';

/**
 * TODO
 * Returns a helper for converting a view `<colgroup>` and `<col>` elements to the model table `columnWidths` attribute.
 *
 * Only the inline width, provided as a percentage value, in the `<col>` element is taken into account. If there are not enough `<col>`
 * elements matching this condition, the special value `auto` is returned. It indicates that the width of a column will be automatically
 * calculated in the
 * {@link module:table/tablecolumnresize/tablecolumnresizeediting~TableColumnResizeEditing#_registerPostFixer post-fixer}, depending
 * on the available table space.
 *
 * @param {module:core/plugin~Plugin} tableUtilsPlugin The {@link module:table/tableutils~TableUtils} plugin instance.
 * @returns {Function} Conversion helper.
 */
export function upcastColgroupElement( tableUtilsPlugin ) {
	return dispatcher => dispatcher.on( 'element:colgroup', ( evt, data, conversionApi ) => {
		const modelTable = data.modelCursor.findAncestor( 'table' );
		const tableColumnGroup = tableUtilsPlugin.getColumnGroupElement( modelTable );

		if ( !tableColumnGroup ) {
			return;
		}

		const columnElements = tableUtilsPlugin.getTableColumnElements( tableColumnGroup );
		const columnsCount = tableUtilsPlugin.getColumns( modelTable );
		let columnWidths = tableUtilsPlugin.getTableColumnsWidths( tableColumnGroup );

		columnWidths = Array.from( { length: columnsCount }, ( _, index ) => columnWidths[ index ] || 'auto' );

		if ( columnWidths.length != columnElements.length || columnWidths.includes( 'auto' ) ) {
			updateColumnElements( columnElements, tableColumnGroup, normalizeColumnWidths( columnWidths ), conversionApi.writer );
		}
	}, { priority: 'low' } );
}

/**
 * Returns downcast helper for adding `ck-table-resized` class if there is a `<tableColumnGroup>` element inside the table
 *
 * @returns {Function} Conversion helper.
 */
export function downcastTableResizedClass() {
	return dispatcher => dispatcher.on( 'insert:table', ( evt, data, conversionApi ) => {
		const viewWriter = conversionApi.writer;
		const modelTable = data.item;
		const viewElement = conversionApi.mapper.toViewElement( modelTable );

		const viewTable = viewElement.is( 'element', 'table' ) ?
			viewElement :
			Array.from( viewElement.getChildren() ).find( viewChild => viewChild.is( 'element', 'table' ) );

		const tableColumnGroup = Array
			.from( data.item.getChildren() )
			.find( element => element.is( 'element', 'tableColumnGroup' ) );

		if ( tableColumnGroup ) {
			viewWriter.addClass( 'ck-table-resized', viewTable );
		} else {
			viewWriter.removeClass( 'ck-table-resized', viewTable );
		}
	}, { priority: 'low' } );
}
