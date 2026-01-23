import React, { useMemo, forwardRef } from 'react';
import classNames from 'classnames';
// @ts-ignore
import "./index.less";
import { CustomTreeNode } from "@/types";

interface TableHeaderProps {
    columns: CustomTreeNode[];
    width: number;
    onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
}

interface HeaderCell {
    key: string;
    title: React.ReactNode;
    width?: number | string;
    align?: 'left' | 'right' | 'center';
    className?: string;
    colSpan: number;
    rowSpan: number;
}

const TableHeader = forwardRef<HTMLDivElement, TableHeaderProps>(({ columns, width, onScroll }, ref) => {
    // 处理表头分组和合并
    const headerRows = useMemo(() => {
        const rows: HeaderCell[][] = [];

        // 计算最大深度
        const getDepth = (cols: CustomTreeNode[]): number => {
            let maxDepth = 0;
            cols.forEach(col => {
                if (col.children && col.children.length > 0) {
                    const depth = getDepth(col.children);
                    if (depth > maxDepth) maxDepth = depth;
                }
            });
            return maxDepth + 1;
        };

        const maxDepth = getDepth(columns);

        // 递归生成表头行
        const generateRows = (cols: CustomTreeNode[], depth: number) => {
            if (!rows[depth]) rows[depth] = [];

            cols.forEach(col => {
                const cell: HeaderCell = {
                    key: col.field || col.dataIndex || (col.title as string) || String(Math.random()),
                    title: col.title,
                    width: col.width,
                    align: (col.style?.textAlign as any) || 'center',
                    className: undefined, // col.className not in type, ignore
                    colSpan: 1,
                    rowSpan: 1
                };

                if (col.children && col.children.length > 0) {
                    // 如果有子列，计算colSpan
                    const getLeafCount = (c: CustomTreeNode): number => {
                        if (c.children && c.children.length > 0) {
                            return c.children.reduce((acc, child) => acc + getLeafCount(child), 0);
                        }
                        return 1;
                    };
                    cell.colSpan = getLeafCount(col);
                    rows[depth].push(cell);
                    generateRows(col.children, depth + 1);
                } else {
                    // 如果是叶子节点，计算rowSpan
                    cell.rowSpan = maxDepth - depth;
                    rows[depth].push(cell);
                }
            });
        };

        generateRows(columns, 0);
        return rows;
    }, [columns]);

    return (
        <div
            ref={ref}
            className="virtual-table-header hide-scrollbar"
            style={{ overflow: 'auto', width }}
            onScroll={onScroll}
        >
            <table style={{ tableLayout: 'fixed', width: '100%' }}>
                <colgroup>
                    {columns.map((col, index) => {
                        // 递归获取所有叶子节点的宽度
                        const getLeafWidths = (c: CustomTreeNode): (number | string | undefined)[] => {
                            if (c.children && c.children.length > 0) {
                                return c.children.flatMap(getLeafWidths);
                            }
                            return [c.width];
                        };
                        return getLeafWidths(col).map((w, i) => (
                            <col key={`${index}-${i}`} style={{ width: w, minWidth: w }} />
                        ));
                    }).flat()}
                </colgroup>
                <thead className="virtual-table-thead">
                    {headerRows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="virtual-table-row">
                            {row.map((cell, cellIndex) => (
                                <th
                                    key={cellIndex}
                                    className={classNames('virtual-table-cell', cell.className)}
                                    colSpan={cell.colSpan}
                                    rowSpan={cell.rowSpan}
                                    title={cell.title as string}
                                    style={{
                                        textAlign: cell.align,
                                    }}
                                >
                                    {cell.title}
                                </th>
                            ))}
                        </tr>
                    ))}
                </thead>
            </table>
        </div>
    );
});

export default TableHeader;
