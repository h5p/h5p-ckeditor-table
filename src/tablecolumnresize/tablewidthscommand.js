/**
 * @license Copyright (c) 2003-2024, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */
import { Command } from 'ckeditor5/src/core.js';
import { getTableWidthInEms, normalizeColumnWidths } from './utils.js';
import TableWalker from './../tablewalker.js';
/**
 * Command used by the {@link module:table/tablecolumnresize~TableColumnResize Table column resize feature} that
 * updates the width of the whole table as well as its individual columns.
 */
export default class TableWidthsCommand extends Command {
    /**
     * @inheritDoc
     */
    refresh() {
        // The command is always enabled as it doesn't care about the actual selection - table can be resized
        // even if the selection is elsewhere.
        this.isEnabled = true;
    }
    /**
     * Updated the `tableWidth` attribute of the table and the `columnWidth` attribute of the columns of that table.
     */
    execute(options = {}) {
        const { model, plugins } = this.editor;
        let { table = model.document.selection.getSelectedElement(), columnWidths, tableWidth } = options;
        if (columnWidths) {
            // For backwards compatibility, columnWidths might be an array or a string of comma-separated values.
            columnWidths = Array.isArray(columnWidths) ?
                columnWidths :
                columnWidths.split(',');
        }
        model.change(writer => {
            var _a;
            const tableWalker = new TableWalker(table, { includeAllSlots: true });
            const childTables = [];
            for (const tableSlot of tableWalker) {
                childTables.push(...Array.from(tableSlot.cell.getChildren())
                    .filter(child => child.getAttribute('name') === 'table'));
            }
            if (tableWidth) {
                writer.setAttribute('tableWidth', tableWidth, table);
                // Prevent overflow for nested tables
                if ((_a = table.findAncestor('table')) === null || _a === void 0 ? void 0 : _a.getAttribute('tableWidth')) {
                    writer.setAttribute('maxWidth', '100%', table);
                }
                for (const child of childTables) {
                    writer.setAttribute('maxWidth', '100%', child);
                }
                writer.setAttribute('tableWidth', getTableWidthInEms(table, this.editor) + 'em', table);
            }
            else {
                writer.removeAttribute('tableWidth', table);
                for (const child of childTables) {
                    writer.removeAttribute('maxWidth', child);
                }
            }
            const tableColumnGroup = plugins
                .get('TableColumnResizeEditing')
                .getColumnGroupElement(table);
            if (!columnWidths && !tableColumnGroup) {
                return;
            }
            if (!columnWidths) {
                return writer.remove(tableColumnGroup);
            }
            const widths = normalizeColumnWidths(columnWidths);
            if (!tableColumnGroup) {
                const colGroupElement = writer.createElement('tableColumnGroup');
                widths.forEach(columnWidth => writer.appendElement('tableColumn', { columnWidth }, colGroupElement));
                writer.append(colGroupElement, table);
            }
            else {
                Array
                    .from(tableColumnGroup.getChildren())
                    .forEach((column, index) => writer.setAttribute('columnWidth', widths[index], column));
            }
        });
    }
}
