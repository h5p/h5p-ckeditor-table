/**
 * @license Copyright (c) 2003-2022, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/* global document */

import TableColumnResizeEditing from '../../src/tablecolumnresize/tablecolumnresizeediting';
import TableColumnResize from '../../src/tablecolumnresize';
import TableCaption from '../../src/tablecaption';
import TableToolbar from '../../src/tabletoolbar';
import Table from '../../src/table';
import TableProperties from '../../src/tableproperties';

// ClassicTestEditor can't be used, as it doesn't handle the focus, which is needed to test resizer visual cues.
import ClassicEditor from '@ckeditor/ckeditor5-editor-classic/src/classiceditor';
import { getData as getModelData, setData as setModelData } from '@ckeditor/ckeditor5-engine/src/dev-utils/model';
import Bold from '@ckeditor/ckeditor5-basic-styles/src/bold';
import LinkEditing from '@ckeditor/ckeditor5-link/src/linkediting';
import HighlightEditing from '@ckeditor/ckeditor5-highlight/src/highlightediting';
import GeneralHtmlSupport from '@ckeditor/ckeditor5-html-support/src/generalhtmlsupport';

import { focusEditor } from '@ckeditor/ckeditor5-widget/tests/widgetresize/_utils/utils';
import { modelTable } from '../_utils/utils';
import {
	getDomTable,
	getModelTable,
	getViewTable,
	getColumnWidth,
	getViewColumnWidthsPx,
	getModelColumnWidthsPc,
	getViewColumnWidthsPc,
	getDomTableRects,
	getDomTableCellRects,
	tableColumnResizeMouseSimulator,
	getDomResizer
} from './_utils/utils';
import {
	COLUMN_MIN_WIDTH_IN_PIXELS
} from '../../src/tablecolumnresize/constants';
import {
	clamp
} from '../../src/tablecolumnresize/utils';
import WidgetResize from '@ckeditor/ckeditor5-widget/src/widgetresize';
import Paragraph from '@ckeditor/ckeditor5-paragraph/src/paragraph';

