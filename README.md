@h5p/ckeditor5-table
====================

This package is based on the official CKEditor 5 Table package, with a few H5P specific tweaks.

## Table of contents

* [Local development of the plugin](#local-development-of-the-plugin)
* [Updating the plugin to new official CKE version](#updating-the-plugin-to-new-official-cke-version)
* [Available scripts](#available-scripts)
  * [`dll:build`](#dllbuild)
  * [`build`](#build)
* [License](#license)

## Local development of the plugin

> ⚠️ Remember to make changes to the .ts files and then compile them into .js and .d.ts files with `npm run build`

H5P uses this fork of the official CKEditor5 table plugin in the `h5p-editor-php-library` and `h5p-ckeditor` repositories. Due to the way CKEditor5 builds packages, it is not possible to use `npm link` for local development of this plugin in those repositories.Instead, either copy the changes files into the `(ckeditor5/)node_modules` folder for quick testing, or for more substantial or final changes:

1. Commit changes to a branch
2. Change the dependency in `(ckeditor5/)package.json` to `"@h5p/ckeditor5-table": "github:h5p/h5p-ckeditor-table#<branch-name>"` in the ckeditor5 folder in h5p-editor or the main folder in h5p-ckeditor.
3. Run `npm update @h5p/ckeditor5-table && npm run build` from that folder

## Updating the plugin to new official CKE version

Since CKEditor uses one big mono-repository to hold all of their plugins, it is not possible to fork just one plugin in the normal way. Updating is a bit more of a hassle, but should be fairly straightforward with these steps (remember to change tag and branch names):

```
git clone git@github.com:ckeditor/ckeditor5.git
cd ckeditor5
git checkout tags/vX.Y.Z
git subtree split --prefix=packages/ckeditor5-table -b new-cke-branch
git remote add h5p git@github.com:h5p/h5p-ckeditor-table.git
git fetch h5p
git checkout h5p/master
git checkout -b new-h5p-branch
git merge --allow-unrelated-histories new-cke-branch
```
Fix the merge conflicts. **CAREFUL not to override configs/build scripts etc.**

```
npm install && npm run build
git push -u h5p new-h5p-branch
```
Then follow the steps to [test the upgrade locally](#local-development-of-the-plugin)

## Available scripts

Npm scripts are a convenient way to provide commands in a project. They are defined in the `package.json` file and shared with other people contributing to the project. It ensures that developers use the same command with the same options (flags).

All the scripts can be executed by running `npm run <script>`. Pre and post commands with matching names will be run for those as well.

The following scripts are available in the package.

### `dll:build`

Creates a DLL-compatible package build which can be loaded into an editor using [DLL builds](https://ckeditor.com/docs/ckeditor5/latest/builds/guides/development/dll-builds.html).

Examples:

```bash
# Build the DLL file that is ready to publish.
npm run dll:build

# Build the DLL file and listen to changes in its sources.
npm run dll:build -- --watch
```

### `build`

Build the production ready package, to be loaded into the ckeditor like described above.

## License

The `@h5p/ckeditor5-table` package is available under [MIT license](https://opensource.org/licenses/MIT).
