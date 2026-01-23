import React from "react";
import classNames from "classnames";
import { ROW_HEIGHT } from "@/utils/vars";
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
}

// 检查单元格是否被合并覆盖
const isCellCovered = (rowIndex: number, columnIndex: number, mergedData: DataCell[][]) => {
    const cell = mergedData[rowIndex]?.[columnIndex];
    return !cell || cell.rowspan === 0 || cell.colspan === 0;
};

// 计算合并后的单元格样式
const getMergedCellStyle = (rowIndex: number, columnIndex: number, style: React.CSSProperties, mergedData: DataCell[][], columns: CustomTreeNode[]) => {
    const cell = mergedData[rowIndex]?.[columnIndex];
    if (!cell || cell.rowspan === 0 || cell.colspan === 0) return undefined;

    const newStyle: React.CSSProperties = { ...style };
    const column = columns[columnIndex];

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

    // 处理对齐方式
    if (column?.style?.textAlign) {
        newStyle.textAlign = column.style.textAlign;
        if (column.style.textAlign === 'right') {
            newStyle.justifyContent = 'flex-end'
        }
        if (column.style.textAlign === 'center') {
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

    return newStyle;
};

const Cell: React.FC<CellProps> = ({ columnIndex, rowIndex, style, mergedData, columns, handleExpand, meta }) => {
    if (isCellCovered(rowIndex, columnIndex, mergedData)) {
        return null;
    }

    const cell = mergedData[rowIndex][columnIndex];
    const mergedStyle = getMergedCellStyle(rowIndex, columnIndex, style, mergedData, columns);
    const column = columns[columnIndex]; 
    
    // Find meta config for this column
    const metaItem = meta?.find(m => m.field === column.field);

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
                style={{ cursor: 'pointer', textDecoration: 'underline', color: '#1890ff' }}
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
                        <DownCircleOutlined onClick={() => {
                            console.log('DownCircleOutlined onClick', cell);
                            if (cell.onClick) cell.onClick(cell);
                            handleExpand(cell);
                        }} />
                    ) : (
                        <UpCircleOutlined onClick={() => {
                            console.log('UpCircleOutlined onClick', cell);
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
