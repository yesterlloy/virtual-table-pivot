# Virtual Table

A high-performance virtual scrolling table component for React, supporting Pivot Table, Group Table, and Detail Table modes. Capable of handling large datasets efficiently using `react-window`.

## Features

- 🚀 **High Performance**: Renders thousands of rows smoothly using virtual scrolling.
- 📊 **Pivot Table**: Supports multi-dimensional data analysis with row/column grouping and aggregation.
- 📑 **Group Table**: Supports row grouping with expandable/collapsible rows.
- 📋 **Detail Table**: Standard list view for detailed data.
- 🔄 **Sortable**: Supports sorting on multiple fields.
- 🎨 **Customizable**: Flexible styling and cell rendering.
- 📦 **Lightweight**: No heavy dependencies (lodash removed, icons extracted).

## Installation

```bash
pnpm add virtual-table
# or
npm install virtual-table
# or
yarn add virtual-table
```

## Usage

### Basic Usage

```tsx
import React from 'react';
import { VirtualTable } from 'virtual-table';
import 'virtual-table/dist/style.css'; // Import styles

const App = () => {
  const data = [
    { province: 'Zhejiang', city: 'Hangzhou', type: 'Furniture', amount: 10 },
    // ... more data
  ];

  const params = {
    data,
    meta: [],
    sortParams: [],
    fields: {
      rows: [{ field: 'province', title: 'Province', width: 150 }],
      columns: [{ field: 'type', title: 'Type', width: 120 }],
      values: [{ field: 'amount', title: 'Amount', calculateType: 'sum', width: 100 }]
    }
  };

  return (
    <div style={{ height: 500 }}>
      <VirtualTable
        {...params}
        scroll={{ y: 500 }}
      />
    </div>
  );
};
```

## Modes

### 1. Pivot Table Mode
Configure `rows`, `columns`, and `values` in `fields`.

```tsx
const pivotFields = {
  rows: [
    { field: 'province', title: 'Province', width: 120, total: { enabled: true, label: 'Total' } },
    { field: 'city', title: 'City', width: 120 }
  ],
  columns: [
    { field: 'type', title: 'Type', width: 120 }
  ],
  values: [
    { field: 'amount', title: 'Amount', calculateType: 'sum', width: 100 }
  ]
};
```

### 2. Group Table Mode
Configure `rows` and `values`, leave `columns` empty.

```tsx
const groupFields = {
  rows: [
    { field: 'province', title: 'Province', width: 120 },
    { field: 'city', title: 'City', width: 120 }
  ],
  columns: [],
  values: [
    { field: 'amount', title: 'Amount', calculateType: 'sum', width: 100 }
  ]
};
```

### 3. Detail Table Mode
Configure only `values` as a flat list of columns.

```tsx
const detailFields = {
  rows: [],
  columns: [],
  values: [
    { field: 'province', title: 'Province', width: 120 },
    { field: 'city', title: 'City', width: 120 },
    { field: 'amount', title: 'Amount', width: 100 }
  ]
};
```

## API

### VirtualTable Props

| Property | Type | Description |
|Data | `any[]` | Source data array |
| `fields` | `PivotFields` | Configuration for rows, columns, and values |
| `meta` | `any[]` | Meta information (optional) |
| `sortParams` | `SortParam[]` | Sorting configuration |
| `scroll` | `{ x?: number \| string; y?: number \| string }` | Scroll configuration. `y` is required for virtual scrolling height |
| `className` | `string` | Custom CSS class |
| `style` | `React.CSSProperties` | Custom styles |

### PivotFields

```typescript
interface PivotFields {
    rows: CustomTreeNode[];    // Row dimensions
    columns: CustomTreeNode[]; // Column dimensions
    values: CustomTreeNode[];  // Value fields (metrics)
}
```

### CustomTreeNode (Field Configuration)

| Property | Type | Description |
|----------|------|-------------|
| `field` | `string` | Data field key |
| `title` | `ReactNode` | Column header title |
| `width` | `number \| string` | Column width |
| `calculateType` | `'sum' \| 'avg' \| 'count' ...` | Aggregation type (for values) |
| `total` | `{ enabled: boolean; label?: string }` | Subtotal configuration (for rows) |
| `emptyReplace` | `string` | Replacement for empty values |

## Development

```bash
# Install dependencies
pnpm install

# Run dev server
pnpm dev

# Build library
pnpm build

# Run tests
pnpm test

# Release (Test -> Build -> Publish)
pnpm release
```

## License

MIT
