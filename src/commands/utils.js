/**
 * @license Copyright (c) 2003-2018, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

/**
 * @module table/commands/utils
 */

/**
 * Returns the parent table. Returns undefined if position is not inside table.
 *
 * @param {module:engine/model/position~Position} position
 * @returns {module:engine/model/element~Element|module:engine/model/documentfragment~DocumentFragment}
 */
export function getParentTable( position ) {
	return getParentElement( 'table', position );
}

/**
 * Returns the parent element of given name. Returns undefined if position is not inside desired parent.
 *
 * @param {String} parentName Name of parent element to find.
 * @param {module:engine/model/position~Position} position
 * @returns {module:engine/model/element~Element|module:engine/model/documentfragment~DocumentFragment}
 */
export function getParentElement( parentName, position ) {
	let parent = position.parent;

	while ( parent ) {
		if ( parent.name === parentName ) {
			return parent;
		}

		parent = parent.parent;
	}
}

/**
 * A common method to update the numeric value. If a value is the default one, it will be unset.
 *
 * @param {String} key Attribute key.
 * @param {*} value The new attribute value.
 * @param {module:engine/model/item~Item} item Model item on which the attribute will be set.
 * @param {module:engine/model/writer~Writer} writer
 * @param {*} defaultValue Default attribute value. If a value is lower or equal, it will be unset.
 */
export function updateNumericAttribute( key, value, item, writer, defaultValue = 1 ) {
	if ( value > defaultValue ) {
		writer.setAttribute( key, value, item );
	} else {
		writer.removeAttribute( key, item );
	}
}
