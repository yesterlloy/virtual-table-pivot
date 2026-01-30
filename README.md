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
    rows: DimensionNode[];    // Row dimensions
    columns: DimensionNode[]; // Column dimensions
    values: MetricNode[];     // Value fields (metrics)
}
```

### Field Configuration

#### DimensionNode (Rows & Columns)

| Property | Type | Description |
|----------|------|-------------|
| `field` | `string` | Data field key |
| `title` | `string` | Column header title |
| `width` | `number \| string` | Column width |
| `total` | `{ enabled: boolean; label?: string }` | Subtotal configuration |
| `collapsed` | `boolean` | Whether the dimension is collapsed by default |
| `sort` | `{ enabled: boolean; type: 'asc' \| 'desc' }` | Sort configuration |

#### MetricNode (Values)

| Property | Type | Description |
|----------|------|-------------|
| `field` | `string` | Data field key or unique key for expression |
| `title` | `string` | Header title |
| `width` | `number \| string` | Column width |
| `calculateType` | `'sum' \| 'avg' \| 'count' \| 'min' \| 'max' \| 'd_count' \| 'expr'` | Aggregation type |
| `expression` | `string` | Expression for calculation (e.g. `'{amount} * {price}'`) |
| `formatter` | `(val: any, record: any) => ReactNode` | Cell content formatter |
| `emptyReplace` | `string` | Replacement for empty values |
| `hidden` | `boolean` | Whether to hide this metric column |

## Advanced Usage

### Calculated Fields

You can define a new metric based on other metrics using `calculateType: 'expr'` and `expression`. Variables in `{}` refer to other metric fields.

```tsx
values: [
  { field: 'amount', title: 'Amount', calculateType: 'sum' },
  { field: 'price', title: 'Price', calculateType: 'avg' },
  { 
    field: 'total_value', 
    title: 'Total Value', 
    calculateType: 'expr', 
    expression: '{amount} * {price}' 
  }
]
```

### Cell Formatting

Use `formatter` to customize cell rendering, such as adding currency symbols or returning React components.

```tsx
values: [
  { 
    field: 'price', 
    title: 'Price', 
    formatter: (val) => <span style={{ color: 'red' }}>¥{val}</span> 
  }
]
```

### Nested Column Headers

Simply add multiple dimensions to `columns` in `PivotFields` to create nested headers.

```tsx
columns: [
  { field: 'year', title: 'Year', width: 100 }, // Top level
  { field: 'quarter', title: 'Quarter', width: 100 } // Sub level
]
```

### Default Collapsed State

Set `collapsed: true` on a row dimension to collapse it by default.

```tsx
rows: [
  { field: 'province', title: 'Province', collapsed: true }
]
```

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
