import pivotDataHandler from './pivotHandler';
import { PivotParams, DataCell, TableRow } from '@/types';
import { EMPTY_VALUE } from './vars';

export const dataHandler = (params: PivotParams) => {
    const { data, fields, config } = params;
    const { rows, columns, values } = fields;

    // d: 值如果为空，则整个表格不显示
    if (!values || values.length === 0) {
        return { list: [], dataExpandFilter: (l: any) => l };
    }

    if (!data || data.length === 0) {
        return { list: [], dataExpandFilter: (l: any) => l };
    }

    // a: Detail Table (rows and columns are empty)
    if (rows.length === 0 && columns.length === 0) {
        // Filter out hidden values
        const visibleValues = values.filter(v => !v.hidden);

        // Use 'values' as the columns to display
        const tableColumns: any[] = visibleValues.map(v => ({
             ...v,
             width: v.width || 100,
             key: v.field
        }));

        // Add index column if enabled
        if (config?.showLine) {
            tableColumns.unshift({
                field: '__row_index__',
                title: config.showLineTitle || '序号',
                width: config.lineWidth || '70px',
                key: '__row_index__'
            } as any);
        }

        const bodyRows: TableRow[] = data.map((record, index) => {
            const cells: DataCell[] = [];

            // Add index cell if enabled
            if (config?.showLine) {
                cells.push({
                    content: index + 1,
                    rowspan: 1,
                    colspan: 1
                });
            }

            visibleValues.forEach(v => {
                const content = record[v.field] ?? EMPTY_VALUE;
                cells.push({
                    content: content,
                    rowspan: 1,
                    colspan: 1,
                    style: v.style,
                    data: record // Pass original record for detail view cells
                });
            });
            return { cells, rowKey: index.toString() };
        });

        return {
            list: bodyRows,
            dataExpandFilter: (l: any[]) => l,
            tableColumns
        };
    }

    // b: Group Table (columns empty) -> Handled by pivotDataHandler (rows only)
    // c: Pivot Table (rows & columns exist) -> Handled by pivotDataHandler

    return pivotDataHandler(params);
}
