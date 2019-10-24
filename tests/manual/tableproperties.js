/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/* globals console, window, document */

import ClassicEditor from '@ckeditor/ckeditor5-editor-classic/src/classiceditor';
import ArticlePluginSet from '@ckeditor/ckeditor5-core/tests/_utils/articlepluginset';
import Alignment from '@ckeditor/ckeditor5-alignment/src/alignment';
import IndentBlock from '@ckeditor/ckeditor5-indent/src/indentblock';
import Indent from '@ckeditor/ckeditor5-indent/src/indent';
import TableProperties from '../../src/tableproperties';
import TableCellProperties from '../../src/tablecellproperties';
import TableColumnRowProperties from '../../src/tablecolumnrowproperties';
import TableStyleUI from '../../src/tablestyleui';

const sourceElement = document.querySelector( '#editor' );
const clonedSource = sourceElement.cloneNode( true );

document.querySelector( '#cloned-source' ).append( ...clonedSource.childNodes );

ClassicEditor
	.create( sourceElement, {
		plugins: [ ArticlePluginSet, Alignment, Indent, IndentBlock, TableProperties, TableColumnRowProperties, TableCellProperties,
			TableStyleUI ],
		toolbar: [
			'heading', '|', 'insertTable', '|', 'bold', 'italic', 'bulletedList', 'numberedList', 'blockQuote', 'undo', 'redo'
		],
		table: {
			contentToolbar: [ 'tableColumn', 'tableRow', 'mergeTableCells', 'tableCellStyle' ],
			tableToolbar: [ 'bold', 'italic' ]
		}
	} )
	.then( editor => {
		window.editor = editor;
	} )
	.catch( err => {
		console.error( err.stack );
	} );

