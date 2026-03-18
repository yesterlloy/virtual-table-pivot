import React from "react";
import classNames from "classnames";
import { ROW_HEIGHT, OVERSCAN_COUNT } from "@/utils/vars";
import UpCircleOutlined from '@/components/Icons/UpCircleOutlined';
import DownCircleOutlined from '@/components/Icons/DownCircleOutlined';
import { DataCell, CustomTreeNode, MetaItem } from "@/types";

export interface CellProps {
    columnIndex: number;
    rowIndex: number;
    style: React.CSSProperties;
    mergedData: DataCell[][]; // Or whatever the grid data structure is
    columns: CustomTreeNode[];
    data: any[]; // The row data
    handleExpand: (record: any) => void;
    meta?: MetaItem[];
    mergedCellsMap?: Map<string, any>;
}

// 检查单元格是否被合并覆盖
const isCellCovered = (rowIndex: number, columnIndex: number, mergedData: DataCell[][]) => {
    const cell = mergedData[rowIndex]?.[columnIndex];
    // A cell is covered if it exists but has rowspan=0 OR colspan=0.
    // If cell doesn't exist (undefined), it's also effectively "not there", but in virtual grid context,
    // data should be populated.
    // Standard merge logic: rowspan=0 or colspan=0 means this cell is part of a merge but not the top-left cell.
    if (!cell) return false;
    return cell.rowspan === 0 || cell.colspan === 0;
};

// 计算合并后的单元格样式
const getMergedCellStyle = (
    rowIndex: number, 
    columnIndex: number, 
    style: React.CSSProperties, 
    mergedData: DataCell[][], 
    columns: CustomTreeNode[], 
    meta?: MetaItem[],
    currentCell?: any // Pass the potentially modified cell
) => {
    const originalCell = mergedData[rowIndex]?.[columnIndex];
    const cell = currentCell || originalCell;

    if (!cell) return undefined;
    // Note: We might be rendering a "cut-off" cell which originally had rowspan=0
    // So we don't return undefined here based on original rowspan if we have a modified cell.
    
    // However, if it's a normal covered cell (not the top of the viewport), we shouldn't be here
    // (controlled by Cell component logic)

    const newStyle: React.CSSProperties = { ...style };
    let column = columns[columnIndex];

    // Use meta logic to find the real column config if available
    const fieldParts = column.field.split('||');
    const realField = fieldParts[fieldParts.length - 1];
    const metaItem = meta?.find(m => m.field === realField || m.field === column.field);
    
    // Determine textAlign source
    const alignStyleSource = (metaItem?.style) || column?.style;

    // 计算合并后的宽度
    if (cell.colspan > 1) {
        let totalWidth = 0;
        // 累加合并列的宽度
        for (let i = columnIndex; i < columnIndex + cell.colspan; i++) {
            totalWidth += Number(columns[i]?.width) || 100;
        }
        newStyle.width = totalWidth;
    }
    // 计算合并后的高度
    if (cell.rowspan > 1) {
        newStyle.height = cell.rowspan * ROW_HEIGHT;
    }
    // Ensure height is at least one row height if it's a single cell (or modified one)
    if (!newStyle.height) {
         newStyle.height = ROW_HEIGHT;
    }

    // 处理对齐方式
    if (alignStyleSource?.textAlign) {
        newStyle.textAlign = alignStyleSource.textAlign;
        if (alignStyleSource.textAlign === 'right') {
            newStyle.justifyContent = 'flex-end'
        }
        if (alignStyleSource.textAlign === 'center') {
            newStyle.justifyContent = 'center'
        }
    }

    // 处理边框
    newStyle.border = '1px solid #f0f0f0';

    // 处理单元格内边距
    newStyle.padding = '8px 16px';

    // 处理垂直居中
    newStyle.display = 'flex';
    newStyle.alignItems = 'center';


    // 设置背景色
    newStyle.backgroundColor = '#fff';

    // 处理大跨度合并行的 z-index
    // 如果是虚拟起始行或者本身就是大合并的起始行，应用 z-index 策略
    // 逻辑：行索引越小，z-index 越大，保证上层内容覆盖下层（主要针对滚动时的重叠问题）
    if (cell.rowspan > OVERSCAN_COUNT) {
        // Base z-index 2000, decrease by rowIndex to ensure top rows are above bottom rows
        // We use a modulo or large number. Since it's virtual, rowIndex is relative to total data.
        // But we just need relative order for overlapping cells.
        // Actually, for "sticky" effect or just proper layering:
        // When we render a "virtual start" cell, it is effectively sticky at the top of the viewport relative to its group.
        // But in CSS flow, later elements usually cover earlier ones if z-index is auto.
        // We want the "start" (which might be visually above) to stay on top if there's overlap?
        // Wait, the requirement says "index smaller, z-index larger".
        // This implies earlier rows should cover later rows if they overlap.
        // This is useful if the virtual cell is fixed/sticky, but here it's absolutely positioned by react-window.
        // If we strictly follow the requirement:
        newStyle.zIndex = 10000 - rowIndex; 
        // Ensure it creates a stacking context
        newStyle.position = 'absolute'; // It's already absolute from style prop usually, but ensure it.
    }

    return newStyle;
};

