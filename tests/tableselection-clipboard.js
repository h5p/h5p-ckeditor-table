/**
 * @license Copyright (c) 2003-2020, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

import Paragraph from '@ckeditor/ckeditor5-paragraph/src/paragraph';
import VirtualTestEditor from '@ckeditor/ckeditor5-core/tests/_utils/virtualtesteditor';
import { setData as setModelData } from '@ckeditor/ckeditor5-engine/src/dev-utils/model';

import TableEditing from '../src/tableediting';
import TableSelection from '../src/tableselection';
import { modelTable, viewTable } from './_utils/utils';
import Clipboard from '@ckeditor/ckeditor5-clipboard/src/clipboard';
import ViewDocumentFragment from '@ckeditor/ckeditor5-engine/src/view/documentfragment';
import { stringify as stringifyView } from '@ckeditor/ckeditor5-engine/src/dev-utils/view';

describe( 'table selection', () => {
	let editor, model, modelRoot, tableSelection, viewDocument;

	beforeEach( async () => {
		editor = await VirtualTestEditor.create( {
			plugins: [ TableEditing, TableSelection, Paragraph, Clipboard ]
		} );

		model = editor.model;
		modelRoot = model.document.getRoot();
		viewDocument = editor.editing.view.document;
		tableSelection = editor.plugins.get( TableSelection );

		setModelData( model, modelTable( [
			[ '11[]', '12', '13' ],
			[ '21', '22', '23' ],
			[ '31', '32', '33' ]
		] ) );
	} );

	afterEach( async () => {
		await editor.destroy();
	} );

	describe( 'Clipboard integration', () => {
		describe( 'copy', () => {
			it( 'should to nothing for normal selection in table', () => {
				const dataTransferMock = createDataTransfer();
				const spy = sinon.spy();

				viewDocument.on( 'clipboardOutput', spy );

				viewDocument.fire( 'copy', {
					dataTransfer: dataTransferMock,
					preventDefault: sinon.spy()
				} );

				sinon.assert.calledOnce( spy );
			} );

			it( 'should copy selected table cells as standalone table', done => {
				const dataTransferMock = createDataTransfer();
				const preventDefaultSpy = sinon.spy();

				tableSelection.startSelectingFrom( modelRoot.getNodeByPath( [ 0, 0, 1 ] ) );
				tableSelection.setSelectingTo( modelRoot.getNodeByPath( [ 0, 1, 2 ] ) );

				viewDocument.on( 'clipboardOutput', ( evt, data ) => {
					expect( preventDefaultSpy.calledOnce ).to.be.true;
					expect( data.method ).to.equal( 'copy' );

					expect( data.dataTransfer ).to.equal( dataTransferMock );

					expect( data.content ).is.instanceOf( ViewDocumentFragment );
					expect( stringifyView( data.content ) ).to.equal( viewTable( [
						[ '12', '13' ],
						[ '22', '23' ]
					] ) );

					done();
				} );

				viewDocument.fire( 'copy', {
					dataTransfer: dataTransferMock,
					preventDefault: preventDefaultSpy
				} );
			} );

			it( 'should fix selected table (cell has colspan that exceeds rectangular selection by 1)', done => {
				setModelData( model, modelTable( [
					[ '11[]', '12', '13' ],
					[ '21', { contents: '22', colspan: 2 } ],
					[ '31', '32', '33' ]
				] ) );

				tableSelection.startSelectingFrom( modelRoot.getNodeByPath( [ 0, 0, 0 ] ) );
				tableSelection.setSelectingTo( modelRoot.getNodeByPath( [ 0, 2, 1 ] ) );

				viewDocument.on( 'clipboardOutput', ( evt, data ) => {
					expect( stringifyView( data.content ) ).to.equal( viewTable( [
						[ '11', '12' ],
						[ '21', '22' ],
						[ '31', '32' ]
					] ) );

					done();
				} );

				viewDocument.fire( 'copy', {
					dataTransfer: createDataTransfer(),
					preventDefault: sinon.spy()
				} );
			} );

			it( 'should fix selected table (cell has colspan that exceeds rectangular selection but spans over selection)', done => {
				setModelData( model, modelTable( [
					[ '11[]', '12', '13' ],
					[ { contents: '21', colspan: 3 } ],
					[ '31', '32', '33' ]
				] ) );

				tableSelection.startSelectingFrom( modelRoot.getNodeByPath( [ 0, 0, 0 ] ) );
				tableSelection.setSelectingTo( modelRoot.getNodeByPath( [ 0, 2, 1 ] ) );

				viewDocument.on( 'clipboardOutput', ( evt, data ) => {
					expect( stringifyView( data.content ) ).to.equal( viewTable( [
						[ '11', '12' ],
						[ { contents: '21', colspan: 2 } ],
						[ '31', '32' ]
					] ) );

					done();
				} );

				viewDocument.fire( 'copy', {
					dataTransfer: createDataTransfer(),
					preventDefault: sinon.spy()
				} );
			} );

			it( 'should fix selected table (cell has rowspan that exceeds rectangular selection by 1)', done => {
				setModelData( model, modelTable( [
					[ '11[]', '12', '13' ],
					[ '21', { contents: '22', rowspan: 2 }, '23' ],
					[ '31', '32', '33' ]
				] ) );

				tableSelection.startSelectingFrom( modelRoot.getNodeByPath( [ 0, 0, 0 ] ) );
				tableSelection.setSelectingTo( modelRoot.getNodeByPath( [ 0, 1, 2 ] ) );

				viewDocument.on( 'clipboardOutput', ( evt, data ) => {
					expect( stringifyView( data.content ) ).to.equal( viewTable( [
						[ '11', '12', '13' ],
						[ '21', '22', '23' ]
					] ) );

					done();
				} );

				viewDocument.fire( 'copy', {
					dataTransfer: createDataTransfer(),
					preventDefault: sinon.spy()
				} );
			} );

			it( 'should fix selected table (cell has rowspan that exceeds rectangular selection but spans over selection)', done => {
				setModelData( model, modelTable( [
					[ '11[]', { contents: '12', rowspan: 3 }, '13' ],
					[ '21', '23' ],
					[ '31', '33' ]
				] ) );

				tableSelection.startSelectingFrom( modelRoot.getNodeByPath( [ 0, 0, 0 ] ) );
				tableSelection.setSelectingTo( modelRoot.getNodeByPath( [ 0, 1, 1 ] ) );

				viewDocument.on( 'clipboardOutput', ( evt, data ) => {
					expect( stringifyView( data.content ) ).to.equal( viewTable( [
						[ '11', { contents: '12', rowspan: 2 }, '13' ],
						[ '21', '23' ]
					] ) );

					done();
				} );

				viewDocument.fire( 'copy', {
					dataTransfer: createDataTransfer(),
					preventDefault: sinon.spy()
				} );
			} );
		} );

		describe( 'cut', () => {
			it( 'is disabled for multi-range selection over a table', () => {
				const dataTransferMock = createDataTransfer();
				const preventDefaultSpy = sinon.spy();
				const spy = sinon.spy();

				viewDocument.on( 'clipboardOutput', spy );

				tableSelection.startSelectingFrom( modelRoot.getNodeByPath( [ 0, 0, 1 ] ) );
				tableSelection.setSelectingTo( modelRoot.getNodeByPath( [ 0, 1, 2 ] ) );

				viewDocument.fire( 'cut', {
					dataTransfer: dataTransferMock,
					preventDefault: preventDefaultSpy
				} );

				sinon.assert.notCalled( spy );
				sinon.assert.calledOnce( preventDefaultSpy );
			} );

			it( 'is not disabled normal selection over a table', () => {
				const dataTransferMock = createDataTransfer();
				const spy = sinon.spy();

				viewDocument.on( 'clipboardOutput', spy );

				viewDocument.fire( 'cut', {
					dataTransfer: dataTransferMock,
					preventDefault: sinon.spy()
				} );

				sinon.assert.calledOnce( spy );
			} );
		} );
	} );

	function createDataTransfer() {
		const store = new Map();

		return {
			setData( type, data ) {
				store.set( type, data );
			},

			getData( type ) {
				return store.get( type );
			}
		};
	}
} );
