/**
 * @license Copyright (c) 2003-2021, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/* globals console, document, window, CKEditorInspector */

import ClassicEditor from '@ckeditor/ckeditor5-editor-classic/src/classiceditor';
import ArticlePluginSet from '@ckeditor/ckeditor5-core/tests/_utils/articlepluginset';
import Table from '../../src/table';
import TableToolbar from '../../src/tabletoolbar';
import TableSelection from '../../src/tableselection';
import TableClipboard from '../../src/tableclipboard';
import TableProperties from '../../src/tableproperties';
import TableCellProperties from '../../src/tablecellproperties';
import TableCaption from '../../src/tablecaption';

window.editors = {};

createEditor( '#editor', 'content' );

function createEditor( target, inspectorName ) {
	ClassicEditor
		.create( document.querySelector( target ), {
			plugins: [
				ArticlePluginSet, Table, TableToolbar, TableSelection, TableClipboard, TableProperties, TableCellProperties, TableCaption
			],
			toolbar: [
				'heading', '|',
				'insertTable', '|',
				'bold', 'italic', 'link', '|',
				'bulletedList', 'numberedList', 'blockQuote', '|',
				'undo', 'redo'
			],
			table: {
				contentToolbar: [
					'tableColumn', 'tableRow', 'mergeTableCells', 'tableProperties', 'tableCellProperties', 'toggleTableCaption'
				]
			}
		} )
		.then( editor => {
			window.editors[ inspectorName ] = editor;
			CKEditorInspector.attach( inspectorName, editor );
		} )
		.catch( err => {
			console.error( err.stack );
		} );
}
