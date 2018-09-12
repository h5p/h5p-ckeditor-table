/**
 * @license Copyright (c) 2003-2018, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import Paragraph from '@ckeditor/ckeditor5-paragraph/src/paragraph';
import VirtualTestEditor from '@ckeditor/ckeditor5-core/tests/_utils/virtualtesteditor';
import { getData as getModelData, setData as setModelData } from '@ckeditor/ckeditor5-engine/src/dev-utils/model';
import { getCode } from '@ckeditor/ckeditor5-utils/src/keyboard';
import ImageEditing from '@ckeditor/ckeditor5-image/src/image/imageediting';

import TableEditing from '../src/tableediting';
import { formatTable, formattedModelTable, modelTable } from './_utils/utils';
import InsertRowCommand from '../src/commands/insertrowcommand';
import InsertTableCommand from '../src/commands/inserttablecommand';
import InsertColumnCommand from '../src/commands/insertcolumncommand';
import RemoveRowCommand from '../src/commands/removerowcommand';
import RemoveColumnCommand from '../src/commands/removecolumncommand';
import SplitCellCommand from '../src/commands/splitcellcommand';
import MergeCellsCommand from '../src/commands/mergecellscommand';
import SetHeaderRowCommand from '../src/commands/setheaderrowcommand';
import SetHeaderColumnCommand from '../src/commands/setheadercolumncommand';
import TableSelection from '../src/tableselection';

describe( 'TableEditing', () => {
	let editor, model;

	beforeEach( () => {
		return VirtualTestEditor
			.create( {
				plugins: [ TableEditing, TableSelection, Paragraph, ImageEditing ]
			} )
			.then( newEditor => {
				editor = newEditor;

				model = editor.model;
			} );
	} );

	afterEach( () => {
		editor.destroy();
	} );

	it( 'should set proper schema rules', () => {
		// Table:
		expect( model.schema.isRegistered( 'table' ) ).to.be.true;
		expect( model.schema.isObject( 'table' ) ).to.be.true;
		expect( model.schema.isLimit( 'table' ) ).to.be.true;

		expect( model.schema.checkChild( [ '$root' ], 'table' ) ).to.be.true;
		expect( model.schema.checkAttribute( [ '$root', 'table' ], 'headingRows' ) ).to.be.true;
		expect( model.schema.checkAttribute( [ '$root', 'table' ], 'headingColumns' ) ).to.be.true;

		// Table row:
		expect( model.schema.isRegistered( 'tableRow' ) ).to.be.true;
		expect( model.schema.isLimit( 'tableRow' ) ).to.be.true;

		expect( model.schema.checkChild( [ '$root' ], 'tableRow' ) ).to.be.false;
		expect( model.schema.checkChild( [ 'table' ], 'tableRow' ) ).to.be.true;

		// Table cell:
		expect( model.schema.isRegistered( 'tableCell' ) ).to.be.true;
		expect( model.schema.isLimit( 'tableCell' ) ).to.be.true;

		expect( model.schema.checkChild( [ '$root' ], 'tableCell' ) ).to.be.false;
		expect( model.schema.checkChild( [ 'table' ], 'tableCell' ) ).to.be.false;
		expect( model.schema.checkChild( [ 'tableRow' ], 'tableCell' ) ).to.be.true;
		expect( model.schema.checkChild( [ 'tableCell' ], 'tableCell' ) ).to.be.false;

		expect( model.schema.checkAttribute( [ 'tableCell' ], 'colspan' ) ).to.be.true;
		expect( model.schema.checkAttribute( [ 'tableCell' ], 'rowspan' ) ).to.be.true;

		// Table cell contents:
		expect( model.schema.checkChild( [ '$root', 'table', 'tableRow', 'tableCell' ], '$text' ) ).to.be.false;
		expect( model.schema.checkChild( [ '$root', 'table', 'tableRow', 'tableCell' ], '$block' ) ).to.be.true;
		expect( model.schema.checkChild( [ '$root', 'table', 'tableRow', 'tableCell' ], 'table' ) ).to.be.false;
		expect( model.schema.checkChild( [ '$root', 'table', 'tableRow', 'tableCell' ], 'image' ) ).to.be.false;
	} );

	it( 'adds insertTable command', () => {
		expect( editor.commands.get( 'insertTable' ) ).to.be.instanceOf( InsertTableCommand );
	} );

	it( 'adds insertRowAbove command', () => {
		expect( editor.commands.get( 'insertTableRowAbove' ) ).to.be.instanceOf( InsertRowCommand );
	} );

	it( 'adds insertRowBelow command', () => {
		expect( editor.commands.get( 'insertTableRowBelow' ) ).to.be.instanceOf( InsertRowCommand );
	} );

	it( 'adds insertColumnBefore command', () => {
		expect( editor.commands.get( 'insertTableColumnBefore' ) ).to.be.instanceOf( InsertColumnCommand );
	} );

	it( 'adds insertColumnAfter command', () => {
		expect( editor.commands.get( 'insertTableColumnAfter' ) ).to.be.instanceOf( InsertColumnCommand );
	} );

	it( 'adds removeRow command', () => {
		expect( editor.commands.get( 'removeTableRow' ) ).to.be.instanceOf( RemoveRowCommand );
	} );

	it( 'adds removeColumn command', () => {
		expect( editor.commands.get( 'removeTableColumn' ) ).to.be.instanceOf( RemoveColumnCommand );
	} );

	it( 'adds splitCellVertically command', () => {
		expect( editor.commands.get( 'splitTableCellVertically' ) ).to.be.instanceOf( SplitCellCommand );
	} );

	it( 'adds splitCellHorizontally command', () => {
		expect( editor.commands.get( 'splitTableCellHorizontally' ) ).to.be.instanceOf( SplitCellCommand );
	} );

	it( 'adds mergeTableCells command', () => {
		expect( editor.commands.get( 'mergeTableCells' ) ).to.be.instanceOf( MergeCellsCommand );
	} );

	it( 'adds setColumnHeader command', () => {
		expect( editor.commands.get( 'setTableColumnHeader' ) ).to.be.instanceOf( SetHeaderColumnCommand );
	} );

	it( 'adds setRowHeader command', () => {
		expect( editor.commands.get( 'setTableRowHeader' ) ).to.be.instanceOf( SetHeaderRowCommand );
	} );

	describe( 'conversion in data pipeline', () => {
		describe( 'model to view', () => {
			it( 'should create tbody section', () => {
				setModelData( model, '<table><tableRow><tableCell><paragraph>foo[]</paragraph></tableCell></tableRow></table>' );

				expect( editor.getData() ).to.equal(
					'<figure class="table">' +
						'<table>' +
							'<tbody>' +
								'<tr><td>foo</td></tr>' +
							'</tbody>' +
						'</table>' +
					'</figure>'
				);
			} );

			it( 'should create thead section', () => {
				setModelData(
					model,
					'<table headingRows="1"><tableRow><tableCell><paragraph>foo[]</paragraph></tableCell></tableRow></table>'
				);

				expect( editor.getData() ).to.equal(
					'<figure class="table">' +
						'<table>' +
							'<thead>' +
								'<tr><th>foo</th></tr>' +
							'</thead>' +
						'</table>' +
					'</figure>'
				);
			} );
		} );

		describe( 'view to model', () => {
			it( 'should convert table', () => {
				editor.setData( '<table><tbody><tr><td>foo</td></tr></tbody></table>' );

				expect( getModelData( model, { withoutSelection: true } ) )
					.to.equal( '<table><tableRow><tableCell><paragraph>foo</paragraph></tableCell></tableRow></table>' );
			} );

			it( 'should convert table with image', () => {
				editor.setData( '<table><tbody><tr><td><img src="sample.png"></td></tr></tbody></table>' );

				expect( getModelData( model, { withoutSelection: true } ) )
					.to.equal( '<table><tableRow><tableCell><paragraph></paragraph></tableCell></tableRow></table>' );
			} );
		} );
	} );

	describe( 'caret movement', () => {
		let domEvtDataStub;

		beforeEach( () => {
			domEvtDataStub = {
				keyCode: getCode( 'Tab' ),
				preventDefault: sinon.spy(),
				stopPropagation: sinon.spy()
			};
		} );

		it( 'should do nothing if not tab pressed', () => {
			setModelData( model, modelTable( [
				[ '11', '12[]' ]
			] ) );

			domEvtDataStub.keyCode = getCode( 'a' );

			editor.editing.view.document.fire( 'keydown', domEvtDataStub );

			sinon.assert.notCalled( domEvtDataStub.preventDefault );
			sinon.assert.notCalled( domEvtDataStub.stopPropagation );
			expect( formatTable( getModelData( model ) ) ).to.equal( formattedModelTable( [
				[ '11', '12[]' ]
			] ) );
		} );

		it( 'should do nothing if Ctrl+Tab is pressed', () => {
			setModelData( model, modelTable( [
				[ '11', '12[]' ]
			] ) );

			domEvtDataStub.ctrlKey = true;

			editor.editing.view.document.fire( 'keydown', domEvtDataStub );

			sinon.assert.notCalled( domEvtDataStub.preventDefault );
			sinon.assert.notCalled( domEvtDataStub.stopPropagation );
			expect( formatTable( getModelData( model ) ) ).to.equal( formattedModelTable( [
				[ '11', '12[]' ]
			] ) );
		} );

		describe( 'on TAB', () => {
			it( 'should do nothing if selection is not in a table', () => {
				setModelData( model, '<paragraph>[]</paragraph>' + modelTable( [ [ '11', '12' ] ] ) );

				editor.editing.view.document.fire( 'keydown', domEvtDataStub );

				sinon.assert.notCalled( domEvtDataStub.preventDefault );
				sinon.assert.notCalled( domEvtDataStub.stopPropagation );
				expect( formatTable( getModelData( model ) ) )
					.to.equal( '<paragraph>[]</paragraph>' + formattedModelTable( [ [ '11', '12' ] ] ) );
			} );

			it( 'should move to next cell', () => {
				setModelData( model, modelTable( [
					[ '11[]', '12' ]
				] ) );

				editor.editing.view.document.fire( 'keydown', domEvtDataStub );

				sinon.assert.calledOnce( domEvtDataStub.preventDefault );
				sinon.assert.calledOnce( domEvtDataStub.stopPropagation );
				expect( formatTable( getModelData( model ) ) ).to.equal( formattedModelTable( [
					[ '11', '[12]' ]
				] ) );
			} );

			it( 'should create another row and move to first cell in new row', () => {
				setModelData( model, modelTable( [
					[ '11', '[12]' ]
				] ) );

				editor.editing.view.document.fire( 'keydown', domEvtDataStub );

				expect( formatTable( getModelData( model ) ) ).to.equal( formattedModelTable( [
					[ '11', '12' ],
					[ '[]', '' ]
				] ) );
			} );

			it( 'should move to the first cell of next row if on end of a row', () => {
				setModelData( model, modelTable( [
					[ '11', '12[]' ],
					[ '21', '22' ]
				] ) );

				editor.editing.view.document.fire( 'keydown', domEvtDataStub );

				expect( formatTable( getModelData( model ) ) ).to.equal( formattedModelTable( [
					[ '11', '12' ],
					[ '[21]', '22' ]
				] ) );
			} );

			it( 'should move to the next table cell if part of block content is selected', () => {
				setModelData( model, modelTable( [
					[ '11', '<paragraph>12</paragraph><paragraph>[foo]</paragraph><paragraph>bar</paragraph>', '13' ],
				] ) );

				editor.editing.view.document.fire( 'keydown', domEvtDataStub );

				expect( formatTable( getModelData( model ) ) ).to.equal( formattedModelTable( [
					[
						'11',
						'<paragraph>12</paragraph><paragraph>foo</paragraph><paragraph>bar</paragraph>',
						'[13]'
					],
				] ) );
			} );

			it( 'should listen with lower priority then its children', () => {
				// Cancel TAB event.
				editor.keystrokes.set( 'Tab', ( data, cancel ) => cancel() );

				setModelData( model, modelTable( [
					[ '11[]', '12' ]
				] ) );

				editor.editing.view.document.fire( 'keydown', domEvtDataStub );

				sinon.assert.calledOnce( domEvtDataStub.preventDefault );
				sinon.assert.calledOnce( domEvtDataStub.stopPropagation );

				expect( formatTable( getModelData( model ) ) ).to.equal( formattedModelTable( [
					[ '11[]', '12' ]
				] ) );
			} );

			describe( 'on table widget selected', () => {
				beforeEach( () => {
					editor.model.schema.register( 'block', {
						allowWhere: '$block',
						allowContentOf: '$block',
						isObject: true
					} );

					editor.conversion.elementToElement( { model: 'block', view: 'block' } );
				} );

				it( 'should move caret to the first table cell on TAB', () => {
					const spy = sinon.spy();

					editor.keystrokes.set( 'Tab', spy, { priority: 'lowest' } );

					setModelData( model, '[' + modelTable( [
						[ '11', '12' ]
					] ) + ']' );

					editor.editing.view.document.fire( 'keydown', domEvtDataStub );

					sinon.assert.calledOnce( domEvtDataStub.preventDefault );
					sinon.assert.calledOnce( domEvtDataStub.stopPropagation );

					expect( formatTable( getModelData( model ) ) ).to.equal( formattedModelTable( [
						[ '[11]', '12' ]
					] ) );

					// Should cancel event - so no other tab handler is called.
					sinon.assert.notCalled( spy );
				} );

				it( 'shouldn\'t do anything on other blocks', () => {
					const spy = sinon.spy();

					editor.editing.view.document.on( 'keydown', spy );

					setModelData( model, '[<block>foo</block>]' );

					editor.editing.view.document.fire( 'keydown', domEvtDataStub );

					sinon.assert.notCalled( domEvtDataStub.preventDefault );
					sinon.assert.notCalled( domEvtDataStub.stopPropagation );

					expect( formatTable( getModelData( model ) ) ).to.equal( '[<block>foo</block>]' );

					// Should not cancel event.
					sinon.assert.calledOnce( spy );
				} );
			} );
		} );

		describe( 'on SHIFT+TAB', () => {
			beforeEach( () => {
				domEvtDataStub.shiftKey = true;
			} );

			it( 'should do nothing if selection is not in a table', () => {
				setModelData( model, '<paragraph>[]</paragraph>' + modelTable( [
					[ '11', '12' ]
				] ) );

				domEvtDataStub.keyCode = getCode( 'Tab' );
				domEvtDataStub.shiftKey = true;

				editor.editing.view.document.fire( 'keydown', domEvtDataStub );

				sinon.assert.notCalled( domEvtDataStub.preventDefault );
				sinon.assert.notCalled( domEvtDataStub.stopPropagation );
				expect( formatTable( getModelData( model ) ) )
					.to.equal( '<paragraph>[]</paragraph>' + formattedModelTable( [ [ '11', '12' ] ] ) );
			} );

			it( 'should move to previous cell', () => {
				setModelData( model, modelTable( [
					[ '11', '12[]' ]
				] ) );

				editor.editing.view.document.fire( 'keydown', domEvtDataStub );

				sinon.assert.calledOnce( domEvtDataStub.preventDefault );
				sinon.assert.calledOnce( domEvtDataStub.stopPropagation );

				expect( formatTable( getModelData( model ) ) ).to.equal( formattedModelTable( [
					[ '[11]', '12' ]
				] ) );
			} );

			it( 'should not move if caret is in first table cell', () => {
				setModelData( model, '<paragraph>foo</paragraph>' + modelTable( [
					[ '[]11', '12' ]
				] ) );

				editor.editing.view.document.fire( 'keydown', domEvtDataStub );

				expect( formatTable( getModelData( model ) ) ).to.equal(
					'<paragraph>foo</paragraph>' + formattedModelTable( [ [ '[]11', '12' ] ] )
				);
			} );

			it( 'should move to the last cell of previous row if on beginning of a row', () => {
				setModelData( model, modelTable( [
					[ '11', '12' ],
					[ '[]21', '22' ]
				] ) );

				editor.editing.view.document.fire( 'keydown', domEvtDataStub );

				expect( formatTable( getModelData( model ) ) ).to.equal( formattedModelTable( [
					[ '11', '[12]' ],
					[ '21', '22' ]
				] ) );
			} );

			it( 'should move to the previous table cell if part of block content is selected', () => {
				setModelData( model, modelTable( [
					[ '11', '<paragraph>12</paragraph><paragraph>[foo]</paragraph><paragraph>bar</paragraph>', '13' ],
				] ) );

				editor.editing.view.document.fire( 'keydown', domEvtDataStub );

				expect( formatTable( getModelData( model ) ) ).to.equal( formattedModelTable( [
					[
						'[11]',
						'<paragraph>12</paragraph><paragraph>foo</paragraph><paragraph>bar</paragraph>',
						'13'
					],
				] ) );
			} );
		} );
	} );

	describe( 'enter key', () => {
		let evtDataStub, viewDocument;

		beforeEach( () => {
			evtDataStub = {
				preventDefault: sinon.spy(),
				stopPropagation: sinon.spy(),
				isSoft: false
			};

			return VirtualTestEditor
				.create( {
					plugins: [ TableEditing, TableSelection, Paragraph ]
				} )
				.then( newEditor => {
					editor = newEditor;

					sinon.stub( editor, 'execute' );

					viewDocument = editor.editing.view.document;
					model = editor.model;
				} );
		} );

		it( 'should do nothing if not in table cell', () => {
			setModelData( model, '<paragraph>[]foo</paragraph>' );

			viewDocument.fire( 'enter', evtDataStub );

			sinon.assert.notCalled( editor.execute );
			expect( formatTable( getModelData( model ) ) ).to.equal( '<paragraph>[]foo</paragraph>' );
		} );

		it( 'should do nothing if table cell has already a block content', () => {
			setModelData( model, modelTable( [
				[ '<paragraph>[]11</paragraph>' ]
			] ) );

			viewDocument.fire( 'enter', evtDataStub );

			sinon.assert.notCalled( editor.execute );
			expect( formatTable( getModelData( model ) ) ).to.equal( formattedModelTable( [
				[ '<paragraph>[]11</paragraph>' ]
			] ) );
		} );

		it( 'should do nothing if table cell with a block content is selected as a whole', () => {
			setModelData( model, modelTable( [
				[ '<paragraph>[1</paragraph><paragraph>1]</paragraph>' ]
			] ) );

			viewDocument.fire( 'enter', evtDataStub );

			sinon.assert.notCalled( editor.execute );
			setModelData( model, modelTable( [
				[ '<paragraph>[1</paragraph><paragraph>1]</paragraph>' ]
			] ) );
		} );

		it( 'should allow default behavior of Shift+Enter pressed', () => {
			setModelData( model, modelTable( [
				[ '[]11' ]
			] ) );

			evtDataStub.isSoft = true;
			viewDocument.fire( 'enter', evtDataStub );

			sinon.assert.notCalled( editor.execute );
			expect( formatTable( getModelData( model ) ) ).to.equal( formattedModelTable( [
				[ '[]11' ]
			] ) );
		} );
	} );
} );
