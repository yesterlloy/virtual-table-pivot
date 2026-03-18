# Row Index Column Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a row index column feature to VirtualTable that displays sequential numbers (1, 2, 3...) in the first column with proper rowspan handling.

**Architecture:** Add `config` prop to VirtualTable, pass through dataHandler to pivotHandler which generates index cells with rowspan matching first row dimension column. Index column renders as first column in header and body.

**Tech Stack:** React, TypeScript, virtual-table codebase

---

## File Structure

**Files to Modify:**

| File | Responsibility |
|------|----------------|
| `src/types/index.ts` | Add `config` property to `VirtualTableProps` interface |
| `src/components/VirtualTable/index.tsx` | Add config prop, pass to dataHandler |
| `src/utils/dataHandler.ts` | Pass config to pivotHandler, handle Detail Table index |
| `src/utils/pivotHandler.ts` | Generate index cells with rowspan, track index counter |
| `src/components/VirtualTable/TableHeader.tsx` | Render index column header |
| `src/components/VirtualTable/Renderer.tsx` | Render index cells |

**Files to Check:**

- `src/utils/dataHandler.test.ts` - Add tests for index column
- `src/utils/pivotHandler.test.ts` - Add tests for rowspan behavior

---

## Tasks

### Task 1: Add config type definition

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add Config interface and update VirtualTableProps**

Add before `VirtualTableProps` or as separate interface:

```typescript
export interface VirtualTableConfig {
    showLine?: boolean;        // default: false
    showLineTitle?: string;    // default: '序号'
    lineWidth?: string;        // default: '70px'
}

export interface VirtualTableProps extends PivotParams {
    scroll?: { x?: number | string; y?: number | string };
    className?: string;
    style?: React.CSSProperties;
    config?: VirtualTableConfig;  // Add this line
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "types: add VirtualTableConfig interface with showLine options"
```

---

### Task 2: Update VirtualTable component to accept config

**Files:**
- Modify: `src/components/VirtualTable/index.tsx`

- [ ] **Step 1: Add config to component interface and useEffect deps**

The component already has `VirtualTableProps` which now includes config. Update the useEffect dependency array:

```typescript
useEffect(() => {
    const params: PivotParams = {
        data,
        meta,
        sortParams,
        fields
    };

    let rs = dataHandler(params, config);  // Pass config
    // ... rest unchanged
}, [data, meta, sortParams, fields, config, handleExpand]);  // Add config to deps
```

- [ ] **Step 2: Run type check**

