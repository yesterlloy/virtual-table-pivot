# Virtual Table

一个基于 React 的高性能虚拟滚动表格组件，支持透视表（Pivot Table）、分组表（Group Table）和明细表（Detail Table）模式。利用 `react-window` 高效处理海量数据。

## 特性

- 🚀 **高性能**：利用虚拟滚动流畅渲染数千行数据。
- 📊 **透视表**：支持多维数据分析，包含行/列分组和聚合计算。
- 📑 **分组表**：支持行分组，具备展开/收起功能。
- 📋 **明细表**：用于展示详细数据的标准列表视图。
- 🔄 **可排序**：支持多字段排序。
- 🎨 **可定制**：灵活的样式和单元格渲染。
- 📦 **轻量级**：无沉重依赖（移除了 lodash，内置图标）。

## 安装

```bash
pnpm add virtual-table
# 或
npm install virtual-table
# 或
yarn add virtual-table
```

## 使用方法

### 基础用法

```tsx
import React from 'react';
import { VirtualTable } from 'virtual-table';
import 'virtual-table/dist/style.css'; // 引入样式

const App = () => {
  const data = [
    { province: 'Zhejiang', city: 'Hangzhou', type: 'Furniture', amount: 10 },
    // ... 更多数据
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

## 模式

### 1. 透视表模式 (Pivot Table Mode)
在 `fields` 中配置 `rows`（行维度）、`columns`（列维度）和 `values`（数值）。

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

### 2. 分组表模式 (Group Table Mode)
配置 `rows` 和 `values`，保持 `columns` 为空。

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

### 3. 明细表模式 (Detail Table Mode)
仅配置 `values` 作为扁平的列列表。

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

### VirtualTable 属性 (Props)

| 属性 | 类型 | 描述 |
|------|------|------|
| `Data` | `any[]` | 源数据数组 |
| `fields` | `PivotFields` | 行、列和数值的配置 |
| `meta` | `any[]` | 元信息（可选） |
| `sortParams` | `SortParam[]` | 排序配置 |
| `scroll` | `{ x?: number \| string; y?: number \| string }` | 滚动配置。`y` 是虚拟滚动高度所必需的 |
| `className` | `string` | 自定义 CSS 类名 |
| `style` | `React.CSSProperties` | 自定义样式 |

### PivotFields

```typescript
interface PivotFields {
    rows: CustomTreeNode[];    // 行维度
    columns: CustomTreeNode[]; // 列维度
    values: CustomTreeNode[];  // 数值字段 (指标)
}
```

### CustomTreeNode (字段配置)

| 属性 | 类型 | 描述 |
|----------|------|-------------|
| `field` | `string` | 数据字段键名 |
| `title` | `ReactNode` | 列标题 |
| `width` | `number \| string` | 列宽 |
| `calculateType` | `'sum' \| 'avg' \| 'count' ...` | 聚合类型 (用于数值) |
| `total` | `{ enabled: boolean; label?: string }` | 小计配置 (用于行维度) |
| `emptyReplace` | `string` | 空值替换文本 |

## 开发

```bash
# 安装依赖
pnpm install

# 运行开发服务器
pnpm dev

# 构建库
pnpm build

# 运行测试
pnpm test

# 发布 (测试 -> 构建 -> 发布)
pnpm release
```

## 许可证

MIT
