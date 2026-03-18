# Row Index Column Design

## Overview

Add a row index column feature to the VirtualTable component that displays sequential numbers (1, 2, 3...) in the first column, with proper rowspan handling for grouped/pivot tables.

## Configuration

### New `config` Property

```typescript
interface VirtualTableProps {
    config?: {
        showLine?: boolean;        // Enable row index column, default: false
        showLineTitle?: string;    // Column header title, default: '序号'
        lineWidth?: string;        // Column width, default: '70px'
    };
}
```

## Behavior

### Column Position

The row index column appears as the first column in all table modes:

| Mode | Index Position |
|------|----------------|
| Detail Table | Before all value columns |
| Group Table | Before first row dimension |
| Pivot Table | Before first row dimension |

### Rowspan Behavior

The index column follows the first data column's rowspan:

- When first column has `rowspan = N`, the index cell also has `rowspan = N`
- Index counter increments only when a new row starts (rowspan > 0)
- Subtotal rows follow the grouping row's rowspan logic
- Child rows under expanded parents don't show separate indices

### Example

```
Index | Province | City      | Amount
------+----------+-----------+--------
  1   | Zhejiang | Hangzhou  | 100
      |          | Ningbo    | 200
  2   | Jiangsu  | Nanjing   | 150
      |          | Suzhou    | 250
```

Zhejiang spans 2 rows (rowspan=2), so index "1" also spans 2 rows.

## Implementation

### Files to Modify

1. **`src/types/index.ts`**
   - Add `config` property to `VirtualTableProps` interface

2. **`src/utils/dataHandler.ts`**
   - Pass `config` to `pivotHandler`
   - Handle index column generation for Detail Table mode

3. **`src/utils/pivotHandler.ts`**
   - Generate index cells with proper rowspan values
   - Track index counter based on first column rowspan

4. **`src/components/VirtualTable/index.tsx`**
   - Add `config` prop to component interface
   - Pass config to dataHandler

5. **`src/components/VirtualTable/TableHeader.tsx`**
   - Render index column header when `showLine` is true

6. **`src/components/VirtualTable/Renderer.tsx`**
   - Render index cells in each row

7. **`src/components/VirtualTable/Cell.tsx`**
   - Handle index cell rendering with rowspan

### Data Flow

```
VirtualTable (config prop)
    ↓
dataHandler (pass config)
    ↓
pivotHandler (generate index cells with rowspan)
    ↓
TableHeader (render header) + Renderer (render cells)
```

### Key Logic (pivotHandler)

```typescript
// Track index counter
let indexCounter = 1;

// For each row:
if (firstCell.rowspan > 0) {
    // This is a new row start
    indexCell = {
        content: indexCounter++,
        rowspan: firstCell.rowspan,
        colspan: 1
    };
} else {
    // This row is merged with previous, skip index
    // (row will be filtered out or cell skipped)
}
```

## Testing

- Detail Table: Sequential indices 1, 2, 3...
- Group Table: Indices follow first dimension rowspan
- Pivot Table: Indices follow first row dimension rowspan
- Subtotal rows: Proper index handling
- Expand/collapse: Indices update correctly