describe( 'TableColumnResizeEditing', () => {
	let model, editor, view, editorElement, contentDirection;
	const PERCENTAGE_PRECISION = 0.001;
	const PIXEL_PRECISION = 1;

	beforeEach( async () => {
		editorElement = document.createElement( 'div' );
		document.body.appendChild( editorElement );
		editor = await createEditor();

		model = editor.model;
		view = editor.editing.view;
		contentDirection = editor.locale.contentLanguageDirection;
	} );

	afterEach( async () => {
		if ( editorElement ) {
			editorElement.remove();
		}

		if ( editor ) {
			await editor.destroy();
		}
	} );

	it( 'should have a proper name', () => {
		expect( TableColumnResizeEditing.pluginName ).to.equal( 'TableColumnResizeEditing' );
	} );

	it( 'should have defined column widths in model', () => {
		setModelData( model, modelTable( [
			[ '00', '01', '02' ],
			[ '10', '11', '12' ]
		], { columnWidths: '25%,25%,50%' } ) );

		const tableWidths = model.document.getRoot().getChild( 0 ).getAttribute( 'columnWidths' );

		expect( tableWidths ).to.be.equal( '25%,25%,50%' );
	} );

	it( 'should have defined col widths in view', () => {
		setModelData( model, modelTable( [
			[ '00', '01', '02' ],
			[ '10', '11', '12' ]
		], { columnWidths: '25%,25%,50%' } ) );

		const viewColWidths = [];

		for ( const item of view.createRangeIn( view.document.getRoot() ) ) {
			if ( item.item.is( 'element', 'col' ) ) {
				viewColWidths.push( item.item.getStyle( 'width' ) );
			}
		}

		expect( viewColWidths ).to.be.deep.equal( [ '25%', '25%', '50%' ] );
	} );

	describe( 'conversion', () => {
		describe( 'upcast', () => {
			it( 'the table width style to tableWidth attribute correctly', () => {
				editor.setData(
					`<figure class="table" style="width: 100%">
						<table>
							<colgroup>
								<col style="width:50%;">
								<col style="width:50%;">
							</colgroup>
							<tbody>
								<tr>
									<td>11</td>
									<td>12</td>
								</tr>
							</tbody>
						</table>
					</figure>`
				);

				expect( getModelData( model, { withoutSelection: true } ) ).to.equal(
					'<table columnWidths="50%,50%" tableWidth="100%">' +
						'<tableRow>' +
							'<tableCell>' +
								'<paragraph>11</paragraph>' +
							'</tableCell>' +
							'<tableCell>' +
								'<paragraph>12</paragraph>' +
							'</tableCell>' +
						'</tableRow>' +
					'</table>'
				);
			} );

			describe( 'when upcasting <colgroup> element', () => {
				it( 'should handle the correct number of <col> elements', () => {
					editor.setData(
						`<figure class="table">
							<table>
								<colgroup>
									<col style="width:33.33%;">
									<col style="width:33.33%;">
									<col style="width:33.34%;">
								</colgroup>
								<tbody>
									<tr>
										<td>11</td>
										<td>12</td>
										<td>13</td>
									</tr>
								</tbody>
							</table>
						</figure>`
					);

					expect( getModelData( model, { withoutSelection: true } ) ).to.equal(
						'<table columnWidths="33.33%,33.33%,33.34%">' +
							'<tableRow>' +
								'<tableCell>' +
									'<paragraph>11</paragraph>' +
								'</tableCell>' +
								'<tableCell>' +
									'<paragraph>12</paragraph>' +
								'</tableCell>' +
								'<tableCell>' +
									'<paragraph>13</paragraph>' +
								'</tableCell>' +
							'</tableRow>' +
						'</table>'
					);
				} );

				it( 'should handle too small number of <col> elements', () => {
					editor.setData(
						`<figure class="table">
							<table>
								<colgroup>
									<col style="width:33.33%;">
									<col style="width:33.33%;">
								</colgroup>
								<tbody>
									<tr>
										<td>11</td>
										<td>12</td>
										<td>13</td>
									</tr>
								</tbody>
							</table>
						</figure>`
					);

					expect( getModelData( model, { withoutSelection: true } ) ).to.equal(
						'<table columnWidths="33.33%,33.33%,33.34%">' +
							'<tableRow>' +
								'<tableCell>' +
									'<paragraph>11</paragraph>' +
								'</tableCell>' +
								'<tableCell>' +
									'<paragraph>12</paragraph>' +
								'</tableCell>' +
								'<tableCell>' +
									'<paragraph>13</paragraph>' +
								'</tableCell>' +
							'</tableRow>' +
						'</table>'
					);
				} );

				it( 'should handle too big number of <col> elements', () => {
					editor.setData(
						`<figure class="table">
							<table>
								<colgroup>
									<col style="width:33.33%;">
									<col style="width:33.33%;">
									<col style="width:33.34%;">
									<col style="width:33.33%;">
								</colgroup>
								<tbody>
									<tr>
										<td>11</td>
										<td>12</td>
										<td>13</td>
									</tr>
								</tbody>
							</table>
						</figure>`
					);

					expect( getModelData( model, { withoutSelection: true } ) ).to.equal(
						'<table columnWidths="33.33%,33.33%,33.34%">' +
							'<tableRow>' +
								'<tableCell>' +
									'<paragraph>11</paragraph>' +
								'</tableCell>' +
								'<tableCell>' +
									'<paragraph>12</paragraph>' +
								'</tableCell>' +
								'<tableCell>' +
									'<paragraph>13</paragraph>' +
								'</tableCell>' +
							'</tableRow>' +
						'</table>'
					);
				} );

				it( 'should adjust the missing column widths proportionally', () => {
					editor.setData(
						`<figure class="table">
							<table>
								<colgroup>
									<col style="width:50%;">
								</colgroup>
								<tbody>
									<tr>
										<td>11</td>
										<td>12</td>
										<td>13</td>
									</tr>
								</tbody>
							</table>
						</figure>`
					);

					expect( getModelData( model, { withoutSelection: true } ) ).to.equal(
						'<table columnWidths="50%,25%,25%">' +
							'<tableRow>' +
								'<tableCell>' +
									'<paragraph>11</paragraph>' +
								'</tableCell>' +
								'<tableCell>' +
									'<paragraph>12</paragraph>' +
								'</tableCell>' +
								'<tableCell>' +
									'<paragraph>13</paragraph>' +
								'</tableCell>' +
							'</tableRow>' +
						'</table>'
					);
				} );

				it( 'should handle the incorrect elements inside', () => {
					editor.setData(
						`<figure class="table">
							<table>
								<colgroup>
									<p style="width:33.33%;"></p>
								</colgroup>
								<tbody>
									<tr>
										<td>11</td>
										<td>12</td>
										<td>13</td>
									</tr>
								</tbody>
							</table>
						</figure>`
					);

					expect( getModelData( model, { withoutSelection: true } ) ).to.equal(
						'<table columnWidths="33.33%,33.33%,33.34%">' +
							'<tableRow>' +
								'<tableCell>' +
									'<paragraph>11</paragraph>' +
								'</tableCell>' +
								'<tableCell>' +
									'<paragraph>12</paragraph>' +
								'</tableCell>' +
								'<tableCell>' +
									'<paragraph>13</paragraph>' +
								'</tableCell>' +
							'</tableRow>' +
						'</table>'
					);
				} );

				it( 'should not convert if colgroup was already converted', () => {
					editor.conversion.for( 'upcast' ).add( dispatcher => {
						dispatcher.on( 'element:colgroup', ( evt, data, conversionApi ) => {
							conversionApi.consumable.consume( data.viewItem, { name: true } );
							data.modelRange = conversionApi.writer.createRange( data.modelCursor );
						}, { priority: 'highest' } );
					} );

					editor.setData(
						`<figure class="table" style="width: 100%">
							<table>
								<colgroup>
									<col style="width:50%;">
									<col style="width:50%;">
								</colgroup>
								<tbody>
									<tr>
										<td>11</td>
										<td>12</td>
									</tr>
								</tbody>
							</table>
						</figure>`
					);

					expect( getModelData( model, { withoutSelection: true } ) ).to.equal(
						'<table tableWidth="100%">' +
							'<tableRow>' +
								'<tableCell>' +
									'<paragraph>11</paragraph>' +
								'</tableCell>' +
								'<tableCell>' +
									'<paragraph>12</paragraph>' +
								'</tableCell>' +
							'</tableRow>' +
						'</table>'
					);
				} );

				it( 'should apply auto width if <col> element does not have style specified', () => {
					editor.setData(
						`<figure class="table">
							<table>
								<colgroup>
									<col>
									<col style="width:33.33%;">
									<col style="width:33.34%;">
								</colgroup>
								<tbody>
									<tr>
										<td>11</td>
										<td>12</td>
										<td>13</td>
									</tr>
								</tbody>
							</table>
						</figure>`
					);

					expect( getModelData( model, { withoutSelection: true } ) ).to.equal(
						'<table columnWidths="33.33%,33.33%,33.34%">' +
							'<tableRow>' +
								'<tableCell>' +
									'<paragraph>11</paragraph>' +
								'</tableCell>' +
								'<tableCell>' +
									'<paragraph>12</paragraph>' +
								'</tableCell>' +
								'<tableCell>' +
									'<paragraph>13</paragraph>' +
								'</tableCell>' +
							'</tableRow>' +
						'</table>'
					);
				} );
			} );
		} );

		describe( 'downcast', () => {
			it( 'the tableWidth attribute correctly', () => {
				setModelData( model, modelTable( [
					[ '11', '12' ]
				], { columnWidths: '50%,50%', tableWidth: '100%' } ) );

				expect( editor.getData() ).to.equal(
					'<figure class="table" style="width:100%;">' +
						'<table class="ck-table-resized">' +
							'<colgroup>' +
								'<col style="width:50%;">' +
								'<col style="width:50%;">' +
							'</colgroup>' +
							'<tbody>' +
								'<tr>' +
									'<td>11</td>' +
									'<td>12</td>' +
								'</tr>' +
							'</tbody>' +
						'</table>' +
					'</figure>'
				);
			} );

			it( 'should remove <colgroup> element if columnWidths attribute was removed', () => {
				setModelData( model, modelTable( [
					[ '11', '12' ]
				], { columnWidths: '50%,50%', tableWidth: '100%' } ) );

				model.change( writer => {
					writer.removeAttribute( 'columnWidths', model.document.getRoot().getChild( 0 ) );
				} );

				expect( editor.getData() ).to.equal(
					'<figure class="table" style="width:100%;">' +
						'<table>' +
							'<tbody>' +
								'<tr>' +
									'<td>11</td>' +
									'<td>12</td>' +
								'</tr>' +
							'</tbody>' +
						'</table>' +
					'</figure>'
				);
			} );

			it( 'should do nothing if columnWidths value was changed to the same value', () => {
				setModelData( model, modelTable( [
					[ '11', '12' ]
				], { columnWidths: '50%,50%', tableWidth: '100%' } ) );

				model.change( writer => {
					writer.setAttribute( 'columnWidths', '50%,50%', model.document.getRoot().getChild( 0 ) );
				} );

				expect( editor.getData() ).to.equal(
					'<figure class="table" style="width:100%;">' +
						'<table class="ck-table-resized">' +
							'<colgroup>' +
								'<col style="width:50%;">' +
								'<col style="width:50%;">' +
							'</colgroup>' +
							'<tbody>' +
								'<tr>' +
									'<td>11</td>' +
									'<td>12</td>' +
								'</tr>' +
							'</tbody>' +
						'</table>' +
					'</figure>'
				);
			} );
		} );

		describe( 'model change integration', () => {
			describe( 'and the widhtStrategy is "manualWidth"', () => {
				it( 'should create resizers when table is inserted', () => {
					editor.execute( 'insertTable' );

					model.change( writer => {
						const table = model.document.getRoot().getChild( 0 );

						writer.setAttribute( 'widthStrategy', 'manualWidth', table );
					} );

					const domTable = getDomTable( view );
					const resizers = Array.from( domTable.querySelectorAll( '.ck-table-column-resizer' ) );

					expect( resizers.length ).to.equal( 4 );
				} );

				it( 'should create resizers when row is inserted', () => {
					setModelData( model, modelTable( [
						[ '00', '01', '02' ],
						[ '10', '11', '[12]' ]
					], { columnWidths: '25%,25%,50%' } ) );

					editor.execute( 'insertTableRowBelow' );

					const domTable = getDomTable( view );
					const resizers = Array.from( domTable.querySelectorAll( '.ck-table-column-resizer' ) );

					expect( resizers.length ).to.equal( 9 );
				} );

				it( 'should create resizers when cell from splitting is inserted', () => {
					setModelData( model, modelTable( [
						[ '00', '01', '02' ],
						[ '10', '11', '[12]' ]
					], { columnWidths: '25%,25%,50%' } ) );

					editor.execute( 'splitTableCellVertically' );

					const domTable = getDomTable( view );
					const resizers = Array.from( domTable.querySelectorAll( '.ck-table-column-resizer' ) );

					expect( resizers.length ).to.equal( 7 );
				} );
			} );
		} );
	} );

	describe( 'post-fixer', () => {
		describe( 'correctly assigns the "columnIndex" reference in internal column index map', () => {
			it( 'when the column is added at the beginning', () => {
				setModelData( model, modelTable( [
					[ '[00]', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '25%,25%,50%' } ) );

				editor.execute( 'insertTableColumnLeft' );

				const expectedIndexes = {
					'00': 1,
					'01': 2,
					'02': 3,
					'10': 1,
					'11': 2,
					'12': 3
				};

				const wholeContentRange = model.createRangeIn( model.document.getRoot() );

				for ( const item of wholeContentRange ) {
					if ( item.item.is( 'element', 'tableCell' ) && item.item.getChild( 0 ).getChild( 0 ) ) {
						const text = item.item.getChild( 0 ).getChild( 0 ).data;

						expect( getColumnIndex( item.item, editor ) ).to.equal( expectedIndexes[ text ] );
					}
				}
			} );

			it( 'when the column is added in the middle', () => {
				setModelData( model, modelTable( [
					[ '[00]', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '25%,25%,50%' } ) );

				editor.execute( 'insertTableColumnRight' );

				const expectedIndexes = {
					'00': 0,
					'01': 2,
					'02': 3,
					'10': 0,
					'11': 2,
					'12': 3
				};

				const wholeContentRange = model.createRangeIn( model.document.getRoot() );

				for ( const item of wholeContentRange ) {
					if ( item.item.is( 'element', 'tableCell' ) && item.item.getChild( 0 ).getChild( 0 ) ) {
						const text = item.item.getChild( 0 ).getChild( 0 ).data;

						expect( getColumnIndex( item.item, editor ) ).to.equal( expectedIndexes[ text ] );
					}
				}
			} );

			it( 'when the column is added at the end', () => {
				setModelData( model, modelTable( [
					[ '00', '01', '[02]' ],
					[ '10', '11', '12' ]
				], { columnWidths: '25%,25%,50%' } ) );

				editor.execute( 'insertTableColumnRight' );

				const expectedIndexes = {
					'00': 0,
					'01': 1,
					'02': 2,
					'10': 0,
					'11': 1,
					'12': 2
				};

				const wholeContentRange = model.createRangeIn( model.document.getRoot() );

				for ( const item of wholeContentRange ) {
					if ( item.item.is( 'element', 'tableCell' ) && item.item.getChild( 0 ).getChild( 0 ) ) {
						const text = item.item.getChild( 0 ).getChild( 0 ).data;

						expect( getColumnIndex( item.item, editor ) ).to.equal( expectedIndexes[ text ] );
					}
				}
			} );

			it( 'when the fist column is removed', () => {
				setModelData( model, modelTable( [
					[ '[00]', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '25%,25%,50%' } ) );

				editor.execute( 'removeTableColumn' );

				const expectedIndexes = {
					'01': 0,
					'02': 1,
					'11': 0,
					'12': 1
				};

				const wholeContentRange = model.createRangeIn( model.document.getRoot() );

				for ( const item of wholeContentRange ) {
					if ( item.item.is( 'element', 'tableCell' ) && item.item.getChild( 0 ).getChild( 0 ) ) {
						const text = item.item.getChild( 0 ).getChild( 0 ).data;

						expect( getColumnIndex( item.item, editor ) ).to.equal( expectedIndexes[ text ] );
					}
				}
			} );

			it( 'when the middle column is removed', () => {
				setModelData( model, modelTable( [
					[ '00', '[01]', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '25%,25%,50%' } ) );

				editor.execute( 'removeTableColumn' );

				const expectedIndexes = {
					'00': 0,
					'02': 1,
					'10': 0,
					'12': 1
				};

				const wholeContentRange = model.createRangeIn( model.document.getRoot() );

				for ( const item of wholeContentRange ) {
					if ( item.item.is( 'element', 'tableCell' ) && item.item.getChild( 0 ).getChild( 0 ) ) {
						const text = item.item.getChild( 0 ).getChild( 0 ).data;

						expect( getColumnIndex( item.item, editor ) ).to.equal( expectedIndexes[ text ] );
					}
				}
			} );

			it( 'when the last column is removed', () => {
				setModelData( model, modelTable( [
					[ '00', '01', '[02]' ],
					[ '10', '11', '12' ]
				], { columnWidths: '25%,25%,50%' } ) );

				editor.execute( 'removeTableColumn' );

				const expectedIndexes = {
					'00': 0,
					'01': 1,
					'10': 0,
					'11': 1
				};

				const wholeContentRange = model.createRangeIn( model.document.getRoot() );

				for ( const item of wholeContentRange ) {
					if ( item.item.is( 'element', 'tableCell' ) && item.item.getChild( 0 ).getChild( 0 ) ) {
						const text = item.item.getChild( 0 ).getChild( 0 ).data;

						expect( getColumnIndex( item.item, editor ) ).to.equal( expectedIndexes[ text ] );
					}
				}
			} );
		} );

		it( 'should find and allow for resizing nested tables', () => {
			editor.setData(
				`<figure class="table">
					<table>
						<tbody
							<tr>
								<td>
									<figure class="table">
										<table>
											<tbody>
												<tr>
													<td>20</td>
													<td>21</td>
												</tr>
											</tbody>
										</table>
									</figure>
								</td>
								<td>11</td>
							</tr>
						</tbody>
					</table>
				</figure>`
			);

			expect( document.getElementsByClassName( 'ck-table-column-resizer' ).length ).to.equal( 4 );
		} );
	} );

	describe( '_isResizingAllowed property', () => {
		describe( 'should be set to "false"', () => {
			it( 'if editor is in the read-only mode', () => {
				editor.enableReadOnlyMode( 'test' );

				expect( editor.plugins.get( 'TableColumnResizeEditing' )._isResizingAllowed ).to.equal( false );
			} );

			it( 'if the TableColumnResize plugin is disabled', () => {
				editor.plugins.get( 'TableColumnResize' ).isEnabled = false;

				expect( editor.plugins.get( 'TableColumnResizeEditing' )._isResizingAllowed ).to.equal( false );
			} );

			it( 'if resizeTableWidth command is disabled', () => {
				editor.commands.get( 'resizeTableWidth' ).isEnabled = false;

				expect( editor.plugins.get( 'TableColumnResizeEditing' )._isResizingAllowed ).to.equal( false );
			} );

			it( 'if resizeColumnWidths command is disabled', () => {
				editor.commands.get( 'resizeColumnWidths' ).isEnabled = false;

				expect( editor.plugins.get( 'TableColumnResizeEditing' )._isResizingAllowed ).to.equal( false );
			} );
		} );

		describe( 'should be set to "true"', () => {
			it( 'if the editor is not read-only and plugin and commands are enabled', () => {
				editor.plugins.get( 'TableColumnResize' ).isEnabled = true;
				editor.commands.get( 'resizeTableWidth' ).isEnabled = true;
				editor.commands.get( 'resizeColumnWidths' ).isEnabled = true;

				expect( editor.plugins.get( 'TableColumnResizeEditing' )._isResizingAllowed ).to.equal( true );
			} );
		} );

		describe( 'should change value to "false"', () => {
			it( 'if editor was switched to the read-only mode at runtime', () => {
				const spy = sinon.spy();
				const TableColumnResizeEditingPlugin = editor.plugins.get( 'TableColumnResizeEditing' );

				editor.listenTo( TableColumnResizeEditingPlugin, 'change:_isResizingAllowed', spy );

				editor.enableReadOnlyMode( 'test' );

				expect( spy.calledOnce, 'Property value should have changed once' ).to.be.true;
				expect( TableColumnResizeEditingPlugin._isResizingAllowed ).to.equal( false );
			} );

			it( 'if the TableResizeEditing plugin was disabled at runtime', () => {
				const spy = sinon.spy();
				const TableColumnResizeEditingPlugin = editor.plugins.get( 'TableColumnResizeEditing' );

				editor.listenTo( TableColumnResizeEditingPlugin, 'change:_isResizingAllowed', spy );

				editor.plugins.get( 'TableColumnResize' ).isEnabled = false;

				expect( spy.calledOnce, 'Property value should have changed once' ).to.be.true;
				expect( TableColumnResizeEditingPlugin._isResizingAllowed ).to.equal( false );
			} );

			it( 'if resizeTableWidth command was disabled at runtime', () => {
				const spy = sinon.spy();
				const TableColumnResizeEditingPlugin = editor.plugins.get( 'TableColumnResizeEditing' );

				editor.listenTo( TableColumnResizeEditingPlugin, 'change:_isResizingAllowed', spy );

				editor.commands.get( 'resizeTableWidth' ).isEnabled = false;

				expect( spy.calledOnce, 'Property value should have changed once' ).to.be.true;
				expect( TableColumnResizeEditingPlugin._isResizingAllowed ).to.equal( false );
			} );

			it( 'if resizeColumnWidths command was disabled at runtime', () => {
				const spy = sinon.spy();
				const TableColumnResizeEditingPlugin = editor.plugins.get( 'TableColumnResizeEditing' );

				editor.listenTo( TableColumnResizeEditingPlugin, 'change:_isResizingAllowed', spy );

				editor.commands.get( 'resizeColumnWidths' ).isEnabled = false;

				expect( spy.calledOnce, 'Property value should have changed once' ).to.be.true;
				expect( TableColumnResizeEditingPlugin._isResizingAllowed ).to.equal( false );
			} );
		} );

		describe( 'should change value to "true"', () => {
			it( 'if read-only mode was disabled at runtime', () => {
				editor.enableReadOnlyMode( 'test' );

				const spy = sinon.spy();
				const TableColumnResizeEditingPlugin = editor.plugins.get( 'TableColumnResizeEditing' );

				editor.listenTo( TableColumnResizeEditingPlugin, 'change:_isResizingAllowed', spy );

				editor.disableReadOnlyMode( 'test' );

				expect( spy.calledOnce, 'Property value should have changed once' ).to.be.true;
				expect( TableColumnResizeEditingPlugin._isResizingAllowed ).to.equal( true );
			} );

			it( 'if the TableResizeEditing plugin was enabled at runtime', () => {
				editor.plugins.get( 'TableColumnResize' ).isEnabled = false;

				const spy = sinon.spy();
				const TableColumnResizeEditingPlugin = editor.plugins.get( 'TableColumnResizeEditing' );

				editor.listenTo( TableColumnResizeEditingPlugin, 'change:_isResizingAllowed', spy );

				editor.plugins.get( 'TableColumnResize' ).isEnabled = true;

				expect( spy.calledOnce, 'Property value should have changed once' ).to.be.true;
				expect( TableColumnResizeEditingPlugin._isResizingAllowed ).to.equal( true );
			} );

			it( 'if resizeTableWidth command was enabled at runtime', () => {
				editor.commands.get( 'resizeTableWidth' ).isEnabled = false;

				const spy = sinon.spy();
				const TableColumnResizeEditingPlugin = editor.plugins.get( 'TableColumnResizeEditing' );

				editor.listenTo( TableColumnResizeEditingPlugin, 'change:_isResizingAllowed', spy );

				editor.commands.get( 'resizeTableWidth' ).isEnabled = true;

				expect( spy.calledOnce, 'Property value should have changed once' ).to.be.true;
				expect( TableColumnResizeEditingPlugin._isResizingAllowed ).to.equal( true );
			} );

			it( 'if resizeColumnWidths command was enabled at runtime', () => {
				editor.commands.get( 'resizeColumnWidths' ).isEnabled = false;

				const spy = sinon.spy();
				const TableColumnResizeEditingPlugin = editor.plugins.get( 'TableColumnResizeEditing' );

				editor.listenTo( TableColumnResizeEditingPlugin, 'change:_isResizingAllowed', spy );

				editor.commands.get( 'resizeColumnWidths' ).isEnabled = true;

				expect( spy.calledOnce, 'Property value should have changed once' ).to.be.true;
				expect( TableColumnResizeEditingPlugin._isResizingAllowed ).to.equal( true );
			} );
		} );

		it( 'editable should not have the "ck-column-resize_disabled" class if "_isResizingAllowed" is set to "true"', () => {
			editor.plugins.get( 'TableColumnResizeEditing' )._isResizingAllowed = true;

			expect( editor.editing.view.document.getRoot().hasClass( 'ck-column-resize_disabled' ) ).to.equal( false );
		} );

		it( 'editable should have the "ck-column-resize_disabled" class if "_isResizingAllowed" is set to "false"', () => {
			editor.plugins.get( 'TableColumnResizeEditing' )._isResizingAllowed = false;

			expect( editor.editing.view.document.getRoot().hasClass( 'ck-column-resize_disabled' ) ).to.equal( true );
		} );
	} );

	describe( 'does not start resizing', () => {
		it( 'if not clicked on the resizer', () => {
			setModelData( model, modelTable( [
				[ '00', '01', '02' ],
				[ '10', '11', '12' ]
			], { columnWidths: '20%,25%,55%', tableWidth: '500px' } ) );

			tableColumnResizeMouseSimulator.down( editor, view.getDomRoot() );

			expect( editor.plugins.get( 'TableColumnResizeEditing' )._isResizingActive ).to.be.false;
			expect( model.document.getRoot().getChild( 0 ).getAttribute( 'columnWidths' ) ).to.equal( '20%,25%,55%' );
		} );

		it( 'if resizing is not allowed', () => {
			setModelData( model, modelTable( [
				[ '00', '01', '02' ],
				[ '10', '11', '12' ]
			], { columnWidths: '20%,25%,55%', tableWidth: '500px' } ) );

			editor.plugins.get( 'TableColumnResizeEditing' )._isResizingAllowed = false;

			tableColumnResizeMouseSimulator.down( editor, getDomResizer( getDomTable( view ), 0, 0 ) );

			expect( editor.plugins.get( 'TableColumnResizeEditing' )._isResizingActive ).to.be.false;
			expect( model.document.getRoot().getChild( 0 ).getAttribute( 'columnWidths' ) ).to.equal( '20%,25%,55%' );
		} );

		it( 'without dragging', () => {
			// Test-specific.
			const columnToResizeIndex = 0;
			const mouseMovementVector = { x: 0, y: 0 };

			setModelData( model, modelTable( [
				[ '00', '01', '02' ],
				[ '10', '11', '12' ]
			], { columnWidths: '20%,25%,55%', tableWidth: '500px' } ) );

			// Test-agnostic.
			const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

			tableColumnResizeMouseSimulator.resize( editor, getDomTable( view ), columnToResizeIndex, mouseMovementVector, 1 );

			const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

			assertModelWidthsSum( finalModelColumnWidthsPc );

			const finalViewColumnWidthsPc = getViewColumnWidthsPc( getViewTable( view ) );

			assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

			const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
			const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
				initialViewColumnWidthsPx,
				mouseMovementVector,
				contentDirection,
				columnToResizeIndex
			);

			assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );
		} );

		it( 'without mousedown event before mousemove', () => {
			setModelData( model, modelTable( [
				[ '00', '01', '02' ],
				[ '10', '11', '12' ]
			], { columnWidths: '20%,25%,55%', tableWidth: '500px' } ) );

			const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

			// tableColumnResizeMouseSimulator.down( editor, getDomResizer( getDomTable( view ), 0, 0 ) );
			tableColumnResizeMouseSimulator.move( editor, getDomResizer( getDomTable( view ), 0, 0 ), { x: 10, y: 0 } );

			const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

			expect( finalViewColumnWidthsPx ).to.deep.equal( initialViewColumnWidthsPx );
			expect( model.document.getRoot().getChild( 0 ).getAttribute( 'columnWidths' ) ).to.equal( '20%,25%,55%' );
		} );
	} );

	describe( 'while resizing', () => {
		it( 'cancels resizing if resizing is not allowed during mousemove', () => {
			setModelData( model, modelTable( [
				[ '00', '01', '02' ],
				[ '10', '11', '12' ]
			], { columnWidths: '20%,25%,55%', tableWidth: '500px' } ) );

			const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

			tableColumnResizeMouseSimulator.down( editor, getDomResizer( getDomTable( view ), 0, 0 ) );
			tableColumnResizeMouseSimulator.move( editor, getDomResizer( getDomTable( view ), 0, 0 ), { x: 10, y: 0 } );

			editor.plugins.get( 'TableColumnResizeEditing' )._isResizingAllowed = false;

			tableColumnResizeMouseSimulator.move( editor, getDomResizer( getDomTable( view ), 0, 0 ), { x: 10, y: 0 } );

			const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

			expect( finalViewColumnWidthsPx ).to.deep.equal( initialViewColumnWidthsPx );
			expect( model.document.getRoot().getChild( 0 ).getAttribute( 'columnWidths' ) ).to.equal( '20%,25%,55%' );
		} );

		it( 'does nothing on mouseup if resizing was not started', () => {
			setModelData( model, modelTable( [
				[ '00', '01', '02' ],
				[ '10', '11', '12' ]
			], { columnWidths: '20%,25%,55%', tableWidth: '500px' } ) );

			const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

			tableColumnResizeMouseSimulator.up( editor );

			const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

			expect( finalViewColumnWidthsPx ).to.deep.equal( initialViewColumnWidthsPx );
			expect( model.document.getRoot().getChild( 0 ).getAttribute( 'columnWidths' ) ).to.equal( '20%,25%,55%' );
		} );

		it( 'does not change the widths if the movement vector was {0,0}', () => {
			// Test-specific.
			const columnToResizeIndex = 0;
			const mouseMovementVector = { x: 0, y: 0 };

			setModelData( model, modelTable( [
				[ '00', '01', '02' ],
				[ '10', '11', '12' ]
			], { columnWidths: '25%,25%,50%', tableWidth: '40%' } ) );

			// Test-agnostic.
			const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

			tableColumnResizeMouseSimulator.resize( editor, getDomTable( view ), columnToResizeIndex, mouseMovementVector );

			const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

			assertModelWidthsSum( finalModelColumnWidthsPc );

			const finalViewColumnWidthsPc = getViewColumnWidthsPc( getViewTable( view ) );

			assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

			const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

			const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
				initialViewColumnWidthsPx,
				mouseMovementVector,
				contentDirection,
				columnToResizeIndex
			);

			assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );
		} );

		describe( 'cancels resizing if resizing is not allowed during mouseup', () => {
			it( 'if only columnWidths was changed', () => {
				setModelData( model, modelTable( [
					[ '00', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '20%,25%,55%', tableWidth: '40%' } ) );

				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.down( editor, getDomResizer( getDomTable( view ), 0, 0 ) );
				tableColumnResizeMouseSimulator.move( editor, getDomResizer( getDomTable( view ), 0, 0 ), { x: 10, y: 0 } );

				editor.plugins.get( 'TableColumnResizeEditing' )._isResizingAllowed = false;

				tableColumnResizeMouseSimulator.up( editor );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				expect( finalViewColumnWidthsPx ).to.deep.equal( initialViewColumnWidthsPx );
				expect( model.document.getRoot().getChild( 0 ).getAttribute( 'columnWidths' ) ).to.equal( '20%,25%,55%' );
			} );

			it( 'if columnWidths was set for the first time', () => {
				setModelData( model, modelTable( [
					[ '00', '01', '02' ],
					[ '10', '11', '12' ]
				] ) );

				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.down( editor, getDomResizer( getDomTable( view ), 0, 0 ) );
				tableColumnResizeMouseSimulator.move( editor, getDomResizer( getDomTable( view ), 0, 0 ), { x: 10, y: 0 } );

				editor.plugins.get( 'TableColumnResizeEditing' )._isResizingAllowed = false;

				tableColumnResizeMouseSimulator.up( editor );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				expect( finalViewColumnWidthsPx ).to.deep.equal( initialViewColumnWidthsPx );
				expect( model.document.getRoot().getChild( 0 ).getAttribute( 'columnWidths' ) ).to.be.undefined;
			} );

			it( 'if tableWidth was changed', () => {
				setModelData( model, modelTable( [
					[ '00', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '20%,25%,55%', tableWidth: '40%' } ) );

				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.down( editor, getDomResizer( getDomTable( view ), 2, 0 ) );
				tableColumnResizeMouseSimulator.move( editor, getDomResizer( getDomTable( view ), 2, 0 ), { x: 10, y: 0 } );

				editor.plugins.get( 'TableColumnResizeEditing' )._isResizingAllowed = false;

				tableColumnResizeMouseSimulator.up( editor );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				expect( finalViewColumnWidthsPx ).to.deep.equal( initialViewColumnWidthsPx );
				expect( model.document.getRoot().getChild( 0 ).getAttribute( 'columnWidths' ) ).to.equal( '20%,25%,55%' );
			} );

			it( 'if tableWidth was set for the first time', () => {
				setModelData( model, modelTable( [
					[ '00', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '20%,25%,55%' } ) );

				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.down( editor, getDomResizer( getDomTable( view ), 2, 0 ) );
				tableColumnResizeMouseSimulator.move( editor, getDomResizer( getDomTable( view ), 2, 0 ), { x: 10, y: 0 } );

				editor.plugins.get( 'TableColumnResizeEditing' )._isResizingAllowed = false;

				tableColumnResizeMouseSimulator.up( editor );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				expect( finalViewColumnWidthsPx ).to.deep.equal( initialViewColumnWidthsPx );
				expect( model.document.getRoot().getChild( 0 ).getAttribute( 'columnWidths' ) ).to.equal( '20%,25%,55%' );
			} );
		} );

		describe( 'right or left', () => {
			it( 'shrinks the first table column on dragging left', () => {
				// Test-specific.
				const columnToResizeIndex = 0;
				const mouseMovementVector = { x: -10, y: 0 };

				setModelData( model, modelTable( [
					[ '00', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '25%,25%,50%', tableWidth: '500px' } ) );

				// Test-agnostic.
				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.resize( editor, getDomTable( view ), columnToResizeIndex, mouseMovementVector );

				const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

				assertModelWidthsSum( finalModelColumnWidthsPc );

				const finalViewColumnWidthsPc = getViewColumnWidthsPc( getViewTable( view ) );

				assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
				const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
					initialViewColumnWidthsPx,
					mouseMovementVector,
					contentDirection,
					columnToResizeIndex
				);

				assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );
			} );

			it( 'shrinks the first table header column on dragging left', () => {
				// Test-specific.
				const columnToResizeIndex = 0;
				const mouseMovementVector = { x: -10, y: 0 };

				setModelData( model, modelTable( [
					[ '00', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '25%,25%,50%', tableWidth: '500px', headingColumns: 1 } ) );

				// Test-agnostic.
				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.resize( editor, getDomTable( view ), columnToResizeIndex, mouseMovementVector );

				const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

				assertModelWidthsSum( finalModelColumnWidthsPc );

				const finalViewColumnWidthsPc = getViewColumnWidthsPc( getViewTable( view ) );

				assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
				const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
					initialViewColumnWidthsPx,
					mouseMovementVector,
					contentDirection,
					columnToResizeIndex
				);

				assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );
			} );

			it( 'expands the first table column on dragging right', () => {
				// Test-specific.
				const columnToResizeIndex = 0;
				const mouseMovementVector = { x: 10, y: 0 };

				setModelData( model, modelTable( [
					[ '00', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '25%,25%,50%', tableWidth: '500px' } ) );

				// Test-agnostic.
				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.resize( editor, getDomTable( view ), columnToResizeIndex, mouseMovementVector );

				const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

				assertModelWidthsSum( finalModelColumnWidthsPc );

				const finalViewColumnWidthsPc = getViewColumnWidthsPc( getViewTable( view ) );

				assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
				const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
					initialViewColumnWidthsPx,
					mouseMovementVector,
					contentDirection,
					columnToResizeIndex
				);

				assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );
			} );

			it( 'shrinks the last column on dragging left', () => {
				// Test-specific.
				const columnToResizeIndex = 2;
				const mouseMovementVector = { x: -10, y: 0 };

				setModelData( model, modelTable( [
					[ '00', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '25%,25%,50%', tableWidth: '500px' } ) );

				// Test-agnostic.
				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.resize( editor, getDomTable( view ), columnToResizeIndex, mouseMovementVector );

				const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

				assertModelWidthsSum( finalModelColumnWidthsPc );

				const finalViewColumnWidthsPc = getViewColumnWidthsPc( getViewTable( view ) );

				assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
				const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
					initialViewColumnWidthsPx,
					mouseMovementVector,
					contentDirection,
					columnToResizeIndex
				);

				assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );
			} );

			it( 'correctly resizes a table with only header rows', () => {
				// Test-specific.
				const columnToResizeIndex = 0;
				const mouseMovementVector = { x: 10, y: 0 };

				setModelData( model, modelTable( [ [ '0', '1' ] ], { headingRows: '1', columnWidths: '50%,50%' } ) );

				// Test-agnostic.
				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.resize( editor, getDomTable( view ), columnToResizeIndex, mouseMovementVector );

				const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

				assertModelWidthsSum( finalModelColumnWidthsPc );

				const finalViewColumnWidthsPc = getViewColumnWidthsPc( getViewTable( view ) );

				assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
				const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
					initialViewColumnWidthsPx,
					mouseMovementVector,
					contentDirection,
					columnToResizeIndex
				);

				assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );
			} );

			it( 'does not remove column when it was shrinked to negative width', () => {
				// Test-specific.
				setModelData( model, modelTable( [
					[ '00', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '20%,25%,55%', tableWidth: '500px' } ) );

				const columnToResizeIndex = 1;
				const initialColumnWidth = getColumnWidth( getDomTable( view ), columnToResizeIndex );
				const mouseMovementVector = { x: -( initialColumnWidth * 1.05 ), y: 0 };

				// Test-agnostic.
				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.resize( editor, getDomTable( view ), columnToResizeIndex, mouseMovementVector );

				const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

				assertModelWidthsSum( finalModelColumnWidthsPc );

				const finalViewColumnWidthsPc = getViewColumnWidthsPc( getViewTable( view ) );

				assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
				const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
					initialViewColumnWidthsPx,
					mouseMovementVector,
					contentDirection,
					columnToResizeIndex
				);

				assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );

				expect( view.document.getRoot()
					.getChild( 0 ) // figure
					.getChild( 1 ) // table
					.getChild( 1 ) // tbody
					.getChild( 0 ) // tr
					.childCount
				).to.equal( 3 );
			} );

			it( 'does not remove column when adjacent column was expanded over it', () => {
				// Test-specific.
				setModelData( model, modelTable( [
					[ '00', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '20%,25%,55%', tableWidth: '500px' } ) );

				const columnToResizeIndex = 0;
				const initialColumnWidth = getColumnWidth( getDomTable( view ), columnToResizeIndex );
				const mouseMovementVector = { x: ( initialColumnWidth * 1.05 ), y: 0 };

				// Test-agnostic.
				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.resize( editor, getDomTable( view ), columnToResizeIndex, mouseMovementVector );

				const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

				assertModelWidthsSum( finalModelColumnWidthsPc );

				const finalViewColumnWidthsPc = getViewColumnWidthsPc( getViewTable( view ) );

				assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
				const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
					initialViewColumnWidthsPx,
					mouseMovementVector,
					contentDirection,
					columnToResizeIndex
				);

				assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );

				expect( view.document.getRoot()
					.getChild( 0 ) // figure
					.getChild( 1 ) // table
					.getChild( 1 ) // tbody
					.getChild( 0 ) // tr
					.childCount
				).to.equal( 3 );
			} );

			it( 'resizes column with a colspan in the first row', () => {
				// Test-specific.
				const columnToResizeIndex = 0;
				const mouseMovementVector = { x: -10, y: 0 };

				setModelData( model, modelTable( [
					[ { contents: '00', colspan: 2 }, '02' ],
					[ '10', '11', '12' ],
					[ '20', '21', '22' ]
				], { columnWidths: '20%,25%,55%', tableWidth: '500px' } ) );

				// Test-agnostic.
				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.resize( editor, getDomTable( view ), columnToResizeIndex, mouseMovementVector, 1 );

				const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

				assertModelWidthsSum( finalModelColumnWidthsPc );

				const finalViewColumnWidthsPc = getViewColumnWidthsPc( getViewTable( view ) );

				assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
				const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
					initialViewColumnWidthsPx,
					mouseMovementVector,
					contentDirection,
					columnToResizeIndex
				);

				assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );
			} );

			it( 'resizes correct column with a rowspan in the last column', () => {
				// Test-specific.
				const columnToResizeIndex = 1;
				const mouseMovementVector = { x: -10, y: 0 };

				setModelData( model, modelTable( [
					[ '00', '01', { contents: '02', rowspan: 3 } ],
					[ '10', '11' ],
					[ '20', '21' ]
				], { columnWidths: '20%,25%,55%', tableWidth: '500px' } ) );

				// Test-agnostic.
				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.resize( editor, getDomTable( view ), columnToResizeIndex, mouseMovementVector, 2 );

				const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

				assertModelWidthsSum( finalModelColumnWidthsPc );

				const finalViewColumnWidthsPc = getViewColumnWidthsPc( getViewTable( view ) );

				assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
				const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
					initialViewColumnWidthsPx,
					mouseMovementVector,
					contentDirection,
					columnToResizeIndex
				);

				assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );
			} );

			describe( 'in editor with TableProperties, where there are 2 tables: centered and aligned', () => {
				let editor, view, editorElement;

				beforeEach( async () => {
					editorElement = document.createElement( 'div' );
					document.body.appendChild( editorElement );
					editor = await createEditor( null, [ TableProperties ] );

					view = editor.editing.view;
					contentDirection = editor.locale.contentLanguageDirection;
				} );

				afterEach( async () => {
					if ( editorElement ) {
						editorElement.remove();
					}

					if ( editor ) {
						await editor.destroy();
					}
				} );

				it( 'shrinks the table twice as much when resizing centered table as compared to aligned table', () => {
					const columnToResizeIndex = 1;
					const mouseMovementVector = { x: -10, y: 0 };

					editor.setData(
						`<figure class="table" style="float:left;width:500px;">
							<table>
								<tbody>
									<tr>
										<td>11</td>
										<td>12</td>
									</tr>
								</tbody>
							</table>
						</figure>`
					);

					tableColumnResizeMouseSimulator.resize( editor, getDomTable( view ), columnToResizeIndex, mouseMovementVector, 0 );

					const alignedTableColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

					editor.setData(
						`<figure class="table" style="width:500px;">
							<table>
								<tbody>
									<tr>
										<td>11</td>
										<td>12</td>
									</tr>
								</tbody>
							</table>
						</figure>`
					);

					tableColumnResizeMouseSimulator.resize( editor, getDomTable( view ), columnToResizeIndex, mouseMovementVector, 0 );

					const centeredTableColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
					const widthDifference = centeredTableColumnWidthsPx[ 1 ] - alignedTableColumnWidthsPx[ 1 ];

					expect( Math.abs( widthDifference - mouseMovementVector.x ) < PIXEL_PRECISION ).to.be.true;
				} );
			} );

			describe( 'nested table ', () => {
				it( 'correctly shrinks when the last column is dragged to the left', () => {
					// Test-specific.
					const columnToResizeIndex = 1;
					const mouseMovementVector = { x: -10, y: 0 };

					setModelData( editor.model,
						'<table columnWidths="100%" tableWidth="100%">' +
							'<tableRow>' +
								'<tableCell>' +
									'[<table columnWidths="50%,50%">' +
										'<tableRow>' +
											'<tableCell>' +
												'<paragraph>foo</paragraph>' +
											'</tableCell>' +
											'<tableCell>' +
												'<paragraph>bar</paragraph>' +
											'</tableCell>' +
										'</tableRow>' +
									'</table>]' +
								'</tableCell>' +
							'</tableRow>' +
						'</table>'
					);

					const modelNestedTable = model.document.selection.getSelectedElement();
					const domNestedTable = getDomTable( view ).querySelectorAll( 'table' )[ 1 ];
					const viewNestedTable = view.document.selection.getSelectedElement().getChild( 1 );

					setInitialWidthsInPx( editor, viewNestedTable, 201, 400 );

					// Test-agnostic.
					const initialViewColumnWidthsPx = getViewColumnWidthsPx( domNestedTable );

					tableColumnResizeMouseSimulator.resize( editor, domNestedTable, columnToResizeIndex, mouseMovementVector, 0 );

					const finalModelColumnWidthsPc = getModelColumnWidthsPc( modelNestedTable );

					assertModelWidthsSum( finalModelColumnWidthsPc );

					const finalViewColumnWidthsPc = getViewColumnWidthsPc( viewNestedTable );

					assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

					const finalViewColumnWidthsPx = getViewColumnWidthsPx( domNestedTable );
					const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
						initialViewColumnWidthsPx,
						mouseMovementVector,
						contentDirection,
						columnToResizeIndex
					);

					assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );

					expect( getModelData( model, { withoutSelection: true } ) ).to.match(
						new RegExp(
							'<table columnWidths="100%" tableWidth="100%">' +
								'<tableRow>' +
									'<tableCell>' +
										'<table columnWidths="55\\.5[\\d]%,44\\.4[\\d]%" tableWidth="46\\.7[\\d]%">' +
											'<tableRow>' +
												'<tableCell>' +
													'<paragraph>foo</paragraph>' +
												'</tableCell>' +
												'<tableCell>' +
													'<paragraph>bar</paragraph>' +
												'</tableCell>' +
											'</tableRow>' +
										'</table>' +
									'</tableCell>' +
								'</tableRow>' +
							'</table>'
						)
					);
				} );

				it( 'correctly expands when the last column is dragged to the right', () => {
					// Test-specific.
					const columnToResizeIndex = 1;
					const mouseMovementVector = { x: 10, y: 0 };

					setModelData( editor.model,
						'<table columnWidths="100%" tableWidth="100%">' +
							'<tableRow>' +
								'<tableCell>' +
									'[<table tableWidth="90%" columnWidths="50%,50%">' +
										'<tableRow>' +
											'<tableCell>' +
												'<paragraph>foo</paragraph>' +
											'</tableCell>' +
											'<tableCell>' +
												'<paragraph>bar</paragraph>' +
											'</tableCell>' +
										'</tableRow>' +
									'</table>]' +
								'</tableCell>' +
							'</tableRow>' +
						'</table>'
					);

					const modelNestedTable = model.document.selection.getSelectedElement();
					const domNestedTable = getDomTable( view ).querySelectorAll( 'table' )[ 1 ];
					const viewNestedTable = view.document.selection.getSelectedElement().getChild( 1 );

					setInitialWidthsInPx( editor, viewNestedTable, 201, 300 );

					// Test-agnostic.
					const initialViewColumnWidthsPx = getViewColumnWidthsPx( domNestedTable );

					tableColumnResizeMouseSimulator.resize( editor, domNestedTable, columnToResizeIndex, mouseMovementVector, 0 );

					const finalModelColumnWidthsPc = getModelColumnWidthsPc( modelNestedTable );

					assertModelWidthsSum( finalModelColumnWidthsPc );

					const finalViewColumnWidthsPc = getViewColumnWidthsPc( viewNestedTable );

					assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

					const finalViewColumnWidthsPx = getViewColumnWidthsPx( domNestedTable );
					const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
						initialViewColumnWidthsPx,
						mouseMovementVector,
						contentDirection,
						columnToResizeIndex
					);

					assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );

					expect( getModelData( model, { withoutSelection: true } ) ).to.match(
						new RegExp(
							'<table columnWidths="100%" tableWidth="100%">' +
								'<tableRow>' +
									'<tableCell>' +
										'<table columnWidths="45\\.45%,54\\.55%" tableWidth="77\\.1[\\d]%">' +
											'<tableRow>' +
												'<tableCell>' +
													'<paragraph>foo</paragraph>' +
												'</tableCell>' +
												'<tableCell>' +
													'<paragraph>bar</paragraph>' +
												'</tableCell>' +
											'</tableRow>' +
										'</table>' +
									'</tableCell>' +
								'</tableRow>' +
							'</table>'
						)
					);
				} );

				it( 'correctly updates the widths of the columns, when any of the inside ones has been resized', () => {
					// Test-specific.
					const columnToResizeIndex = 1;
					const mouseMovementVector = { x: 10, y: 0 };

					setModelData( editor.model,
						'<table columnWidths="100%" tableWidth="100%">' +
							'<tableRow>' +
								'<tableCell>' +
									'[<table columnWidths="25%,25%,50%" tableWidth="100%">' +
										'<tableRow>' +
											'<tableCell>' +
												'<paragraph>foo</paragraph>' +
											'</tableCell>' +
											'<tableCell>' +
												'<paragraph>bar</paragraph>' +
											'</tableCell>' +
											'<tableCell>' +
												'<paragraph>baz</paragraph>' +
											'</tableCell>' +
										'</tableRow>' +
									'</table>]' +
								'</tableCell>' +
							'</tableRow>' +
						'</table>'
					);

					const modelNestedTable = model.document.selection.getSelectedElement();
					const domNestedTable = getDomTable( view ).querySelectorAll( 'table' )[ 1 ];
					const viewNestedTable = view.document.selection.getSelectedElement().getChild( 1 );

					setInitialWidthsInPx( editor, viewNestedTable, null, 300 );

					// Test-agnostic.
					const initialViewColumnWidthsPx = getViewColumnWidthsPx( domNestedTable );

					tableColumnResizeMouseSimulator.resize( editor, domNestedTable, columnToResizeIndex, mouseMovementVector, 0 );

					const finalModelColumnWidthsPc = getModelColumnWidthsPc( modelNestedTable );

					assertModelWidthsSum( finalModelColumnWidthsPc );

					const finalViewColumnWidthsPc = getViewColumnWidthsPc( viewNestedTable );

					assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

					const finalViewColumnWidthsPx = getViewColumnWidthsPx( domNestedTable );

					const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
						initialViewColumnWidthsPx,
						mouseMovementVector,
						contentDirection,
						columnToResizeIndex
					);
					assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );

					expect( getModelData( model, { withoutSelection: true } ) ).to.equal(
						'<table columnWidths="100%" tableWidth="100%">' +
							'<tableRow>' +
								'<tableCell>' +
									'<table columnWidths="25%,28.52%,46.48%" tableWidth="100%">' +
										'<tableRow>' +
											'<tableCell>' +
												'<paragraph>foo</paragraph>' +
											'</tableCell>' +
											'<tableCell>' +
												'<paragraph>bar</paragraph>' +
											'</tableCell>' +
											'<tableCell>' +
												'<paragraph>baz</paragraph>' +
											'</tableCell>' +
										'</tableRow>' +
									'</table>' +
								'</tableCell>' +
							'</tableRow>' +
						'</table>'
					);
				} );
			} );
		} );

		describe( 'right or left (RTL)', () => {
			beforeEach( async () => {
				if ( editor ) {
					await editor.destroy();
				}

				editor = await createEditor( {
					language: 'ar'
				} );

				model = editor.model;
				view = editor.editing.view;
				contentDirection = editor.locale.contentLanguageDirection;
			} );

			it( 'shrinks the first table column on dragging right', () => {
				// Test-specific.
				setModelData( model, modelTable( [
					[ '00', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '25%,25%,50%', tableWidth: '100%' } ) );

				const columnToResizeIndex = 0;
				const mouseMovementVector = { x: 10, y: 0 };

				// Test-agnostic.
				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.resize( editor, getDomTable( view ), columnToResizeIndex, mouseMovementVector );

				const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

				assertModelWidthsSum( finalModelColumnWidthsPc );

				const finalViewColumnWidthsPc = getViewColumnWidthsPc( getViewTable( view ) );

				assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
				const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
					initialViewColumnWidthsPx,
					mouseMovementVector,
					contentDirection,
					columnToResizeIndex
				);

				assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );
			} );

			it( 'expands the first table column on dragging left', () => {
				// Test-specific.
				setModelData( model, modelTable( [
					[ '00', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '25%,25%,50%', tableWidth: '100%' } ) );

				const columnToResizeIndex = 0;
				const mouseMovementVector = { x: -10, y: 0 };

				// Test-agnostic.
				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.resize( editor, getDomTable( view ), columnToResizeIndex, mouseMovementVector );

				const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

				assertModelWidthsSum( finalModelColumnWidthsPc );

				const finalViewColumnWidthsPc = getViewColumnWidthsPc( getViewTable( view ) );

				assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
				const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
					initialViewColumnWidthsPx,
					mouseMovementVector,
					contentDirection,
					columnToResizeIndex
				);

				assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );
			} );

			it( 'shrinks the last column on dragging left', () => {
				// Test-specific.
				const columnToResizeIndex = 2;
				const mouseMovementVector = { x: 10, y: 0 };

				setModelData( model, modelTable( [
					[ '00', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '25%,25%,50%', tableWidth: '100%' } ) );

				// Test-agnostic.
				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.resize( editor, getDomTable( view ), columnToResizeIndex, mouseMovementVector );

				const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

				assertModelWidthsSum( finalModelColumnWidthsPc );

				const finalViewColumnWidthsPc = getViewColumnWidthsPc( getViewTable( view ) );

				assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
				const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
					initialViewColumnWidthsPx,
					mouseMovementVector,
					contentDirection,
					columnToResizeIndex
				);

				assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );
			} );

			it( 'does not remove column when it was shrinked to negative width', () => {
				// Test-specific.
				setModelData( model, modelTable( [
					[ '00', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '20%,25%,55%', tableWidth: '100%' } ) );

				const columnToResizeIndex = 1;
				const initialColumnWidth = getColumnWidth( getDomTable( view ), columnToResizeIndex );
				const mouseMovementVector = { x: initialColumnWidth * 1.05, y: 0 };

				// Test-agnostic.
				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.resize( editor, getDomTable( view ), columnToResizeIndex, mouseMovementVector );

				const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

				assertModelWidthsSum( finalModelColumnWidthsPc );

				const finalViewColumnWidthsPc = getViewColumnWidthsPc( getViewTable( view ) );

				assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
				const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
					initialViewColumnWidthsPx,
					mouseMovementVector,
					contentDirection,
					columnToResizeIndex
				);

				assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );

				expect( view.document.getRoot()
					.getChild( 0 ) // figure
					.getChild( 1 ) // table
					.getChild( 1 ) // tbody
					.getChild( 0 ) // tr
					.childCount
				).to.equal( 3 );
			} );

			it( 'does not remove column when adjacent column was expanded over it', () => {
				// Test-specific.
				setModelData( model, modelTable( [
					[ '00', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '20%,25%,55%', tableWidth: '100%' } ) );

				const columnToResizeIndex = 0;
				const initialColumnWidth = getColumnWidth( getDomTable( view ), columnToResizeIndex );
				const mouseMovementVector = { x: -( initialColumnWidth * 1.05 ), y: 0 };

				// Test-agnostic.
				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.resize( editor, getDomTable( view ), columnToResizeIndex, mouseMovementVector );

				const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

				assertModelWidthsSum( finalModelColumnWidthsPc );

				const finalViewColumnWidthsPc = getViewColumnWidthsPc( getViewTable( view ) );

				assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
				const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
					initialViewColumnWidthsPx,
					mouseMovementVector,
					contentDirection,
					columnToResizeIndex
				);

				assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );
			} );
		} );

		describe( 'if cursor was moved outside the table', () => {
			it( 'resizes correctly if cursor was placed above the table', () => {
				// Test-specific.
				setModelData( model, modelTable( [
					[ '00', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '20%,25%,55%', tableWidth: '100%' } ) );

				const columnToResizeIndex = 0;
				const cellRect = getDomTableCellRects( getDomTable( view ), columnToResizeIndex );
				const mouseMovementVector = { x: 10, y: -( cellRect.height ) };

				// Test-agnostic.
				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.resize( editor, getDomTable( view ), columnToResizeIndex, mouseMovementVector );

				const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

				assertModelWidthsSum( finalModelColumnWidthsPc );

				const finalViewColumnWidthsPc = getViewColumnWidthsPc( getViewTable( view ) );

				assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
				const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
					initialViewColumnWidthsPx,
					mouseMovementVector,
					contentDirection,
					columnToResizeIndex
				);

				assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );
			} );

			it( 'resizes correctly if cursor was placed under the table', () => {
				// Test-specific.
				setModelData( model, modelTable( [
					[ '00', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '20%,25%,55%', tableWidth: '100%' } ) );

				const columnToResizeIndex = 0;
				const tableRect = getDomTableRects( getDomTable( view ) );
				const mouseMovementVector = { x: 10, y: tableRect.height };

				// Test-agnostic.
				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.resize( editor, getDomTable( view ), columnToResizeIndex, mouseMovementVector );

				const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

				assertModelWidthsSum( finalModelColumnWidthsPc );

				const finalViewColumnWidthsPc = getViewColumnWidthsPc( getViewTable( view ) );

				assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
				const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
					initialViewColumnWidthsPx,
					mouseMovementVector,
					contentDirection,
					columnToResizeIndex
				);

				assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );
			} );

			it( 'resizes correctly if cursor was placed outside left table border', () => {
				// Test-specific.
				setModelData( model, modelTable( [
					[ '00', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '20%,25%,55%', tableWidth: '100%' } ) );

				const columnToResizeIndex = 0;
				const cellRect = getDomTableCellRects( getDomTable( view ), columnToResizeIndex );
				const mouseMovementVector = { x: -( cellRect.width + 20 ), y: 0 };

				// Test-agnostic.
				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.resize( editor, getDomTable( view ), columnToResizeIndex, mouseMovementVector );

				const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

				assertModelWidthsSum( finalModelColumnWidthsPc );

				const finalViewColumnWidthsPc = getViewColumnWidthsPc( getViewTable( view ) );

				assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
				const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
					initialViewColumnWidthsPx,
					mouseMovementVector,
					contentDirection,
					columnToResizeIndex
				);

				assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );
			} );

			it( 'resizes correctly if cursor was placed outside right table border', () => {
				// Test-specific.
				setModelData( model, modelTable( [
					[ '00', '01', '02' ],
					[ '10', '11', '12' ]
				], { columnWidths: '20%,25%,55%', tableWidth: '100%' } ) );

				const columnToResizeIndex = 1;
				// We need the width of the last cell to move the cursor beyond it.
				const cellRect = getDomTableCellRects( getDomTable( view ), 2 );
				const mouseMovementVector = { x: ( cellRect.width + 40 ), y: 0 };

				// Test-agnostic.
				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );

				tableColumnResizeMouseSimulator.resize( editor, getDomTable( view ), columnToResizeIndex, mouseMovementVector );

				const finalModelColumnWidthsPc = getModelColumnWidthsPc( getModelTable( model ) );

				assertModelWidthsSum( finalModelColumnWidthsPc );

				const finalViewColumnWidthsPc = getViewColumnWidthsPc( getViewTable( view ) );

				assertModelViewSync( finalModelColumnWidthsPc, finalViewColumnWidthsPc );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( view ) );
				const expectedViewColumnWidthsPx = calculateExpectedWidthPixels(
					initialViewColumnWidthsPx,
					mouseMovementVector,
					contentDirection,
					columnToResizeIndex
				);

				assertViewPixelWidths( finalViewColumnWidthsPx, expectedViewColumnWidthsPx );
			} );
		} );
	} );

	describe( 'in integration with', () => {
		describe.skip( 'undo', () => {

		} );

		describe( 'table', () => {
			describe( 'structure manipulation', () => {
				describe( 'should adjust attributes in model', () => {
					it( 'when new column was inserted', () => {
						setModelData( model, modelTable( [
							[ '00[]', '01', '02' ],
							[ '10', '11', '12' ]
						], { columnWidths: '20%,25%,55%' } ) );

						editor.commands.get( 'insertTableColumnLeft' ).execute();

						const wholeContentRange = model.createRangeIn( model.document.getRoot() );

						for ( const item of wholeContentRange ) {
							// Expect `columnWidths` to have 4 values.
							if ( item.item.is( 'element', 'table' ) ) {
								expect( item.item.getAttribute( 'columnWidths' ).split( ',' ).length ).to.equal( 4 );
							}
							// Expect the cell containing text '00' to have index 1 instead of 0.
							else if ( item.item.is( 'element', 'tableCell' ) && item.item.getChild( 0 ).getChild( 0 ) ) {
								const text = item.item.getChild( 0 ).getChild( 0 ).data;

								if ( text == '00' ) {
									expect( getColumnIndex( item.item, editor )	).to.equal( 1 );
								}
							}
						}
					} );

					it( 'when column was removed', () => {
						setModelData( model, modelTable( [
							[ '00[]', '01', '02' ],
							[ '10', '11', '12' ]
						], { columnWidths: '20%,25%,55%' } ) );

						editor.execute( 'removeTableColumn' );

						const wholeContentRange = model.createRangeIn( model.document.getRoot() );

						for ( const item of wholeContentRange ) {
							// Expect `columnWidths` to have 2 values and the first column to take over the width of removed one.
							if ( item.item.is( 'element', 'table' ) ) {
								const columnWidths = item.item.getAttribute( 'columnWidths' ).split( ',' );
								expect( columnWidths.length ).to.equal( 2 );
								expect( columnWidths[ 0 ] ).to.equal( '45%' );
							}
							// Expect the cell containing text '01' to have index 0 instead of 1.
							else if ( item.item.is( 'element', 'tableCell' ) && item.item.getChild( 0 ).getChild( 0 ) ) {
								const text = item.item.getChild( 0 ).getChild( 0 ).data;

								if ( text == '01' ) {
									expect(	getColumnIndex( item.item, editor )	).to.equal( 0 );
								}
							}
						}
					} );

					it( 'when two columns were merged', () => {
						setModelData( model, modelTable( [
							[ '00', '01', '02' ],
							[ '10', '11', '12' ]
						], { columnWidths: '20%,25%,55%' } ) );

						selectNodes( model, [
							[ 0, 0, 0 ],
							[ 0, 1, 0 ],
							[ 0, 0, 1 ],
							[ 0, 1, 1 ]
						] );

						editor.execute( 'mergeTableCells' );

						const wholeContentRange = model.createRangeIn( model.document.getRoot() );

						for ( const item of wholeContentRange ) {
							// Expect `columnWidths` to have 2 values and the first column to take over the width of merged one.
							if ( item.item.is( 'element', 'table' ) ) {
								const columnWidths = item.item.getAttribute( 'columnWidths' ).split( ',' );
								expect( columnWidths.length ).to.equal( 2 );
								expect( columnWidths[ 0 ] ).to.equal( '45%' );
							}
							// There should not be a cell with columnIndex='2'.
							else if ( item.item.is( 'element', 'tableCell' ) ) {
								const index = getColumnIndex( item.item, editor );
								expect( index ).not.to.equal( 2 );
							}
						}
					} );
				} );

				describe( 'should not adjust `columnWidths` attribute in model', () => {
					it( 'when only some cells from two columns were merged', () => {
						setModelData( model, modelTable( [
							[ '00', '01', '02' ],
							[ '10', '11', '12' ]
						], { columnWidths: '20%,25%,55%' } ) );

						selectNodes( model, [
							[ 0, 0, 0 ],
							[ 0, 0, 1 ]
						] );

						editor.execute( 'mergeTableCells' );

						const wholeContentRange = model.createRangeIn( model.document.getRoot() );

						for ( const item of wholeContentRange ) {
							// Expect `columnWidths` to have 3 unchanged values.
							if ( item.item.is( 'element', 'table' ) ) {
								const columnWidths = item.item.getAttribute( 'columnWidths' ).split( ',' );
								expect( columnWidths.length ).to.equal( 3 );
								expect( columnWidths[ 0 ] ).to.equal( '20%' );
								expect( columnWidths[ 1 ] ).to.equal( '25%' );
								expect( columnWidths[ 2 ] ).to.equal( '55%' );
							}
						}
					} );
				} );

				describe( 'should not remove colgroup', () => {
					it( 'after pasting a table that increases number of rows and columns at the same time', () => {
						setModelData( model, modelTable( [
							[ '00', '01' ],
							[ '10', '[11]' ]
						], { columnWidths: '50%,50%' } ) );

						model.change( () => {
							editor.execute( 'insertTableRowBelow' );
							editor.execute( 'insertTableColumnRight' );
						} );

						const tableView = view.document.getRoot().getChild( 0 ).getChild( 1 );

						expect( [ ...tableView.getChildren() ].find(
							viewElement => viewElement.is( 'element', 'colgroup' ) )
						).to.not.be.undefined;
					} );
				} );
			} );

			describe( 'tableWidth attribute', () => {
				it( 'should not be set initially when creating a table', () => {
					setModelData( model, modelTable( [
						[ '00', '01', '02' ]
					], { columnWidths: '20%,25%,55%' } ) );

					expect( getModelData( model ) ).to.equal(
						'[<table columnWidths="20%,25%,55%">' +
							'<tableRow>' +
								'<tableCell>' +
									'<paragraph>00</paragraph>' +
								'</tableCell>' +
								'<tableCell>' +
									'<paragraph>01</paragraph>' +
								'</tableCell>' +
								'<tableCell>' +
									'<paragraph>02</paragraph>' +
								'</tableCell>' +
							'</tableRow>' +
						'</table>]'
					);
				} );

				it( 'should be set if table was initiated with a tableWidth value', () => {
					setModelData( model, modelTable( [ [ '[]foo' ] ], { tableWidth: '100px' } ) );

					expect( getModelData( editor.model ) ).to.equal(
						'<table tableWidth="100px">' +
							'<tableRow>' +
								'<tableCell>' +
									'<paragraph>[]foo</paragraph>' +
								'</tableCell>' +
							'</tableRow>' +
						'</table>'
					);
				} );

				it( 'should be added to the table after the last column has been resized', () => {
					const columnToResizeIndex = 2;
					const mouseMovementVector = { x: 10, y: 0 };

					setModelData( model, modelTable( [
						[ '00', '01', '02' ]
					] ) );

					setInitialWidthsInPx( editor, null, null, 300 );

					tableColumnResizeMouseSimulator.resize( editor, getDomTable( view ), columnToResizeIndex, mouseMovementVector );

					expect( getModelData( model, { withoutSelection: true } ) ).to.match(
						new RegExp(
							'<table columnWidths="29\\.1%,29\\.1%,41\\.8%" tableWidth="52\\.4[\\d]%">' +
								'<tableRow>' +
									'<tableCell>' +
										'<paragraph>00</paragraph>' +
									'</tableCell>' +
									'<tableCell>' +
										'<paragraph>01</paragraph>' +
									'</tableCell>' +
									'<tableCell>' +
										'<paragraph>02</paragraph>' +
									'</tableCell>' +
								'</tableRow>' +
							'</table>'
						)
					);
				} );

				it( 'is updated correctly after the last column has been resized', () => {
					const columnToResizeIndex = 2;
					const mouseMovementVector = { x: 10, y: 0 };

					setModelData( model, modelTable( [
						[ '00', '01', '02' ]
					], { tableWidth: '100px', columnWidths: '25%,25%,50%' } ) );

					setInitialWidthsInPx( editor, null, 201, 300 );

					tableColumnResizeMouseSimulator.resize( editor, getDomTable( view ), columnToResizeIndex, mouseMovementVector );

					expect( getModelData( editor.model ) ).to.equal(
						'[<table columnWidths="22.73%,22.73%,54.54%" tableWidth="73.33%">' +
							'<tableRow>' +
								'<tableCell>' +
									'<paragraph>00</paragraph>' +
								'</tableCell>' +
								'<tableCell>' +
									'<paragraph>01</paragraph>' +
								'</tableCell>' +
								'<tableCell>' +
									'<paragraph>02</paragraph>' +
								'</tableCell>' +
							'</tableRow>' +
						'</table>]'
					);
				} );

				it( 'does not change when one of the middle columns is resized', () => {
					const columnToResizeIndex = 1;
					const mouseMovementVector = { x: 10, y: 0 };

					setModelData( model, modelTable( [
						[ '[00', '01', '02]' ]
					], { tableWidth: '40%', columnWidths: '25%,25%,50%' } ) );

					tableColumnResizeMouseSimulator.resize( editor, getDomTable( view ), columnToResizeIndex, mouseMovementVector );

					// The actual column widths will vary depending on the screen properties.
					// In different tests it is handled by setting the particular editor and table width,
					// but here we want to make sure that once set, `tableWidth` prop doesn't change,
					// while the rest (column widths) is covered elsewhere not very important.
					expect( getModelData( model, { withoutSelection: true } ) ).to.match(
						new RegExp(
							'<table columnWidths="25%,2[\\d]\\.[\\d][\\d]%,4[\\d]\\.[\\d][\\d]%" tableWidth="40%">' +
								'<tableRow>' +
									'<tableCell>' +
										'<paragraph>00</paragraph>' +
									'</tableCell>' +
									'<tableCell>' +
										'<paragraph>01</paragraph>' +
									'</tableCell>' +
									'<tableCell>' +
										'<paragraph>02</paragraph>' +
									'</tableCell>' +
								'</tableRow>' +
							'</table>'
						)
					);
				} );
			} );

			describe( 'should not crash', () => {
				let model, editor, editorElement;

				beforeEach( async () => {
					editorElement = document.createElement( 'div' );
					document.body.appendChild( editorElement );

					editor = await createEditor(
						{ table: { contentToolbar: [ 'toggleTableCaption' ] } },
						[ LinkEditing, HighlightEditing, Bold, TableToolbar, TableCaption ]
					);
					model = editor.model;
				} );

				afterEach( async () => {
					if ( editorElement ) {
						editorElement.remove();
					}

					if ( editor ) {
						await editor.destroy();
					}
				} );

				it( 'when link is being removed', () => {
					const linkCommand = editor.commands.get( 'link' );
					const unlinkCommand = editor.commands.get( 'unlink' );

					setModelData( model,
						'<table columnWidths="100%">' +
							'<tableRow>' +
								'<tableCell>' +
									'<paragraph>' +
										'[<$text linkHref="url">foo</$text>]' +
									'</paragraph>' +
								'</tableCell>' +
							'</tableRow>' +
						'</table>'
					);

					expect( linkCommand.value ).to.be.equal( 'url' );

					unlinkCommand.execute();

					expect( getModelData( model ) ).to.equal(
						'<table columnWidths="100%">' +
							'<tableRow>' +
								'<tableCell>' +
									'<paragraph>[foo]</paragraph>' +
								'</tableCell>' +
							'</tableRow>' +
						'</table>'
					);
				} );

				it( 'when highlight is being removed', () => {
					const highlightCommand = editor.commands.get( 'highlight' );

					setModelData( model,
						'<table columnWidths="100%">' +
							'<tableRow>' +
								'<tableCell>' +
									'<paragraph>' +
										'[<$text highlight="greenMarker">foo</$text>]' +
									'</paragraph>' +
								'</tableCell>' +
							'</tableRow>' +
						'</table>'
					);

					expect( highlightCommand.value ).to.equal( 'greenMarker' );

					highlightCommand.execute();

					expect( getModelData( model ) ).to.equal(
						'<table columnWidths="100%">' +
							'<tableRow>' +
								'<tableCell>' +
									'<paragraph>[foo]</paragraph>' +
								'</tableCell>' +
							'</tableRow>' +
						'</table>'
					);
				} );

				it( 'when bold is being removed', () => {
					setModelData( model,
						'<table columnWidths="100%">' +
							'<tableRow>' +
								'<tableCell>' +
									'<paragraph>' +
										'[<$text bold="true">foo</$text>]' +
									'</paragraph>' +
								'</tableCell>' +
							'</tableRow>' +
						'</table>'
					);

					editor.commands.get( 'bold' ).execute();

					expect( getModelData( model ) ).to.equal(
						'<table columnWidths="100%">' +
							'<tableRow>' +
								'<tableCell>' +
									'<paragraph>[foo]</paragraph>' +
								'</tableCell>' +
							'</tableRow>' +
						'</table>'
					);
				} );

				it( 'when caption is being added', () => {
					const widgetToolbarRepository = editor.plugins.get( 'WidgetToolbarRepository' );
					const toolbar = widgetToolbarRepository._toolbarDefinitions.get( 'tableContent' ).view;

					setModelData( model,
						'<table columnWidths="100%">' +
							'<tableRow>' +
								'<tableCell>' +
									'<paragraph>' +
										'[foo]' +
									'</paragraph>' +
								'</tableCell>' +
							'</tableRow>' +
						'</table>'
					);

					toolbar.items.get( 0 ).fire( 'execute' );

					expect( getModelData( model ) ).to.equal(
						'<table columnWidths="100%">' +
							'<tableRow>' +
								'<tableCell>' +
									'<paragraph>foo</paragraph>' +
								'</tableCell>' +
							'</tableRow>' +
							'<caption>[]</caption>' +
						'</table>'
					);
				} );

				it( 'when table is being removed', () => {
					setModelData( model,
						'[<table columnWidths="100%" tableWidth="100%">' +
							'<tableRow>' +
								'<tableCell>' +
									'<paragraph>' +
										'foo' +
									'</paragraph>' +
								'</tableCell>' +
							'</tableRow>' +
						'</table>]'
					);

					model.deleteContent( model.document.selection );

					expect( getModelData( model ) ).to.equal( '<paragraph>[]</paragraph>' );
				} );
			} );
		} );

		describe( 'GHS', () => {
			it( 'should not filter out the <colgroup> element', async () => {
				const ghsEditor = await createEditor( {
					plugins: [ Table, TableColumnResize, Paragraph, WidgetResize, GeneralHtmlSupport ],
					htmlSupport: {
						allow: [
							{
								name: /^.*$/,
								styles: true,
								attributes: true,
								classes: true
							}
						]
					}
				} );

				ghsEditor.setData( `<figure class="table">
					<table>
						<colgroup>
							<col style="width:33.33%;">
							<col style="width:33.33%;">
							<col style="width:33.34%;">
						</colgroup>
						<tbody>
							<tr>
								<td>test</td>
								<td>&nbsp;</td>
								<td>&nbsp;</td>
							</tr>
						</tbody>
					</table>
				</figure>` );

				expect( ghsEditor.editing.view.getDomRoot().innerHTML.includes( 'data-ck-unsafe-element' ) ).to.be.false;
			} );

			it( 'should save and load data correctly', async () => {
				const ghsEditor = await createEditor( {
					plugins: [ Table, TableColumnResize, Paragraph, WidgetResize, GeneralHtmlSupport ],
					htmlSupport: {
						allow: [
							{
								name: /^.*$/,
								styles: true,
								attributes: true,
								classes: true
							}
						]
					}
				} );

				setModelData( ghsEditor.model, modelTable( [
					[ '[00', '01', '02]' ]
				], { tableWidth: '80%', columnWidths: '25%,25%,50%' } ) );

				const initialViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( ghsEditor.editing.view ) );

				ghsEditor.setData( ghsEditor.getData() );

				const finalViewColumnWidthsPx = getViewColumnWidthsPx( getDomTable( ghsEditor.editing.view ) );

				expect( initialViewColumnWidthsPx ).to.deep.equal( finalViewColumnWidthsPx );
			} );
		} );
	} );

	async function createEditor( configCustomization, additionalPlugins ) {
		const plugins = [ Table, TableColumnResize, TableColumnResizeEditing, Paragraph, WidgetResize ];

		if ( additionalPlugins ) {
			plugins.push( ...additionalPlugins );
		}

		const newEditor = await ClassicEditor.create( editorElement, Object.assign( {}, {
			plugins
		}, configCustomization ) );

		await focusEditor( newEditor );

		return newEditor;
	}

	function selectNodes( model, paths ) {
		const root = model.document.getRoot( 'main' );

		model.change( writer => {
			const ranges = paths.map( path => writer.createRangeOn( root.getNodeByPath( path ) ) );

			writer.setSelection( ranges );
		} );
	}

	function assertModelViewSync( modelColumnWidths, viewColumnWidths ) {
		expect( modelColumnWidths ).to.be.deep.equal( viewColumnWidths );
	}

	function assertViewPixelWidths( finalViewWidths, expectedViewWidths ) {
		for ( let i = 0; i < finalViewWidths.length; i++ ) {
			// We can't use `expect( finalViewWidths[ i ] ).to.equal( expectedViewWidths[ i ] )`
			// because we need to tolerate some error margin.
			expect(
				Math.abs( finalViewWidths[ i ] - expectedViewWidths[ i ] ) < PIXEL_PRECISION,
				'column ' + i + ' has width ' + finalViewWidths[ i ] + ' instead of ' + expectedViewWidths[ i ]
			).to.be.true;
		}
	}

	function assertModelWidthsSum( columnWidths ) {
		const widthsSum = columnWidths.reduce( ( sum, element ) => {
			sum += Number( element );

			return sum;
		}, 0 );

		expect( ( Math.abs( 100 - widthsSum ) ) < PERCENTAGE_PRECISION, 'Models widths dont sum up well' ).to.be.true;
	}

	function calculateExpectedWidthPixels( initialWidths, vector, contentDirection, columnIndex ) {
		const resultingWidths = initialWidths.slice();

		// resultingWidths[ columnIndex ] = Math.max(
		// 	resultingWidths[ columnIndex ] + ( contentDirection == 'ltr' ? vector.x : -vector.x ),
		// 	COLUMN_MIN_WIDTH_IN_PIXELS
		// );
		resultingWidths[ columnIndex ] = clamp(
			resultingWidths[ columnIndex ] + ( contentDirection == 'ltr' ? vector.x : -vector.x ),
			COLUMN_MIN_WIDTH_IN_PIXELS,
			// Seemingly complex logic but it just ensures that the next column is at least COLUMN_MIN_WIDTH_IN_PIXELS wide.
			resultingWidths[ columnIndex ] + resultingWidths[ columnIndex + 1 ] - COLUMN_MIN_WIDTH_IN_PIXELS
		);

		const widthChange = resultingWidths[ columnIndex ] - initialWidths[ columnIndex ];

		// If the last column is resized, it decreases the width twice as much but no other column
		// changes the size.
		if ( !resultingWidths[ columnIndex + 1 ] ) {
			resultingWidths[ columnIndex ] += widthChange;

			return resultingWidths;
		}

		// Expect the other column to shrink/expand just as much as the first one was resized.
		resultingWidths[ columnIndex + 1 ] = initialWidths[ columnIndex + 1 ] - widthChange;

		return resultingWidths;
	}

	function getColumnIndex( cell, editor ) {
		return editor.plugins.get( 'TableColumnResizeEditing' )._columnIndexMap.get( cell );
	}

	// Sets initial width in pixels to table and/or editor.
	//
	// We define table width precisely when we want to correctly predict column widths in % after resizing.
	// E.g. setting table width to 201px when we have 3 columns defined: '25%,25%,50%' causes the columns
	// to have initially: [50px][50px][100px] (the difference of 1px is important).
	// We define editor width to avoid situations where table width is 100% and we resize it by providing
	// move vector in px - this results in different widths in % depending on browser width. So to fix this
	// we set editor width so the % values don't depend on browser width anymore.
	//
	// @param {module:core/editor/editor~Editor} editor
	// @param {module:engine/view/element~Element} [viewTable]
	// @param {Number} [tableWidth]
	// @param {Number} [editorWidth]
	function setInitialWidthsInPx( editor, viewTable, tableWidth, editorWidth ) {
		const view = editor.editing.view;

		view.change( writer => {
			if ( editorWidth ) {
				const root = view.document.getRoot();
				writer.setAttribute( 'style', `width: ${ editorWidth }px;`, root );
			}

			if ( tableWidth ) {
				const figure = ( viewTable ) ? viewTable.parent : view.document.getRoot().getChild( 0 );
				writer.setAttribute( 'style', `width: ${ tableWidth }px;`, figure );
			}
		} );
	}
} );
