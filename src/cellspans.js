/**
 * @license Copyright (c) 2003-2018, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

/**
 * @module table/cellspans
 */

/**
 * Holds information about spanned table cells.
 *
 * @private
 */
export default class CellSpans {
	/**
	 * Creates CellSpans instance.
	 */
	constructor() {
		/**
		 * Holds table cell spans mapping.
		 *
		 * @type {Map<Number, Number>}
		 * @private
		 */
		this._spans = new Map();
	}

	/**
	 * Returns proper column index if a current cell index is overlapped by other (has a span defined).
	 *
	 * @param {Number} row
	 * @param {Number} column
	 * @return {Number} Returns current column or updated column index.
	 */
	getAdjustedColumnIndex( row, column ) {
		let span = this._check( row, column ) || 0;

		// Offset current table cell columnIndex by spanning cells from rows above.
		while ( span ) {
			column += span;
			span = this._check( row, column );
		}

		return column;
	}

	/**
	 * Updates spans based on current table cell height & width. Spans with height <= 1 will not be recorded.
	 *
	 * For instance if a table cell at row 0 and column 0 has height of 3 and width of 2 we're setting spans:
	 *
	 *        0 1 2 3 4 5
	 *     0:
	 *     1: 2
	 *     2: 2
	 *     3:
	 *
	 * Adding another spans for a table cell at row 2 and column 1 that has height of 2 and width of 4 will update above to:
	 *
	 *        0 1 2 3 4 5
	 *     0:
	 *     1: 2
	 *     2: 2
	 *     3:   4
	 *
	 * The above span mapping was calculated from a table below (cells 03 & 12 were not added as their height is 1):
	 *
	 *     +----+----+----+----+----+----+
	 *     | 00      | 02 | 03      | 05 |
	 *     |         +--- +----+----+----+
	 *     |         | 12      | 24 | 25 |
	 *     |         +----+----+----+----+
	 *     |         | 22                |
	 *     |----+----+                   +
	 *     | 31 | 32 |                   |
	 *     +----+----+----+----+----+----+
	 *
	 * @param {Number} rowIndex
	 * @param {Number} columnIndex
	 * @param {Number} height
	 * @param {Number} width
	 */
	recordSpans( rowIndex, columnIndex, height, width ) {
		// This will update all rows below up to row height with value of span width.
		for ( let rowToUpdate = rowIndex + 1; rowToUpdate < rowIndex + height; rowToUpdate++ ) {
			if ( !this._spans.has( rowToUpdate ) ) {
				this._spans.set( rowToUpdate, new Map() );
			}

			const rowSpans = this._spans.get( rowToUpdate );

			rowSpans.set( columnIndex, width );
		}
	}

	/**
	 * Removes row from mapping.
	 *
	 * @param {Number} rowIndex
	 */
	drop( rowIndex ) {
		if ( this._spans.has( rowIndex ) ) {
			this._spans.delete( rowIndex );
		}
	}

	/**
	 * Checks if given table cell is spanned by other.
	 *
	 * @param {Number} rowIndex
	 * @param {Number} columnIndex
	 * @return {Boolean|Number} Returns false or width of a span.
	 * @private
	 */
	_check( rowIndex, columnIndex ) {
		if ( !this._spans.has( rowIndex ) ) {
			return false;
		}

		const rowSpans = this._spans.get( rowIndex );

		return rowSpans.has( columnIndex ) ? rowSpans.get( columnIndex ) : false;
	}
}
