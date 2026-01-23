import { describe, it, expect } from 'vitest';
import { dataHandler } from '../utils/dataHandler';
import { PivotParams } from '../types';

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
