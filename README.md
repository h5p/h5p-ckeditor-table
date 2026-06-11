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

### `build`

Build the production ready package, to be loaded into the ckeditor like described above.

### `test`

Allows executing unit tests for the package specified in the `tests/` directory. To check the code coverage, add the `--coverage` modifier. See other [CLI flags](https://vitest.dev/guide/cli.html) in Vitest.

Examples:

```bash
# Execute tests.
npm run test

# Generate code coverage report after each change in the sources.
npm run test -- --coverage
```

### `lint`

Runs ESLint, which analyzes the code (all `*.ts` files) to quickly find problems.

Examples:

```bash
# Execute eslint.
npm run lint

# Auto-fix problems.
npm run lint -- --fix
```

### `stylelint`

Similar to the `lint` task, stylelint analyzes the CSS code (`*.css` files in the `theme/` directory) in the package.

Examples:

```bash
# Execute stylelint.
npm run stylelint
```

### `translations:synchronize`

Synchronizes translation messages (arguments of the `t()` function) by performing the following steps:

 * Collect all translation messages from the package by finding `t()` calls in source files.
 * Detect if translation context is valid, i.e. whether the provided values do not interfere with the values specified in the `@ckeditor/ckeditor5-core` package.
 * If there are no validation errors, update all translation files (`*.po` files) to be in sync with the context file:
   * unused translation entries are removed,
   * missing translation entries are added with empty string as the message translation,
   * missing translation files are created for languages that do not have own `*.po` file yet.

The task may end with an error if one of the following conditions is met:

* Found the `Unused context` error &ndash; entries specified in the `lang/contexts.json` file are not used in source files. They should be removed.
* Found the `Duplicated contex` error &ndash; some of the entries are duplicated. Consider removing them from the `lang/contexts.json` file, or rewriting them.
* Found the `Missing context` error &ndash; entries specified in source files are not described in the `lang/contexts.json` file. They should be added.

Examples:

```bash
npm run translations:synchronize
```

### `translations:validate`

Peforms only validation steps as described in [`translations:synchronize`](#translationssynchronize) script, but without modifying any files. It only checks the correctness of the context file against the `t()` function calls.

Examples:

```bash
npm run translations:validate
```

## License

The `@h5p/ckeditor5-table` package, as a fork of the offical CKEditor plugin, is available under the [GNU General Public License Version 2 or later](https://www.gnu.org/licenses/gpl.html),
