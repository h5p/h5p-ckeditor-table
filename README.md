@h5p/ckeditor5-table
====================

This package is based on the official CKEditor 5 Table package, with a few H5P specific tweaks.

## Table of contents

* [Changes introduced in the H5P version](#changes-introduced-in-the-h5p-version)
* [Local development of the plugin](#local-development-of-the-plugin)
* [Updating the plugin to new official CKE version](#updating-the-plugin-to-new-official-cke-version)
* [Available scripts](#available-scripts)
  * [`dll:build`](#dllbuild)
  * [`build`](#build)
* [License](#license)

## Changes introduced in the H5P version
Most of the code is unchanged, except for the following changes

### Underline style ([JI-5366](https://h5ptechnology.atlassian.net/browse/JI-5366))
To match the old style of tables from when we used CKE4, we've added a custom border style called "Underline"

**Affected files:**
* `src/utils/ui/table-properties.ts`
* All language files

### Table width change prevention ([JI-5880](https://h5ptechnology.atlassian.net/browse/JI-5880))
Tables look different in the editor vs, the view, because the width is in pixels. We've added a helper function and set max width to avoid this.

**Affected files:**
* `src/tablecolumnresize/tablecolumnresizeediting.ts`
* `src/tablecolumnresize/tablewidthscommand.ts`
* `src/tablecolumnresize/utils.ts` - Helper functions getTableWidthInEms & getElementWidthInEms

### Prevent overflow of nested tables ([JI-5366](https://h5ptechnology.atlassian.net/browse/JI-5366))
Nested tables were overflowing their parents, so we added a fix for that.

**Affected files:**
* `src/tablecolumnresize/tablecolumnresizeediting.ts`
* `src/tablecolumnresize/tablewidthscommand.ts`

### Balloon positions ([JI-5884](https://h5ptechnology.atlassian.net/browse/JI-5884))
The balloon menus don't always fit the narrow H5P editor/Free Text Question, so we added two other positions (without arrows)

**Affected files:**
* `src/utils/ui/contextualballoon.ts`

### Other differences
Other files have also been changed to be able to build and use it outside of the CKE mono-repo

**Affected files:**
* `package.json`
* `README.md`
* `tsconfig.json`
* `webpack.config.js`
* Generated files as a result of other changes (e.g. package-lock.json, build files)

## Local development of the plugin

> ⚠️ Remember to make changes to the .ts files and then compile them into .js and .d.ts files with `npm run build`

H5P uses this fork of the official CKEditor5 table plugin in the `h5p-editor-php-library` and `h5p-ckeditor` repositories. Due to the way CKEditor5 builds packages, it is not possible to use `npm link` for local development of this plugin in those repositories. Instead, you can use one of two methods:

### Quick debugging of small changes

When you're making small changes or debugging and don't want to commit every console.log(), you can copy the changes made in the .ts files from this folder into the temporary files in the `(ckeditor5/)node_modules` folder.

### For bigger/final changes, existing branches and code reviews

When you want to test bigger changes, build-related changes or are finalizing/reviewing a pr, use this more robust method instead. If you're reviewing or testing out an existing branch, skip step 1.

1. Commit changes to a branch
2. Change the dependency in `(ckeditor5/)package.json` to `"@h5p/ckeditor5-table": "github:h5p/h5p-ckeditor-table#<branch-name>"`
3. Run `npm update @h5p/ckeditor5-table && npm run build` from that folder
4. (H5P.CKEditor (e.g. for FreeTextQuestion) might have to be packed and uploaded instead of updated through a symlink for some setups)

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
Fix the merge conflicts. **CAREFUL not to override configs/build scripts etc.** See [Changes introduced in the H5P version](#changes-introduced-in-the-h5p-version) to avoid reverting an intentional fix when solving merge conflicts.

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

The `@h5p/ckeditor5-table` package, as a fork of the offical CKEditor plugin, is available under the [GNU General Public License Version 2 or later](https://www.gnu.org/licenses/gpl.html),
