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

    it('should handle expression calculation with division', () => {
        const params: PivotParams = {
            data: mockData,
            meta: [],
            sortParams: [],
            fields: {
                rows: [{ field: 'province' }],
                columns: [],
                values: [
                    { field: 'amount', calculateType: 'sum' },
                    { field: 'count', calculateType: 'count' },
                    {
                        field: 'avg_calc',
                        calculateType: 'expr',
                        expression: '{amount} / {count}'
                    }
                ]
            }
        };
        const result = pivotDataHandler(params);

        expect(result.list).toBeDefined();
        expect(result.list.length).toBeGreaterThan(0);

        // Check that expression calculation returns valid numbers (not Infinity or NaN)
        result.list.forEach(row => {
            row.cells.forEach(cell => {
                if (typeof cell.content === 'number') {
                    expect(isFinite(cell.content)).toBe(true);
                    expect(isNaN(cell.content)).toBe(false);
                }
            });
        });
    });

    it('should handle division by zero in expression', () => {
        const testData = [
            { province: 'Zhejiang', amount: 100 },
        ];

        const params: PivotParams = {
            data: testData,
            meta: [],
            sortParams: [],
            fields: {
                rows: [{ field: 'province' }],
                columns: [],
                values: [
                    { field: 'amount', calculateType: 'sum' },
                    {
                        field: 'ratio',
                        calculateType: 'expr',
                        expression: '{amount} / {zero}' // zero will be 0 since it doesn't exist
                    }
                ]
            }
        };
        const result = pivotDataHandler(params);

        expect(result.list).toBeDefined();

        // Division by zero should return null/empty, not Infinity
        // The cell should have a valid value (either 0 from emptyReplace or null handled)
        result.list.forEach(row => {
            row.cells.forEach(cell => {
                if (typeof cell.content === 'number') {
                    expect(isFinite(cell.content)).toBe(true);
                }
            });
        });
    });

    it('should handle expression with column dimensions (pivot mode)', () => {
        const testData = [
            { province: 'Zhejiang', year: '2023', amount: 100, price: 50 },
            { province: 'Zhejiang', year: '2023', amount: 200, price: 60 },
            { province: 'Zhejiang', year: '2024', amount: 150, price: 70 },
            { province: 'Jiangsu', year: '2023', amount: 80, price: 40 },
        ];

        const params: PivotParams = {
            data: testData,
            meta: [],
            sortParams: [],
            fields: {
                rows: [{ field: 'province' }],
                columns: [{ field: 'year' }],
                values: [
                    { field: 'amount', calculateType: 'sum' },
                    { field: 'price', calculateType: 'sum' },
                    {
                        field: 'ratio',
                        calculateType: 'expr',
                        expression: '{price} / {amount}'
                    }
                ]
            }
        };
        const result = pivotDataHandler(params);

        expect(result.list).toBeDefined();

        // Log the results
        console.log('Pivot mode results:', JSON.stringify(result.list.map(row => ({
            rowKey: row.rowKey,
            cells: row.cells.map(c => c.content)
        })), null, 2));

        // Check that all numeric cells have valid values
        result.list.forEach(row => {
            row.cells.forEach(cell => {
                if (typeof cell.content === 'number') {
                    expect(isFinite(cell.content)).toBe(true);
                }
            });
        });
    });

    it('should handle expression when expr field is defined before referenced fields', () => {
        const testData = [
            { province: 'Zhejiang', amount: 100, price: 50 },
            { province: 'Zhejiang', amount: 200, price: 60 },
        ];

        // Expr field is defined FIRST, before the fields it references
        const params: PivotParams = {
            data: testData,
            meta: [],
            sortParams: [],
            fields: {
                rows: [{ field: 'province' }],
                columns: [],
                values: [
                    // Expr comes FIRST
                    {
                        field: 'ratio',
                        calculateType: 'expr',
                        expression: '{price} / {amount}'
                    },
                    // Then the fields it references
                    { field: 'amount', calculateType: 'sum' },
                    { field: 'price', calculateType: 'sum' }
                ]
            }
        };
        const result = pivotDataHandler(params);

        expect(result.list).toBeDefined();

        // Find the ratio cell value
        const zhejiangRow = result.list.find(row => row.rowKey === '|Zhejiang');
        expect(zhejiangRow).toBeDefined();

        // The ratio should be calculated correctly: (50+60) / (100+200) = 110/300 = 0.3666...
        // Or it might be per-row calculation depending on implementation
        // In this case, since there's only one row group, it should be sum(price)/sum(amount)

        // Check that we have valid numeric values (not NaN or Infinity)
        zhejiangRow!.cells.forEach(cell => {
            if (typeof cell.content === 'number') {
                expect(isFinite(cell.content)).toBe(true);
            }
        });

        // Find ratio cell (should be the first value column based on config order)
        const ratioCell = zhejiangRow!.cells[1]; // First cell is province, second is ratio (first in values config)
        console.log('Ratio cell (expr first):', ratioCell.content);

        // Ratio should be approximately 0.367
        if (typeof ratioCell.content === 'number') {
            expect(ratioCell.content).toBeCloseTo(110 / 300, 4);
        }
    });

    it('should calculate expression correctly when referencing hidden fields', () => {
        const testData = [
            { province: 'Zhejiang', amount: 100, cost: 30 },
            { province: 'Zhejiang', amount: 200, cost: 60 },
            { province: 'Jiangsu', amount: 150, cost: 50 },
        ];

        // hidden field 'cost' is referenced by expr field 'profit'
        const params: PivotParams = {
            data: testData,
            meta: [],
            sortParams: [],
            fields: {
                rows: [{ field: 'province' }],
                columns: [],
                values: [
                    { field: 'amount', calculateType: 'sum' },
                    // Hidden field that should still be calculated
                    { field: 'cost', calculateType: 'sum', hidden: true },
                    // Expression referencing the hidden field
                    {
                        field: 'profit',
                        calculateType: 'expr',
                        expression: '{amount} - {cost}'
                    }
                ]
            }
        };
        const result = pivotDataHandler(params);

        expect(result.list).toBeDefined();

        // Check Zhejiang row
        const zhejiangRow = result.list.find(row => row.rowKey === '|Zhejiang');
        expect(zhejiangRow).toBeDefined();

        // Should have 3 columns: province + amount (visible) + profit (visible)
        // cost is hidden, so it should not appear in columns
        expect(zhejiangRow!.cells.length).toBe(3);

        // amount = 100 + 200 = 300
        expect(zhejiangRow!.cells[1].content).toBe(300);

        // profit = amount - cost = 300 - (30 + 60) = 300 - 90 = 210
        expect(zhejiangRow!.cells[2].content).toBe(210);

        // Check Jiangsu row
        const jiangsuRow = result.list.find(row => row.rowKey === '|Jiangsu');
        expect(jiangsuRow).toBeDefined();

        // amount = 150
        expect(jiangsuRow!.cells[1].content).toBe(150);

        // profit = 150 - 50 = 100
        expect(jiangsuRow!.cells[2].content).toBe(100);
    });
});
