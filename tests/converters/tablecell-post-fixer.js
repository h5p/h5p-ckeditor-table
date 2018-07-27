/**
 * @license Copyright (c) 2003-2018, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import VirtualTestEditor from '@ckeditor/ckeditor5-core/tests/_utils/virtualtesteditor';
import { getData as getViewData } from '@ckeditor/ckeditor5-engine/src/dev-utils/view';
import { setData as setModelData } from '@ckeditor/ckeditor5-engine/src/dev-utils/model';

import { defaultConversion, defaultSchema, formatTable, formattedViewTable, modelTable } from '../_utils/utils';
import testUtils from '@ckeditor/ckeditor5-core/tests/_utils/utils';
import injectTableCellPostFixer from '../../src/converters/tablecell-post-fixer';

describe( 'TableCell post-fixer', () => {
	let editor, model, doc, root, viewDocument;

	testUtils.createSinonSandbox();

	beforeEach( () => {
		return VirtualTestEditor.create()
			.then( newEditor => {
				editor = newEditor;
				model = editor.model;
				doc = model.document;
				root = doc.getRoot( 'main' );
				viewDocument = editor.editing.view;

				defaultSchema( model.schema );
				defaultConversion( editor.conversion, true );

				injectTableCellPostFixer( model, editor.editing );
			} );
	} );

	it( 'should create <span> element for single paragraph inside table cell', () => {
		setModelData( model, modelTable( [ [ '00[]' ] ] ) );

		expect( formatTable( getViewData( viewDocument, { withoutSelection: true } ) ) ).to.equal( formatTable(
			'<figure class="ck-widget ck-widget_selectable table" contenteditable="false">' +
				'<div class="ck ck-widget__selection-handler"></div>' +
				'<table>' +
					'<tbody>' +
						'<tr>' +
							'<td class="ck-editor__editable ck-editor__nested-editable" contenteditable="true">' +
								'<span>00</span>' +
							'</td>' +
						'</tr>' +
					'</tbody>' +
				'</table>' +
			'</figure>'
		) );
	} );

	it( 'should rename <span> to <p> when more then one block content inside table cell', () => {
		setModelData( model, modelTable( [ [ '00[]' ] ] ) );

		const table = root.getChild( 0 );

		model.change( writer => {
			const nodeByPath = table.getNodeByPath( [ 0, 0, 0 ] );

			const paragraph = writer.createElement( 'paragraph' );

			writer.insert( paragraph, nodeByPath, 'after' );

			writer.setSelection( nodeByPath.nextSibling, 0 );
		} );

		expect( formatTable( getViewData( viewDocument, { withoutSelection: true } ) ) ).to.equal( formattedViewTable( [
			[ '<p>00</p><p></p>' ]
		], { asWidget: true } ) );
	} );

	it( 'should rename <p> to <span> when removing all but one paragraph inside table cell', () => {
		setModelData( model, modelTable( [ [ '<paragraph>00[]</paragraph><paragraph>foo</paragraph>' ] ] ) );

		const table = root.getChild( 0 );

		model.change( writer => {
			writer.remove( table.getNodeByPath( [ 0, 0, 1 ] ) );
		} );

		expect( formatTable( getViewData( viewDocument, { withoutSelection: true } ) ) ).to.equal( formattedViewTable( [
			[ '00' ]
		], { asWidget: true } ) );
	} );

	it( 'should do nothing on rename <paragraph> to <heading1> ', () => {
		setModelData( model, modelTable( [ [ '00' ] ] ) );

		const table = root.getChild( 0 );

		editor.conversion.elementToElement( { model: 'heading1', view: 'h1' } );

		model.change( writer => {
			writer.rename( table.getNodeByPath( [ 0, 0, 0 ] ), 'heading1' );
		} );

		expect( formatTable( getViewData( viewDocument, { withoutSelection: true } ) ) ).to.equal( formattedViewTable( [
			[ '<h1>00</h1>' ]
		], { asWidget: true } ) );
	} );
} );
