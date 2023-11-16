'use strict';

/* eslint-env node */

const { builds } = require( '@ckeditor/ckeditor5-dev-utils' );
const webpack = require( 'webpack' );

module.exports = builds.getDllPluginWebpackConfig( webpack, {
	themePath: require.resolve( '@ckeditor/ckeditor5-theme-lark' ),
	packagePath: __dirname,
	manifestPath: require.resolve( 'ckeditor5/build/ckeditor5-dll.manifest.json' ),
	isDevelopmentMode: process.argv.includes( '--mode=development' ),
	tsconfigPath: require.resolve( './tsconfig.json' )
} );