```bash
pnpm type-check
```
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/VirtualTable/index.tsx
git commit -m "feat: pass config prop to dataHandler"
```

---

### Task 3: Update dataHandler to pass config

**Files:**
- Modify: `src/utils/dataHandler.ts`

- [ ] **Step 1: Update dataHandler signature and pass config**

```typescript
export const dataHandler = (params: PivotParams, config?: VirtualTableConfig) => {
    // ... existing code

    if (rows.length === 0 && columns.length === 0) {
        // Detail Table mode - handle index here
        const visibleValues = values.filter(v => !v.hidden);
        const tableColumns = visibleValues.map(v => ({
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
                let content = record[v.field] ?? EMPTY_VALUE;
                cells.push({
                    content: content,
                    rowspan: 1,
                    colspan: 1,
                    style: v.style,
                    data: record
                });
            });
            return { cells, rowKey: index.toString() };
        });

        return { list: bodyRows, dataExpandFilter: (l: any[]) => l, tableColumns };
    }

    // Pass config to pivotHandler for Group/Pivot tables
    return pivotDataHandler(params, config);
}
```

- [ ] **Step 2: Add import for VirtualTableConfig**

```typescript
import { PivotParams, DataCell, TableRow, VirtualTableConfig } from '@/types';
```

- [ ] **Step 3: Run type check**

```bash
pnpm type-check
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/utils/dataHandler.ts
git commit -m "feat: handle row index for Detail Table mode"
```

---

### Task 4: Update pivotHandler to generate index cells

**Files:**
- Modify: `src/utils/pivotHandler.ts`

- [ ] **Step 1: Update pivotHandler signature**

```typescript
const pivotDataHandler = (params: PivotParams, config?: VirtualTableConfig) => {
    // ... existing code
```

- [ ] **Step 2: Add index column to generateColumns when showLine is true**

In `generateColumns()` function, add at the beginning:

```typescript
const generateColumns = () => {
    const columnsConfig: CustomTreeNode[] = [];

    // Add index column first if enabled
    if (config?.showLine) {
        columnsConfig.push({
            field: '__row_index__',
            title: config.showLineTitle || '序号',
            width: config.lineWidth || '70px',
            key: '__row_index__',
            type: 'index'
        } as any);
    }

    // ... rest of existing column generation
```

- [ ] **Step 3: Generate index cells in data row generation**

Find the data row generation loop and add index cell:

```typescript
// Track index counter outside the loop
let indexCounter = 1;

sortedRowGroups.forEach(([_rowKey, rowDataList]) => {
    const rowData = rowDataList[0];
    const rowCells: DataCell[] = [];
    let currentRowKey = '';

    // Add index cell if enabled
    if (config?.showLine) {
        // Index cell will get rowspan from first dimension cell
        // For now, set rowspan=1, will be updated in rowSpanHandler
        rowCells.push({
            content: indexCounter,
            rowspan: 1,
            colspan: 1,
            data: rowData
        });
    }

    // ... rest of existing row cell generation

    // Increment index counter only for new rows (rowspan > 0 after rowSpanHandler)
    // This will be handled after rowSpanHandler runs
    dataRows.push({ cells: rowCells, rowKey: currentRowKey });
});

// After all rows generated, update index cells with proper rowspan
// Note: cells[0] = index cell, cells[1] = first dimension cell
if (config?.showLine && rowLeafNodes.length > 0) {
    let rowIndex = 1;
    for (let i = 0; i < dataRows.length; i++) {
        const indexCell = dataRows[i].cells[0];           // Index is at position 0
        const firstDimCell = dataRows[i].cells[1];        // First dimension is at position 1

        if (firstDimCell.rowspan > 0) {
            indexCell.rowspan = firstDimCell.rowspan;
            indexCell.content = rowIndex++;
        } else {
            // This row is merged with previous, hide index
            indexCell.rowspan = 0;
        }
    }
}
```

- [ ] **Step 4: Handle subtotal rows index**

In `generateSubtotalRows`, add index cell. Subtotal rows get empty index cells to maintain column alignment:

```typescript
const generateSubtotalRows = (dataRows: DataCell[][]) => {
    // ... existing code

    // Generate subtotal row with index (empty content for alignment)
    const subtotalRow: DataCell[] = [];

    if (config?.showLine) {
        // Subtotal rows get empty index cell - they don't get a sequence number
        subtotalRow.unshift({
            content: EMPTY_VALUE,  // Empty for subtotal rows
            rowspan: 1,
            colspan: 1,
            data: null
        });
    }

    // ... rest of subtotal row generation
```

- [ ] **Step 7: Handle expand/collapse index recalculation**

When rows are expanded/collapsed, the index rowspan must match visible rows only. Add logic in `dataExpandFilter`:

```typescript
// After filtering visible rows, recalculate index rowspan
if (config?.showLine) {
    let visibleIndex = 1;
    for (let i = 0; i < visibleCells.length; i++) {
        const indexCell = visibleCells[i][0];
        const firstDimCell = visibleCells[i][1];

        if (firstDimCell.rowspan > 0) {
            indexCell.rowspan = firstDimCell.rowspan;
            indexCell.content = visibleIndex++;
        } else {
            indexCell.rowspan = 0;
        }
    }
}
```

- [ ] **Step 8: Add import for VirtualTableConfig**

```typescript
import { VirtualTableConfig } from '@/types';
```

- [ ] **Step 6: Run type check**

```bash
pnpm type-check
```
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/utils/pivotHandler.ts
git commit -m "feat: generate index cells with rowspan for pivot/group tables"
```

---

### Task 5: Update TableHeader to render index column

**Files:**
- Modify: `src/components/VirtualTable/TableHeader.tsx`

- [ ] **Step 1: Read TableHeader.tsx to understand current structure**

- [ ] **Step 2: Ensure index column header renders correctly**

The header should already handle the index column since we're adding it to columnsConfig. Verify the rendering handles the `__row_index__` field correctly.

- [ ] **Step 3: Run dev server and verify**

```bash
pnpm dev
```

- [ ] **Step 4: Commit**

```bash
git add src/components/VirtualTable/TableHeader.tsx
git commit -m "feat: render index column header"
```

---

### Task 6: Update Renderer to render index cells

**Files:**
- Modify: `src/components/VirtualTable/Renderer.tsx`

- [ ] **Step 1: Read Renderer.tsx to understand current cell rendering**

- [ ] **Step 2: Ensure index cells render with proper rowspan**

The Renderer should already handle cells with rowspan. Verify index cells with `rowspan > 1` render correctly.

- [ ] **Step 3: Run tests**

```bash
pnpm test run
```
Expected: All existing tests pass

- [ ] **Step 4: Commit**

```bash
git add src/components/VirtualTable/Renderer.tsx
git commit -m "feat: render index cells with rowspan support"
```

---

### Task 7: Add tests for row index feature

**Files:**
- Modify: `src/utils/dataHandler.test.ts`
- Modify: `src/utils/pivotHandler.test.ts`

- [ ] **Step 1: Add Detail Table index test**

```typescript
describe('row index', () => {
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

        const result = dataHandler({ data, fields, meta: [], sortParams: [] }, config);

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

        const result = dataHandler({ data, fields, meta: [], sortParams: [] }, config);

        expect(result.list[0].cells[0].content).toBe(1); // id value, not index
        expect(result.tableColumns[0].title).toBe('ID');
    });
});
```

- [ ] **Step 2: Add Group Table index test**

```typescript
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

    const result = dataHandler({ data, fields, meta: [], sortParams: [] }, config);

    // First index should span 2 rows (Zhejiang)
    expect(result.list[0].cells[0].content).toBe(1);
    expect(result.list[0].cells[0].rowspan).toBe(2);
    // Second index should be 2 (Jiangsu)
    expect(result.list[2].cells[0].content).toBe(2);
});
```

- [ ] **Step 3: Add custom width and title tests**

```typescript
it('should use custom showLineTitle', () => {
    const config = { showLine: true, showLineTitle: 'No.' };
    const result = dataHandler({ data, fields, meta: [], sortParams: [] }, config);
    expect(result.tableColumns[0].title).toBe('No.');
});

it('should use custom lineWidth', () => {
    const config = { showLine: true, lineWidth: '50px' };
    const result = dataHandler({ data, fields, meta: [], sortParams: [] }, config);
    expect(result.tableColumns[0].width).toBe('50px');
});
```

- [ ] **Step 4: Add subtotal row test**

```typescript
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

    const result = dataHandler({ data, fields, meta: [], sortParams: [] }, config);

    // Find subtotal row (should have '合计' or similar in first dimension)
    const subtotalRow = result.list.find(row =>
        row.cells.some(cell => cell.content === '合计' || cell.content === 'Total')
    );
    if (subtotalRow) {
        expect(subtotalRow.cells[0].content).toBe(EMPTY_VALUE); // Index should be empty
    }
});
```

- [ ] **Step 5: Run tests**

```bash
pnpm test run src/utils/dataHandler.test.ts
pnpm test run src/utils/pivotHandler.test.ts
```
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/utils/dataHandler.test.ts src/utils/pivotHandler.test.ts
git commit -m "test: add row index column tests"
```

---

### Task 8: Final verification

**Files:**
- All modified files

- [ ] **Step 1: Run full test suite**

```bash
pnpm test run
```
Expected: All tests pass

- [ ] **Step 2: Run type check**

```bash
pnpm type-check
```
Expected: No errors

- [ ] **Step 3: Run build**

```bash
pnpm build
```
Expected: Build succeeds

- [ ] **Step 4: Final commit if any changes**

```bash
git commit -m "chore: final cleanup"
```

---

## Testing Checklist

- [ ] Detail Table: Indices 1, 2, 3... sequentially
- [ ] Group Table: Index rowspan matches first dimension
- [ ] Pivot Table: Index rowspan matches first row dimension
- [ ] Subtotal rows: Index handling correct
- [ ] Expand/collapse: Indices update correctly
- [ ] Custom title: `showLineTitle` works
- [ ] Custom width: `lineWidth` works
