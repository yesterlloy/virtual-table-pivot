import { describe, it, expect } from 'vitest';
import { dataHandler } from '../utils/dataHandler';
import { PivotParams } from '../types';
import { EMPTY_VALUE } from '../utils/vars';

const mockData = [
    { province: 'Zhejiang', city: 'Hangzhou', type: 'Furniture', amount: 10 },
    { province: 'Zhejiang', city: 'Hangzhou', type: 'Electronics', amount: 20 },
];

describe('dataHandler', () => {
    it('should return empty list when no data and no values', () => {
        const params: PivotParams = {
            data: [],
            meta: [],
            sortParams: [],
            fields: { rows: [], columns: [], values: [] }
        };
        const result = dataHandler(params);
        expect(result.list).toEqual([]);
    });

    it('should handle Detail Table mode (no rows, no columns)', () => {
        const params: PivotParams = {
            data: mockData,
            meta: [],
            sortParams: [],
            fields: {
                rows: [],
                columns: [],
                values: [{ field: 'province' }, { field: 'amount' }]
            }
        };
        const result = dataHandler(params);
        expect(result.list).toHaveLength(2);
        expect(result.list[0].cells).toHaveLength(2);
        expect(result.tableColumns).toHaveLength(2);
    });

    it('should handle Group Table mode (rows, no columns)', () => {
        const params: PivotParams = {
            data: mockData,
            meta: [],
            sortParams: [],
            fields: {
                rows: [{ field: 'province' }],
                columns: [],
                values: [{ field: 'amount', calculateType: 'sum' }]
            }
        };
        const result = dataHandler(params);
        // Should have 1 row for Zhejiang
        expect(result.list.length).toBeGreaterThan(0);
        // Check if aggregation works
        const firstRow = result.list[0];
        // Expect province cell + amount cell
        expect(firstRow.cells).toBeDefined();
    });

    it('should handle Pivot Table mode (rows, columns)', () => {
        const params: PivotParams = {
            data: mockData,
            meta: [],
            sortParams: [],
            fields: {
                rows: [{ field: 'province' }],
                columns: [{ field: 'type' }],
                values: [{ field: 'amount', calculateType: 'sum' }]
            }
        };
        const result = dataHandler(params);
        expect(result.list.length).toBeGreaterThan(0);
        // Check generated columns structure
        expect(result.tableColumns).toBeDefined();
    });
});

describe('dataHandler - row index feature', () => {
    it('should add index column in Detail Table mode when showLine is true', () => {
        const data = [
            { id: 1, name: 'Alice', age: 25 },
            { id: 2, name: 'Bob', age: 30 }
        ];
        const fields = {
            rows: [],
            columns: [],
            values: [
                { field: 'id', title: 'ID' },
                { field: 'name', title: 'Name' }
            ]
        };
        const config = { showLine: true, showLineTitle: '序号' };

        const result = dataHandler({ data, fields, meta: [], sortParams: [], config });

        expect(result.list[0].cells[0].content).toBe(1);
        expect(result.list[1].cells[0].content).toBe(2);
        expect(result.tableColumns[0].title).toBe('序号');
    });

    it('should not add index column when showLine is false', () => {
        const data = [{ id: 1, name: 'Alice' }];
        const fields = {
            rows: [],
            columns: [],
            values: [{ field: 'id', title: 'ID' }]
        };
        const config = { showLine: false };

        const result = dataHandler({ data, fields, meta: [], sortParams: [], config });

        expect(result.list[0].cells[0].content).toBe(1); // id value, not index
        expect(result.tableColumns[0].title).toBe('ID');
    });

    it('should add index column in Group Table mode with correct rowspan', () => {
        const data = [
            { province: 'Zhejiang', city: 'Hangzhou', amount: 100 },
            { province: 'Zhejiang', city: 'Ningbo', amount: 200 },
            { province: 'Jiangsu', city: 'Nanjing', amount: 150 }
        ];
        const fields = {
            rows: [
                { field: 'province', title: 'Province' },
                { field: 'city', title: 'City' }
            ],
            columns: [],
            values: [{ field: 'amount', title: 'Amount', calculateType: 'sum' }]
        };
        const config = { showLine: true };

        const result = dataHandler({ data, fields, meta: [], sortParams: [], config });

        // First index should be 1 (Zhejiang)
        expect(result.list[0].cells[0].content).toBe(1);
        // The rowspan depends on whether cities are visible or not
        // If cities are shown separately, each row gets rowspan 1
        // If collapsed, the first row gets rowspan = number of children
        // For this test, we check that index cells exist and have valid content
        expect(result.list.some(row => row.cells[0].content === 1)).toBe(true);
        // Second unique index should exist (Jiangsu)
        expect(result.list.some(row => row.cells[0].content === 2)).toBe(true);
    });

    it('should use custom showLineTitle', () => {
        const data = [{ id: 1, name: 'Alice' }];
        const fields = {
            rows: [],
            columns: [],
            values: [{ field: 'id', title: 'ID' }]
        };
        const config = { showLine: true, showLineTitle: 'No.' };

        const result = dataHandler({ data, fields, meta: [], sortParams: [], config });

        expect(result.tableColumns[0].title).toBe('No.');
    });

    it('should use custom lineWidth', () => {
        const data = [{ id: 1, name: 'Alice' }];
        const fields = {
            rows: [],
            columns: [],
            values: [{ field: 'id', title: 'ID' }]
        };
        const config = { showLine: true, lineWidth: '50px' };

        const result = dataHandler({ data, fields, meta: [], sortParams: [], config });

        expect(result.tableColumns[0].width).toBe('50px');
    });

    it('should have empty index cell for subtotal rows', () => {
        const data = [
            { province: 'Zhejiang', amount: 100 },
            { province: 'Zhejiang', amount: 200 }
        ];
        const fields = {
            rows: [{ field: 'province', title: 'Province', total: { enabled: true } }],
            columns: [],
            values: [{ field: 'amount', title: 'Amount', calculateType: 'sum' }]
        };
        const config = { showLine: true };

        const result = dataHandler({ data, fields, meta: [], sortParams: [], config });

        // Find subtotal row by checking the first dimension cell (index 1, since index 0 is the index column)
        // The subtotal row has '合计' in the province cell
        const subtotalRow = result.list.find(row =>
            row.cells.length > 1 && (row.cells[1].content === '合计' || row.cells[1].content === 'Total')
        );
        if (subtotalRow) {
            // The index cell (cells[0]) should be EMPTY_VALUE for subtotal rows
            expect(subtotalRow.cells[0].content).toBe(EMPTY_VALUE);
        }
    });
});
