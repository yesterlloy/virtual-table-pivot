import { describe, it, expect } from 'vitest';
import pivotDataHandler from './pivotHandler';
import { PivotParams, MetricNode } from '@/types';

const mockData = [
    { province: 'Zhejiang', city: 'Hangzhou', type: 'Furniture', amount: 10 },
    { province: 'Zhejiang', city: 'Ningbo', type: 'Furniture', amount: 20 },
    { province: 'Jiangsu', city: 'Nanjing', type: 'Electronics', amount: 30 },
];

describe('pivotDataHandler', () => {
    it('should handle basic pivot table', () => {
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
        const result = pivotDataHandler(params);
        expect(result.list).toBeDefined();
        expect(result.list.length).toBeGreaterThan(0);
    });

    it('should respect hidden metrics', () => {
        const params: PivotParams = {
            data: mockData,
            meta: [],
            sortParams: [],
            fields: {
                rows: [{ field: 'province' }],
                columns: [],
                values: [
                    { field: 'amount', calculateType: 'sum' },
                    { field: 'amount', calculateType: 'count', hidden: true }
                ]
            }
        };
        const result = pivotDataHandler(params);
        // Row dimensions (1) + Values (1 visible) = 2 columns
        // Note: If no columns are defined, values are added as flat columns
        expect(result.tableColumns).toBeDefined();
        if (result.tableColumns) {
            expect(result.tableColumns.length).toBe(2);
            // Use type assertion to access calculateType which exists on MetricNode
            const metricCol = result.tableColumns[1] as MetricNode;
            expect(metricCol.calculateType).toBe('sum');
        }
    });

    it('should respect collapsed state for dimensions', () => {
        const params: PivotParams = {
            data: mockData,
            meta: [],
            sortParams: [],
            fields: {
                rows: [{ field: 'province', collapsed: true }, { field: 'city' }],
                columns: [],
                values: [{ field: 'amount', calculateType: 'sum' }]
            }
        };
        const result = pivotDataHandler(params);
        
        // Initial list contains all rows (including children)
        // dataExpandFilter applies visibility based on expandState
        const filteredList = result.dataExpandFilter(result.list);
        
        // Should only show top level rows (Province), cities should be hidden
        // Provinces: Zhejiang, Jiangsu (2 rows)
        // If expanded, would show cities too (Zhejiang has 2 cities, Jiangsu has 1).
        // Total rows if fully expanded: 2 (province) + 2 (Hangzhou, Ningbo) + 1 (Nanjing) = 5 rows
        // With collapsed: true on province, cities are hidden.
        expect(filteredList.length).toBe(2);
    });

    it('should generate correct column header keys for column dimensions', () => {
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
        const result = pivotDataHandler(params);
        // Check column config keys
        const columns = result.tableColumns;

        expect(columns).toBeDefined();
        if (columns) {
            // columns[0] is row dimension (province)
            // Subsequent columns are from column dimensions
            // Find column for 'Furniture'
            const furnitureCol = columns.find(c => c.title === 'Furniture');
            expect(furnitureCol).toBeDefined();
            // The field should now be prefixed with dimension field name: "type__Furniture"
            expect(furnitureCol?.field).toBe('type__Furniture');

            const electronicsCol = columns.find(c => c.title === 'Electronics');
            expect(electronicsCol).toBeDefined();
            expect(electronicsCol?.field).toBe('type__Electronics');
        }
    });

    it('should not merge row dimensions when parent dimension changes', () => {
        // Test data: same city name under different provinces
        const testData = [
            { province: 'Zhejiang', city: 'New District', amount: 10 },
            { province: 'Zhejiang', city: 'Old District', amount: 20 },
            { province: 'Jiangsu', city: 'New District', amount: 30 }, // Same city name as Zhejiang
            { province: 'Jiangsu', city: 'Industrial District', amount: 40 },
        ];

        const params: PivotParams = {
            data: testData,
            meta: [],
            sortParams: [],
            fields: {
                rows: [{ field: 'province' }, { field: 'city' }],
                columns: [],
                values: [{ field: 'amount', calculateType: 'sum' }]
            }
        };
        const result = pivotDataHandler(params);
        const filteredList = result.dataExpandFilter(result.list);

        // Should have 4 rows total (no merging when parent changes)
        // Sorted order: Jiangsu comes before Zhejiang alphabetically
        // Jiangsu - Industrial District
        // Jiangsu - New District
        // Zhejiang - New District
        // Zhejiang - Old District
        expect(filteredList.length).toBe(4);

        // Check that city cells are NOT merged across different provinces
        // Find the row where province is Jiangsu and city is New District
        const jiangsuNewDistrictRow = filteredList.find(row =>
            row.cells[0].content === 'Jiangsu' && row.cells[1].content === 'New District'
        );
        expect(jiangsuNewDistrictRow).toBeDefined();

        // This city cell should have rowspan 1 (not merged with other cities)
        if (jiangsuNewDistrictRow) {
            expect(jiangsuNewDistrictRow.cells[1].rowspan).toBe(1);
        }

        // Also check that when city names are the same but province is different,
        // they are NOT merged together
        const zhejiangNewDistrictRow = filteredList.find(row =>
            row.cells[0].content === 'Zhejiang' && row.cells[1].content === 'New District'
        );
        expect(zhejiangNewDistrictRow).toBeDefined();

        // Both "New District" cells should have rowspan 1 (independent, not merged across provinces)
        if (zhejiangNewDistrictRow && jiangsuNewDistrictRow) {
            expect(zhejiangNewDistrictRow.cells[1].rowspan).toBe(1);
            expect(jiangsuNewDistrictRow.cells[1].rowspan).toBe(1);
        }
    });
});
