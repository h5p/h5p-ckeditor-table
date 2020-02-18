/**
 * @license Copyright (c) 2003-2020, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/* globals ClassicEditor, CKEditorPlugins, console, window, document */

import { CS_CONFIG } from '@ckeditor/ckeditor5-cloud-services/tests/_utils/cloud-services-config';

const COLOR_PALETTE = [
	{
		color: 'hsl(0, 0%, 0%)',
		label: 'Black'
	},
	{
		color: 'hsl(0, 0%, 30%)',
		label: 'Dim grey'
	},
	{
		color: 'hsl(0, 0%, 60%)',
		label: 'Grey'
	},
	{
		color: 'hsl(0, 0%, 90%)',
		label: 'Light grey'
	},
	{
		color: 'hsl(0, 0%, 100%)',
		label: 'White',
		hasBorder: true
	},
	{
		color: 'hsl(0, 100%, 89%)',
		label: 'Pink'
	},
	{
		color: 'hsl(0, 75%, 60%)',
		label: 'Red'
	},
	{
		color: 'hsl(60, 75%, 60%)',
		label: 'Yellow'
	},
	{
		color: 'hsl(27, 100%, 85%)',
		label: 'Light Orange'
	},
	{
		color: 'hsl(30, 75%, 60%)',
		label: 'Orange'
	},
	{
		color: 'hsl(90, 75%, 60%)',
		label: 'Light green'
	},
	{
		color: 'hsl(120, 75%, 60%)',
		label: 'Green'
	},
	{
		color: 'hsl(150, 75%, 60%)',
		label: 'Aquamarine'
	},
	{
		color: 'hsl(120, 100%, 25%)',
		label: 'Dark green'
	},
	{
		color: 'hsl(180, 75%, 60%)',
		label: 'Turquoise'
	},
	{
		color: 'hsl(180, 52%, 58%)',
		label: 'Light Aqua',
	},
	{
		color: 'hsl(180, 60%, 28%)',
		label: 'Aqua'
	},
	{
		color: 'hsl(210, 75%, 60%)',
		label: 'Light blue'
	},
	{
		color: 'hsl(240, 75%, 60%)',
		label: 'Blue'
	},
	{
		color: 'hsl(270, 75%, 60%)',
		label: 'Purple'
	}
];

ClassicEditor
	.create( document.querySelector( '#snippet-table-styling' ), {
		extraPlugins: [
			CKEditorPlugins.TableProperties,
			CKEditorPlugins.TableCellProperties,
		],
		cloudServices: CS_CONFIG,
		toolbar: {
			items: [
				'insertTable', '|', 'heading', '|', 'bold', 'italic', '|', 'undo', 'redo'
			],
			viewportTopOffset: window.getViewportTopOffsetConfig()
		},
		table: {
			contentToolbar: [ 'tableColumn', 'tableRow', 'mergeTableCells', 'tableProperties', 'tableCellProperties' ],
			tableProperties: {
				borderColors: COLOR_PALETTE,
				backgroundColors: COLOR_PALETTE
			},
			tableCellProperties: {
				borderColors: COLOR_PALETTE,
				backgroundColors: COLOR_PALETTE
			}
		}
	} )
	.then( editor => {
		window.editorStyling = editor;
	} )
	.catch( err => {
		console.error( err.stack );
	} );
