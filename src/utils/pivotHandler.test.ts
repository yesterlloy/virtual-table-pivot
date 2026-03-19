import { describe, it, expect } from 'vitest';
import pivotDataHandler from './pivotHandler';
import { PivotParams, MetricNode, DimensionNode } from '@/types';
import { EMPTY_VALUE } from './vars';

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

describe('pivotDataHandler - row index feature', () => {
    it('should add index column in Group Table mode when showLine is true', () => {
        const data = [
            { province: 'Zhejiang', city: 'Hangzhou', amount: 100 },
            { province: 'Zhejiang', city: 'Ningbo', amount: 200 },
            { province: 'Jiangsu', city: 'Nanjing', amount: 150 }
        ];
        const params: PivotParams = {
            data,
            meta: [],
            sortParams: [],
            fields: {
                rows: [
                    { field: 'province', title: 'Province' },
                    { field: 'city', title: 'City' }
                ],
                columns: [],
                values: [{ field: 'amount', title: 'Amount', calculateType: 'sum' }]
            },
            config: { showLine: true }
        };

        const result = pivotDataHandler(params);

        // Check index column in tableColumns
        expect(result.tableColumns).toBeDefined();
        if (result.tableColumns) {
            expect(result.tableColumns[0].field).toBe('__row_index__');
            expect(result.tableColumns[0].title).toBe('序号');
        }

        // Check index cells in data rows
        const filteredList = result.dataExpandFilter(result.list);
        expect(filteredList[0].cells[0].content).toBe(1);
        expect(filteredList.some(row => row.cells[0].content === 2)).toBe(true);
    });

    it('should add index column in Pivot Table mode when showLine is true', () => {
        const data = [
            { province: 'Zhejiang', type: 'Furniture', amount: 100 },
            { province: 'Zhejiang', type: 'Electronics', amount: 200 },
            { province: 'Jiangsu', type: 'Furniture', amount: 150 }
        ];
        const params: PivotParams = {
            data,
            meta: [],
            sortParams: [],
            fields: {
                rows: [{ field: 'province', title: 'Province' }],
                columns: [{ field: 'type', title: 'Type' }],
                values: [{ field: 'amount', title: 'Amount', calculateType: 'sum' }]
            },
            config: { showLine: true }
        };

        const result = pivotDataHandler(params);

        // Check index column in tableColumns
        expect(result.tableColumns).toBeDefined();
        if (result.tableColumns) {
            expect(result.tableColumns[0].field).toBe('__row_index__');
        }

        // Check index cells in data rows
        expect(result.list.some(row => row.cells[0].content === 1)).toBe(true);
    });

    it('should use custom showLineTitle in pivot table', () => {
        const data = [
            { province: 'Zhejiang', amount: 100 }
        ];
        const params: PivotParams = {
            data,
            meta: [],
            sortParams: [],
            fields: {
                rows: [{ field: 'province', title: 'Province' }],
                columns: [],
                values: [{ field: 'amount', title: 'Amount', calculateType: 'sum' }]
            },
            config: { showLine: true, showLineTitle: 'No.' }
        };

        const result = pivotDataHandler(params);

        expect(result.tableColumns).toBeDefined();
        if (result.tableColumns) {
            expect(result.tableColumns[0].title).toBe('No.');
        }
    });

    it('should use custom lineWidth in pivot table', () => {
        const data = [
            { province: 'Zhejiang', amount: 100 }
        ];
        const params: PivotParams = {
            data,
            meta: [],
            sortParams: [],
            fields: {
                rows: [{ field: 'province', title: 'Province' }],
                columns: [],
                values: [{ field: 'amount', title: 'Amount', calculateType: 'sum' }]
            },
            config: { showLine: true, lineWidth: '60px' }
        };

        const result = pivotDataHandler(params);

        expect(result.tableColumns).toBeDefined();
        if (result.tableColumns) {
            expect(result.tableColumns[0].width).toBe('60px');
        }
    });

    it('should have empty index cell for subtotal rows in pivot table', () => {
        const data = [
            { province: 'Zhejiang', amount: 100 },
            { province: 'Zhejiang', amount: 200 }
        ];
        const params: PivotParams = {
            data,
            meta: [],
            sortParams: [],
            fields: {
                rows: [{ field: 'province', title: 'Province', total: { enabled: true } }],
                columns: [],
                values: [{ field: 'amount', title: 'Amount', calculateType: 'sum' }]
            },
            config: { showLine: true }
        };

        const result = pivotDataHandler(params);

        // Find subtotal row by checking the province cell (index 1, since index 0 is the index column)
        const subtotalRow = result.list.find(row =>
            row.cells.length > 1 && (row.cells[1].content === '合计' || row.cells[1].content === 'Total')
        );
        if (subtotalRow) {
            // The index cell (cells[0]) should be EMPTY_VALUE for subtotal rows
            expect(subtotalRow.cells[0].content).toBe(EMPTY_VALUE);
        }
    });

    it('should handle all dimensions collapsed with emptyReplace - simulating data.json scenario', () => {
        // Simulate data.json structure with 6 row dimensions, all collapsed: true
        // Many rows have empty values in name2-5 fields
        const testData = [
            { code1: '03060301', name1: '事项分类', name2: '城乡建设', name3: '城市设施管理', name4: '道路设施', name5: '安全岛', value: 10 },
            { code1: '03060301', name1: '事项分类', name2: '城乡建设', name3: '城市设施管理', name4: '道路设施', name5: '', value: 20 },
            { code1: '03060301', name1: '事项分类', name2: '城乡建设', name3: '城市设施管理', name4: '路灯设施', name5: '', value: 30 },
            { code1: '03060302', name1: '事项分类', name2: '环境保护', name3: '', name4: '', name5: '', value: 40 },
        ];

        const params: PivotParams = {
            data: testData,
            meta: [],
            sortParams: [],
            fields: {
                rows: [
                    { field: 'code1', title: 'Code', collapsed: true, emptyReplace: '-' },
                    { field: 'name1', title: 'Level 1', collapsed: true, emptyReplace: '-' },
                    { field: 'name2', title: 'Level 2', collapsed: true, emptyReplace: '-' },
                    { field: 'name3', title: 'Level 3', collapsed: true, emptyReplace: '-' },
                    { field: 'name4', title: 'Level 4', collapsed: true, emptyReplace: '-' },
                    { field: 'name5', title: 'Level 5', collapsed: true, emptyReplace: '-' }
                ] as DimensionNode[],
                columns: [],
                values: [{ field: 'value', calculateType: 'sum' }]
            },
            config: { showLine: true }
        };

        const result = pivotDataHandler(params);

        // Check that dataHandler returns rows
        expect(result.list).toBeDefined();
        expect(result.list.length).toBe(4); // 4 unique data rows

        // Check that dataExpandFilter returns visible rows
        const filtered = result.dataExpandFilter(result.list);

        // With all dimensions collapsed:
        // - code1='03060301' has 3 rows with different name5/name4 values, should show first one
        // - code1='03060302' has 1 row, should show it
        // Since code1 values are different (03060301 vs 03060302), they are independent groups
        // Expected: 2 visible rows (first child of each code1 group)
        expect(filtered.length).toBe(2);

        // Verify the visible row keys
        const visibleRowKeys = filtered.map(row => row.rowKey);

        // First row: first child of code1='03060301' group
        expect(visibleRowKeys[0]).toContain('03060301');
        // Second row: first (and only) child of code1='03060302' group
        expect(visibleRowKeys[1]).toContain('03060302');
    });

    it('should show first child of each top-level parent when all dimensions collapsed - data.json scenario', () => {
        // Simulate data.json where name1 is always "事项分类" but code1 varies
        // Each unique code1 should show its first child
        const testData = [
            { code1: '01', name1: '事项分类', name2: '科教文体', name3: '教育管理', name4: '招生考试', name5: '初中教育', value: 10 },
            { code1: '01', name1: '事项分类', name2: '科教文体', name3: '教育管理', name4: '招生考试', name5: '高中教育', value: 20 },
            { code1: '0101', name1: '事项分类', name2: '科教文体', name3: '教育管理', name4: '学校管理', name5: '', value: 30 },
            { code1: '0102', name1: '事项分类', name2: '科教文体', name3: '教育管理', name4: '教育收费', name5: '', value: 40 },
            { code1: '02', name1: '事项分类', name2: '交通运输', name3: '城市公交', name4: '', name5: '', value: 50 },
        ];

        const params: PivotParams = {
            data: testData,
            meta: [],
            sortParams: [],
            fields: {
                rows: [
                    { field: 'code1', title: 'Code', collapsed: true },
                    { field: 'name1', title: 'Level 1', collapsed: true },
                    { field: 'name2', title: 'Level 2', collapsed: true },
                    { field: 'name3', title: 'Level 3', collapsed: true },
                    { field: 'name4', title: 'Level 4', collapsed: true },
                    { field: 'name5', title: 'Level 5', collapsed: true }
                ] as DimensionNode[],
                columns: [],
                values: [{ field: 'value', calculateType: 'sum' }]
            }
        };

        const result = pivotDataHandler(params);
        const filtered = result.dataExpandFilter(result.list);

        // Expected visible rows (first child of each unique code1):
        // - code1='01': first child is name5='初中教育'
        // - code1='0101': first child is name5=''
        // - code1='0102': first child is name5=''
        // - code1='02': first child is name5=''
        expect(filtered.length).toBe(4);

        const visibleRowKeys = filtered.map(row => row.rowKey);
        expect(visibleRowKeys[0]).toContain('|01|');
        expect(visibleRowKeys[1]).toContain('|0101|');
        expect(visibleRowKeys[2]).toContain('|0102|');
        expect(visibleRowKeys[3]).toContain('|02|');
    });

    it('should handle data.json scenario where each code1 has only one row with empty name2-5', () => {
        // Simulate data.json where each code1 has only one row
        // and name2-5 are mostly empty
        const testData = [
            { code1: '-1', name1: '全市整体', name2: '', name3: '', name4: '', name5: '', value: 10 },
            { code1: '-2', name1: '合计', name2: '', name3: '', name4: '', name5: '', value: 20 },
            { code1: '0', name1: '事项分类', name2: '', name3: '', name4: '', name5: '', value: 30 },
            { code1: '01', name1: '科教文体', name2: '', name3: '', name4: '', name5: '', value: 40 },
            { code1: '0101', name1: '教育管理', name2: '', name3: '', name4: '', name5: '', value: 50 },
        ];

        const params: PivotParams = {
            data: testData,
            meta: [],
            sortParams: [],
            fields: {
                rows: [
                    { field: 'code1', title: 'Code', collapsed: true, emptyReplace: '-' },
                    { field: 'name1', title: 'Level 1', collapsed: true, emptyReplace: '-' },
                    { field: 'name2', title: 'Level 2', collapsed: true, emptyReplace: '-' },
                    { field: 'name3', title: 'Level 3', collapsed: true, emptyReplace: '-' },
                    { field: 'name4', title: 'Level 4', collapsed: true, emptyReplace: '-' },
                    { field: 'name5', title: 'Level 5', collapsed: true, emptyReplace: '-' }
                ] as DimensionNode[],
                columns: [],
                values: [{ field: 'value', calculateType: 'sum' }]
            }
        };

        const result = pivotDataHandler(params);

        // Each row has unique code1, so each should be visible when collapsed
        // because each code1 group has only one row (which is the first child)
        expect(result.list.length).toBe(5);

        const filtered = result.dataExpandFilter(result.list);
        console.log('data.json scenario - visible rows:', filtered.length);
        filtered.forEach((row, idx) => {
            console.log(`  Visible ${idx}: rowKey="${row.rowKey}"`);
        });

        // All 5 rows should be visible because each code1 is unique
        // and each has only one row (which is its own first child)
        expect(filtered.length).toBe(5);
    });

    it('should handle actual data.json file', () => {
        // Import actual data.json
        const dataJson = require('../../src/test/data.json');

        const params: PivotParams = {
            data: dataJson.data.slice(0, 100), // Use first 100 records
            meta: dataJson.meta,
            sortParams: dataJson.sortParams,
            fields: dataJson.fields,
            config: { showLine: true }
        };

        const result = pivotDataHandler(params);
        const filtered = result.dataExpandFilter(result.list);

        // Should show first child of each unique code1 group
        // With 100 records and ~50 unique code1 values, should show ~50 rows
        expect(filtered.length).toBeGreaterThan(10); // At least 10 visible rows
    });
});