const Cell: React.FC<CellProps> = ({ 
    columnIndex, 
    rowIndex, 
    style, 
    mergedData, 
    columns, 
    handleExpand, 
    meta, 
    mergedCellsMap, 
}) => {
    let cell = mergedData[rowIndex][columnIndex];
    let isVirtualStart = false;

    // Check if this cell is part of a merge but hidden (rowspan=0)
    if (cell.rowspan === 0 && mergedCellsMap) {
        const key = `${rowIndex}-${columnIndex}`;
        const mergeInfo = mergedCellsMap.get(key);
        
        // If we found merge info, check if we need to render this cell as a "virtual start"
        // This happens if the real start index is ABOVE the current row index
        // But wait, react-window renders a range of rows.
        // If rowIndex is the first rendered row (or close to top), and it's covered, we might want to show it.
        // But we don't know if it's the "first rendered row" easily without passing scrollTop/overscan info.
        // HOWEVER, the standard behavior of react-window is that it mounts this Cell component.
        // If react-window mounts it, it means it's in the DOM.
        // If it's in the DOM and has rowspan=0, it's usually hidden (returns null).
        // But if the "parent" (start of merge) is NOT in the DOM (because it's scrolled out), 
        // then this cell needs to take over responsibility.
        
        // How do we know if the parent is out of window?
        // We can infer it: if we are rendering this cell, react-window thinks it's visible.
        // Only apply virtual start logic if the merge is large enough to be cut off
        // Threshold should be related to overscan count. If overscan is 20, standard rendering handles up to 20.
        // We set threshold to OVERSCAN_COUNT.
        if (mergeInfo && mergeInfo.rowspan > OVERSCAN_COUNT && mergeInfo.startIndex < rowIndex) {
             // Calculate remaining rowspan
             // Original span: mergeInfo.rowspan
             // Rows passed: rowIndex - mergeInfo.startIndex
             // Remaining: mergeInfo.rowspan - (rowIndex - mergeInfo.startIndex)
             const remainingRowSpan = mergeInfo.rowspan - (rowIndex - mergeInfo.startIndex);
             
             // Construct a "virtual" cell
             cell = {
                 ...cell,
                 ...mergeInfo,
                 rowspan: remainingRowSpan,
                 // We might need to adjust content if it relies on being at the top, but usually content is same.
                 // onClick and others are copied from mergeInfo
             };
             isVirtualStart = true;
        }
    }

    // If it's still covered (and not converted to virtual start), return null
    if (!isVirtualStart && isCellCovered(rowIndex, columnIndex, mergedData)) {
        return null;
    }

    const mergedStyle = getMergedCellStyle(rowIndex, columnIndex, style, mergedData, columns, meta, cell);
    const column = columns[columnIndex]; 
    
    // Find meta config for this column
    // The column.field in pivot table might be like "key1|key2||metric"
    // We need to match against the last part (the metric field) if it's a composite key,
    // or exact match if it's a simple key.
    const fieldParts = column.field.split('||');
    const realField = fieldParts[fieldParts.length - 1];
    
    const metaItem = meta?.find(m => m.field === realField || m.field === column.field);
        
    // 检查内容是否为React元素
    const isReactElement = React.isValidElement(cell.content);

    // 处理不同类型的内容
    let cellContent: React.ReactNode;
    if (isReactElement) {
        // 如果是React元素，直接渲染
        cellContent = cell.content as React.ReactNode;
    } else {
        cellContent = cell.content;
    }

    // Apply formatter if exists
    // formatter exists on MetricNode, but column is CustomTreeNode (Union)
    // We should check if formatter exists
    if ('formatter' in column && column.formatter && !isReactElement) {
        // Pass original content and record/data
        cellContent = column.formatter(cellContent, cell.data);
    }

    // Apply clickHandler if exists in meta
    if (metaItem?.clickHandler && !isReactElement && cellContent !== null && cellContent !== undefined) {
        // Use row data. Note: cell.data usually contains the raw record or aggregated data.
        // If it's an aggregated cell, cell.data might be null or aggregated object.
        // Assuming cell.data or data[rowIndex] is what we want.
        // data[rowIndex] is TableRow, which has cells and rowKey. It doesn't have original data directly attached at root usually, 
        // but let's check DataCell definition. DataCell has `data?: any`.
        const rowData = cell.data;
        cellContent = (
            <a 
                href="javascript:void(0)" 
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    metaItem.clickHandler!(rowData);
                }}
                className="virtual-table-cell-link"
            >
                {cellContent}
            </a>
        );
    }

    return (
        <div
            style={mergedStyle}
            className={classNames("table-cell", "virtual-table-cell", {
                "virtual-table-cell-last": columnIndex === columns.length - 1
            })}
            title={typeof cellContent === 'string' ? cellContent : undefined}
        >
            <span className="expand-icon">
                {cell.expandable ? (
                    cell.expanded ? (
                        <UpCircleOutlined onClick={() => {
                            if (cell.onClick) cell.onClick(cell);
                            handleExpand(cell);
                        }} />
                    ) : (
                        <DownCircleOutlined onClick={() => {
                            if (cell.onClick) cell.onClick(cell);
                            handleExpand(cell);
                        }} />
                    )
                ) : null}
            </span>
            {cellContent}
        </div>
    );
};

export default Cell;
