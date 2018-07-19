/**
 * @license Copyright (c) 2003-2018, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import Range from '@ckeditor/ckeditor5-engine/src/model/range';
import Paragraph from '@ckeditor/ckeditor5-paragraph/src/paragraph';
import VirtualTestEditor from '@ckeditor/ckeditor5-core/tests/_utils/virtualtesteditor';
import { getData as getModelData, parse, setData as setModelData } from '@ckeditor/ckeditor5-engine/src/dev-utils/model';

import TableEditing from '../../src/tableediting';
import { formatTable, formattedModelTable, modelTable } from './../_utils/utils';
import UndoEditing from '@ckeditor/ckeditor5-undo/src/undoediting';

describe( 'Table Post Fixer', () => {
	let editor, model, root;

	beforeEach( () => {
		return VirtualTestEditor
			.create( {
				plugins: [ TableEditing, Paragraph, UndoEditing ]
			} )
			.then( newEditor => {
				editor = newEditor;

				model = editor.model;

				root = model.document.getRoot();
			} );
	} );

	afterEach( () => {
		editor.destroy();
	} );

	describe( 'on insert table', () => {
		it( 'should add missing columns to a tableRows that are shorter then longest table row', () => {
			const parsed = parse( modelTable( [
				[ '00' ],
				[ '10', '11', '12' ],
				[ '20', '21' ]
			] ), model.schema );

			model.change( writer => {
				writer.remove( Range.createIn( root ) );
				writer.insert( parsed, root );
			} );

			expect( formatTable( getModelData( model, { withoutSelection: true } ) ) ).to.equal( formattedModelTable( [
				[ '00', '', '' ],
				[ '10', '11', '12' ],
				[ '20', '21', '' ]
			] ) );
		} );

		it( 'should add missing columns to a tableRows that are shorter then longest table row (complex 1)', () => {
			const parsed = parse( modelTable( [
				[ '00', { rowspan: 2, contents: '10' } ],
				[ '10', { colspan: 2, contents: '12' } ],
				[ '20', '21' ]
			] ), model.schema );

			model.change( writer => {
				writer.remove( Range.createIn( root ) );
				writer.insert( parsed, root );
			} );

			expect( formatTable( getModelData( model, { withoutSelection: true } ) ) ).to.equal( formattedModelTable( [
				[ '00', { rowspan: 2, contents: '10' }, '', '' ],
				[ '10', { colspan: 2, contents: '12' } ],
				[ '20', '21', '', '' ]
			] ) );
		} );

		it( 'should add missing columns to a tableRows that are shorter then longest table row (complex 2)', () => {
			const parsed = parse( modelTable( [
				[ { colspan: 6, contents: '00' } ],
				[ { rowspan: 2, contents: '10' }, '11', { colspan: 3, contents: '12' } ],
				[ '21', '22' ]
			] ), model.schema );

			model.change( writer => {
				writer.remove( Range.createIn( root ) );
				writer.insert( parsed, root );
			} );

			expect( formatTable( getModelData( model, { withoutSelection: true } ) ) ).to.equal( formattedModelTable( [
				[ { colspan: 6, contents: '00' } ],
				[ { rowspan: 2, contents: '10' }, '11', { colspan: 3, contents: '12' }, '' ],
				[ '21', '22', '', '', '' ]
			] ) );
		} );

		it( 'should fix wrong rowspan attribute on table header', () => {
			const parsed = parse( modelTable( [
				[ { rowspan: 2, contents: '00' }, { rowspan: 3, contents: '01' }, '02' ],
				[ { rowspan: 8, contents: '12' } ],
				[ '20', '21', '22' ]
			], { headingRows: 2 } ), model.schema );

			model.change( writer => {
				writer.remove( Range.createIn( root ) );
				writer.insert( parsed, root );
			} );

			expect( formatTable( getModelData( model, { withoutSelection: true } ) ) ).to.equal( formattedModelTable( [
				[ { rowspan: 2, contents: '00' }, { rowspan: 2, contents: '01' }, '02' ],
				[ '12' ],
				[ '20', '21', '22' ]
			], { headingRows: 2 } ) );
		} );

		it( 'should fix wrong rowspan attribute on table body', () => {
			const parsed = parse( modelTable( [
				[ '00', '01', '02' ],
				[ { rowspan: 2, contents: '10' }, { rowspan: 3, contents: '11' }, '12' ],
				[ { rowspan: 8, contents: '22' } ]
			], { headingRows: 1 } ), model.schema );

			model.change( writer => {
				writer.remove( Range.createIn( root ) );
				writer.insert( parsed, root );
			} );

			expect( formatTable( getModelData( model, { withoutSelection: true } ) ) ).to.equal( formattedModelTable( [
				[ '00', '01', '02' ],
				[ { rowspan: 2, contents: '10' }, { rowspan: 2, contents: '11' }, '12' ],
				[ '22' ]
			], { headingRows: 1 } ) );
		} );

		it( 'should fix multiple tables', () => {
			const tableA = modelTable( [
				[ '11' ],
				[ '21', '22' ]
			] );
			const tableB = modelTable( [
				[ 'aa' ],
				[ 'ba', 'bb' ]
			] );

			const parsed = parse( tableA + tableB, model.schema );

			model.change( writer => {
				writer.remove( Range.createIn( root ) );
				writer.insert( parsed, root );
			} );

			const expectedTableA = formattedModelTable( [
				[ '11', '' ],
				[ '21', '22' ]
			] );
			const expectedTableB = formattedModelTable( [
				[ 'aa', '' ],
				[ 'ba', 'bb' ]
			] );

			expect( formatTable( getModelData( model, { withoutSelection: true } ) ) ).to.equal( expectedTableA + expectedTableB );
		} );

		it( 'should not crash on table remove', () => {
			setModelData( model, modelTable( [
				[ '11', '12' ]
			] ) );

			expect( () => {
				model.change( writer => {
					writer.remove( Range.createIn( root ) );
				} );
			} ).to.not.throw();

			expect( getModelData( model, { withoutSelection: true } ) ).to.equal( '<paragraph></paragraph>' );
		} );
	} );

	describe( 'collaboration', () => {
		it( 'collab remove column vs insert row', () => {
			_testExternal(
				modelTable( [
					[ '00[]', '01' ],
					[ '10', '11' ]
				] ),
				writer => _removeColumn( writer, 1, [ 0, 1 ] ),
				writer => _insertRow( writer, 1, [ 'a', 'b' ] ),
				formattedModelTable( [
					[ '00', '' ],
					[ 'a', 'b' ],
					[ '10', '' ]
				] ),
				formattedModelTable( [
					[ '00', '01', '' ],
					[ 'a', 'b', '' ],
					[ '10', '11', '' ]
				] ) );
		} );

		it( 'collab insert row vs remove column', () => {
			_testExternal(
				modelTable( [
					[ '00[]', '01' ],
					[ '10', '11' ]
				] ),
				writer => _insertRow( writer, 1, [ 'a', 'b' ] ),
				writer => _removeColumn( writer, 1, [ 0, 2 ] ),
				formattedModelTable( [
					[ '00', '' ],
					[ 'a', 'b' ],
					[ '10', '' ]
				] ),
				formattedModelTable( [
					[ '00', '' ],
					[ '10', '' ]
				] ) );
		} );

		it( 'collab insert row vs insert column', () => {
			_testExternal(
				modelTable( [
					[ '00[]', '01' ],
					[ '10', '11' ]
				] ),
				writer => _insertRow( writer, 1, [ 'a', 'b' ] ),
				writer => _insertColumn( writer, 1, [ 0, 2 ] ),
				formattedModelTable( [
					[ '00', '', '01' ],
					[ 'a', 'b', '' ],
					[ '10', '', '11' ]
				] ),
				formattedModelTable( [
					[ '00', '', '01' ],
					[ '10', '', '11' ]
				] ) );
		} );

		it( 'collab insert column vs insert row', () => {
			_testExternal(
				modelTable( [
					[ '00[]', '01' ],
					[ '10', '11' ]
				] ),
				writer => _insertColumn( writer, 1, [ 0, 1 ] ),
				writer => _insertRow( writer, 1, [ 'a', 'b' ] ),
				formattedModelTable( [
					[ '00', '', '01' ],
					[ 'a', 'b', '' ],
					[ '10', '', '11' ]
				] ),
				formattedModelTable( [
					[ '00', '01', '' ],
					[ 'a', 'b', '' ],
					[ '10', '11', '' ]
				] ) );
		} );

		it( 'collab insert column vs insert column - other row has spanned cell', () => {
			_testExternal(
				modelTable( [
					[ { colspan: 3, contents: '00' } ],
					[ '10', '11', '12' ]
				] ),
				writer => {
					_setAttribute( writer, 'colspan', 4, [ 0, 0, 0 ] );
					_insertColumn( writer, 2, [ 1 ] );
				},
				writer => {
					_setAttribute( writer, 'colspan', 4, [ 0, 0, 0 ] );
					_insertColumn( writer, 1, [ 1 ] );
				},
				formattedModelTable( [
					[ { colspan: 4, contents: '00' }, '' ],
					[ '10', '', '11', '', '12' ]
				] ),
				formattedModelTable( [
					[ { colspan: 3, contents: '00' }, '' ],
					[ '10', '', '11', '12' ]
				] ) );
		} );

		it( 'collab insert column vs insert column - other row has spanned cell (inverted)', () => {
			_testExternal(
				modelTable( [
					[ { colspan: 3, contents: '00' } ],
					[ '10', '11', '12' ]
				] ),
				writer => {
					_setAttribute( writer, 'colspan', 4, [ 0, 0, 0 ] );
					_insertColumn( writer, 1, [ 1 ] );
				},
				writer => {
					_setAttribute( writer, 'colspan', 4, [ 0, 0, 0 ] );
					_insertColumn( writer, 3, [ 1 ] );
				},
				formattedModelTable( [
					[ { colspan: 4, contents: '00' }, '' ],
					[ '10', '', '11', '', '12' ]
				] ),
				formattedModelTable( [
					[ { colspan: 3, contents: '00' }, '' ],
					[ '10', '11', '', '12' ]
				] ) );
		} );

		it( 'collab change table header rows vs remove row', () => {
			_testExternal(
				modelTable( [
					[ '11', { rowspan: 2, contents: '12' }, '13' ],
					[ '21', '23' ],
					[ '31', '32', '33' ]
				] ),
				writer => {
					_setAttribute( writer, 'headingRows', 1, [ 0 ] );
					_setAttribute( writer, 'rowspan', 1, [ 0, 0, 1 ] );
					_insertCell( writer, 1, 1 );
				},
				writer => {
					_removeRow( writer, 1 );
				},
				formattedModelTable( [
					[ '11', { rowspan: 1, contents: '12' }, '13' ],
					[ '31', '32', '33' ]
				], { headingRows: 1 } ),
				formattedModelTable( [
					[ '11', { rowspan: 2, contents: '12' }, '13', '' ],
					[ '31', '32', '33' ]
				] ) );
		} );

		it( 'collab remove row vs change table header rows', () => {
			_testExternal(
				modelTable( [
					[ '11', { rowspan: 2, contents: '12' }, '13' ],
					[ '21', '23' ],
					[ '31', '32', '33' ]
				] ),
				writer => {
					_removeRow( writer, 1 );
				},
				writer => {
					_setAttribute( writer, 'headingRows', 1, [ 0 ] );
					_setAttribute( writer, 'rowspan', 1, [ 0, 0, 1 ] );
				},
				formattedModelTable( [
					[ '11', { rowspan: 1, contents: '12' }, '13', '' ],
					[ '31', '32', '33', '' ]
				], { headingRows: 1 } ),
				formattedModelTable( [
					[ '11', { rowspan: 1, contents: '12' }, '13', '' ],
					[ '21', '23', '', '' ],
					[ '31', '32', '33', '' ]
				], { headingRows: 1 } ) );
		} );

		// Case: remove same column (undo does nothing on one client - NOOP in batch).
		// Case: remove same row (undo does nothing on one client - NOOP in batch).
		// Case: Typing over user selecting - typing in marker...

		function _testExternal( initialData, localCallback, externalCallback, modelAfter, modelAfterUndo ) {
			setModelData( model, initialData );

			model.change( localCallback );

			model.enqueueChange( 'transparent', externalCallback );

			expect( formatTable( getModelData( model, { withoutSelection: true } ) ), 'after operations' ).to.equal( modelAfter );

			editor.execute( 'undo' );

			expect( formatTable( getModelData( model, { withoutSelection: true } ) ), 'after undo' ).to.equal( modelAfterUndo );

			editor.execute( 'redo' );

			expect( formatTable( getModelData( model, { withoutSelection: true } ) ), 'after redo' ).to.equal( modelAfter );
		}

		function _removeColumn( writer, columnIndex, rows ) {
			const table = root.getChild( 0 );

			for ( const index of rows ) {
				const tableRow = table.getChild( index );
				const tableCell = tableRow.getChild( columnIndex );

				writer.remove( tableCell );
			}
		}

		function _removeRow( writer, rowIndex ) {
			const table = root.getChild( 0 );
			const tableRow = table.getChild( rowIndex );

			writer.remove( tableRow );
		}

		function _insertRow( writer, rowIndex, rowData ) {
			const table = root.getChild( 0 );

			const parsedTable = parse(
				modelTable( [ rowData ] ),
				model.schema
			);

			writer.insert( parsedTable.getChild( 0 ), table, rowIndex );
		}

		function _insertCell( writer, rowIndex, index ) {
			const table = root.getChild( 0 );
			const tableRow = table.getChild( rowIndex );

			writer.insertElement( 'tableCell', tableRow, index );
		}

		function _setAttribute( writer, attributeKey, attributeValue, path ) {
			const node = root.getNodeByPath( path );

			writer.setAttribute( attributeKey, attributeValue, node );
		}

		function _insertColumn( writer, columnIndex, rows ) {
			const table = root.getChild( 0 );

			for ( const index of rows ) {
				const tableRow = table.getChild( index );
				const tableCell = writer.createElement( 'tableCell' );

				writer.insert( tableCell, tableRow, columnIndex );
			}
		}
	} );
} );
