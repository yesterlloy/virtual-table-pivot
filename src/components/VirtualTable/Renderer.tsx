import React, {
    useEffect,
    useRef,
    useCallback,
    useMemo
} from "react";
import { Grid } from "react-window";
// @ts-ignore
import "./index.less";
import Cell, { CellProps } from "./Cell";
import { ROW_HEIGHT } from "@/utils/vars";
import { TableRow, CustomTreeNode, MetaItem } from "@/types";

interface RendererProps {
    data: TableRow[];
    info: {
        ref: any;
        onScroll: (props: { scrollLeft: number; scrollTop: number }) => void;
        scrollbarSize?: number;
    };
    scroll?: { x?: number | string; y?: number | string };
    columns: CustomTreeNode[];
    tableWidth: number;
    gridWidth: number;
    handleExpand: (record: any) => void;
    meta?: MetaItem[];
}

type UserCellProps = Omit<CellProps, 'columnIndex' | 'rowIndex' | 'style'>;

const Renderer: React.FC<RendererProps> = (props) => {
    const { data, info, scroll, columns, tableWidth } = props;
    // console.log('renderer props', props);
    const { ref, onScroll } = info;
    const gridRef = useRef<any>();

    // 创建connectObject用于处理scrollLeft
    const connectObject = useMemo(() => {
        const obj = {};
        Object.defineProperty(obj, "scrollLeft", {
            get: () => gridRef.current?.element?.scrollLeft || 0,
            set: scrollLeft => {
                if (gridRef.current?.element) {
                    gridRef.current.element.scrollLeft = scrollLeft;
                }
            }
        });
        Object.defineProperty(obj, "scrollTop", {
            get: () => gridRef.current?.element?.scrollTop || 0,
            set: scrollTop => {
                if (gridRef.current?.element) {
                    gridRef.current.element.scrollTop = scrollTop;
                }
            }
        });
        return obj;
    }, []);

    // 设置ref
    useEffect(() => {
        if (ref) {
            ref.current = connectObject;
        }
    }, [ref, connectObject]);

    // 获取实际数据行
    const tableData = data;

    // 计算行总数（考虑合并行）
    const rowCount = tableData.length;

    // 递归计算实际的列数
    const calculateActualColumnCount = useCallback((columns: CustomTreeNode[]): number => {
        let count = 0;
        columns.forEach((col) => {
            if (col?.children && col.children.length > 0) {
                count += calculateActualColumnCount(col.children);
            } else {
                count += 1;
            }
        });
        return count;
    }, []);

    // 计算实际的列总数
    const columnCount = calculateActualColumnCount(columns);

    // 递归获取所有叶子节点的列
    const getAllLeafColumns = useCallback((columns: CustomTreeNode[]): CustomTreeNode[] => {
        let leafColumns: CustomTreeNode[] = [];
        columns.forEach((col) => {
            if (col?.children && col.children.length > 0) {
                leafColumns = [...leafColumns, ...getAllLeafColumns(col.children)];
            } else {
                leafColumns.push(col);
            }
        });
        return leafColumns;
    }, []);

    // 获取所有叶子节点的列
    const leafColumns = getAllLeafColumns(columns);

    // 计算列宽
    const getColumnWidth = useCallback((index: number) => {
        const column = leafColumns[index];
        // Handle width being number or string (like "100px")
        let w = column?.width || 100;
        if (typeof w === 'string') {
            w = parseInt(w.replace('px', '')) || 100;
        }
        return w;
    }, [leafColumns]);

    // 计算行高（考虑合并行）
    const getRowHeight = useCallback((_index: number) => {
        // Just return constant row height for now
        return ROW_HEIGHT; 
    }, []);

    // 准备合并数据结构
    const mergedData = useMemo(() => {
        // Just return the cells array from tableData
        return tableData.map(row => row.cells);
    }, [tableData]);

    // 处理滚动事件
    const handleScroll = useCallback((e: any) => {
        // If e has scrollLeft/scrollTop (v1 style)
        if (e && typeof e.scrollLeft === 'number') {
             if (onScroll) onScroll(e);
             return;
        }
        
        // If e is a React synthetic event (v2 might just pass props to div)
        if (e && e.target) {
            const { scrollLeft, scrollTop } = e.target;
            if (onScroll) {
                onScroll({ scrollLeft, scrollTop });
            }
        }
    }, [onScroll]);


    // 计算最大行合并数
    const maxRowSpan = useMemo(() => {
        let max = 1;
        if (data && data.length > 0) {
            data.forEach(row => {
                if (row.cells) {
                    row.cells.forEach(cell => {
                        if (cell.rowspan > max) {
                            max = cell.rowspan;
                        }
                    });
                }
            });
        }
        return max;
    }, [data]);

    // 计算表格高度
    const tableHeight = (typeof scroll?.y === 'number' ? scroll.y : parseInt(scroll?.y as string || '400')) || 400;

    return (
        <Grid<UserCellProps>
            gridRef={gridRef}
            columnCount={columnCount}
            columnWidth={getColumnWidth}
            rowCount={rowCount}
            rowHeight={getRowHeight} // Use simplified height
            style={{ height: tableHeight - 40, width: tableWidth, overflowY: 'auto' }}
            onScroll={handleScroll}
            className={`virtual-grid row-${maxRowSpan}`}
            overscanCount={maxRowSpan + 3}
            
            cellComponent={Cell as any}
            cellProps={{
                mergedData,
                columns: leafColumns,
                data: tableData,
                handleExpand: props.handleExpand,
                meta: props.meta
            }}
        />
    );
};

export default Renderer;
