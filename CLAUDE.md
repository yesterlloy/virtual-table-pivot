# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev              # Run development server
pnpm build            # Build library (TypeScript + Vite)
pnpm type-check       # Type check only
pnpm test             # Run all tests
pnpm test run         # Run tests once (non-watch mode)
pnpm test run <file>  # Run specific test file
pnpm release          # Full release: test -> build -> publish
```

## Architecture

**Package**: `@yester/virtual-table` - A React virtual scrolling table component supporting Pivot Table, Group Table, and Detail Table modes.

### Core Structure

```
src/
├── components/VirtualTable/
│   ├── index.tsx       # Main component: ResizeObserver, scroll sync, width calculation
│   ├── TableHeader.tsx # Header rendering
│   ├── Renderer.tsx    # Virtual scrolling via react-window FixedSizeGrid
│   └── Cell.tsx        # Individual cell rendering
├── utils/
│   ├── dataHandler.ts  # Entry point for data processing, routes to pivotHandler
│   └── pivotHandler.ts # Core pivot table logic: grouping, aggregation, expand/collapse
├── types/index.ts      # TypeScript definitions
└── index.ts            # Public exports
```

### Data Flow

1. **VirtualTable** receives `data`, `fields`, `meta`, `sortParams` props
2. Calls **dataHandler** which processes based on mode:
   - **Detail Table** (no rows/columns): Direct mapping of values to columns
   - **Group Table** (rows only) / **Pivot Table** (rows + columns): Delegates to **pivotHandler**
3. **pivotHandler** handles:
   - Data grouping by row/column keys
   - Aggregation (sum, avg, count, min, max, d_count, variance, stddev, expr)
   - Expand/collapse state management
   - Subtotal row generation
   - Row span calculation for merged cells
4. Returns `list` (TableRow[]), `dataExpandFilter` (for expand/collapse), `tableColumns`

### Key Types

- `DimensionNode`: Row/column dimension config (field, title, width, collapsed, total, sort)
- `MetricNode`: Value field config (field, calculateType, expression, formatter, emptyReplace)
- `PivotFields`: { rows: DimensionNode[], columns: DimensionNode[], values: MetricNode[] }
- `TableRow`: { cells: DataCell[], rowKey: string }

### Important Patterns

- **Expand/Collapse**: Managed via `expandState` Map in pivotHandler; `dataExpandFilter` applies visibility
- **Column Key Format**: For column dimensions, field format is `dimensionField__value` (e.g., `type__Furniture`)
- **Cell Key Format**: For pivot cells, format is `|rowKey||colKey`
- **Width Calculation**: Auto-distributes remaining container width across columns
- **Scroll Sync**: Header and body scroll together via ref-based scrollLeft sync
- **Expression Calculation**: `{field}` syntax in expressions, evaluated safely with regex validation

### Testing

Tests use Vitest + @testing-library/react. Test files use `.test.ts` suffix. Run `pnpm test run src/utils/dataHandler.test.ts` for targeted testing.
