import React, {
    useState,
    useEffect,
    useRef,
    memo,
    useCallback,
    useMemo
} from "react";
import ResizeObserver from "rc-resize-observer";
import classNames from "classnames";
import TableHeader from "./TableHeader";
import { cloneDeep } from "@/utils/cloneDeep";
import { COL_WIDTH } from "@/utils/vars";
import Renderer from "./Renderer";
import { dataHandler } from "@/utils/dataHandler";
import { PivotParams, TableRow, CustomTreeNode } from "@/types";
// @ts-ignore
import "./index.less";

interface VirtualTableProps extends PivotParams {
    scroll?: { x?: number | string; y?: number | string };
    className?: string;
    style?: React.CSSProperties;
}

export default memo((props: VirtualTableProps) => {
    const { scroll, data, meta, sortParams, fields } = props;
    console.log('VirtualTable init props==', props)
    const [tableWidth, setTableWidth] = useState(0);
    //当前占用的宽度总和
    // const [usedWidth, setUsedWidth] = useState(0); // Removing this state to avoid loop
    // const [colCount, setColCount] = useState(0); // Removing this state to avoid loop
    const [list, setList] = useState<TableRow[]>([]);
    const [columns, setColumns] = useState<CustomTreeNode[]>([]);
    console.log('list', list)

    // 列表处理函数，用于展开收起功能处理
    const listHandlerRef = useRef<{
        list: TableRow[];
        dataExpandFilter: (list: TableRow[]) => TableRow[];
        tableColumns?: CustomTreeNode[];
    } | null>(null);

    const handleExpand = useCallback(() => {
        if (listHandlerRef.current) {
            let rs = listHandlerRef.current;
            console.log('rs=', rs);
            if (!rs || !rs.list || !rs.dataExpandFilter) {
                return;
            }
            setList(rs.dataExpandFilter(rs.list));
        }
    }, []);

    useEffect(() => {
        const params: PivotParams = {
            data,
            meta,
            sortParams,
            fields
        };

        let rs = dataHandler(params);
        listHandlerRef.current = rs;
        if (rs.tableColumns) {
            setColumns(rs.tableColumns);
        }
        handleExpand();
    }, [data, meta, sortParams, fields, handleExpand]);

    // 将宽度转换成数字
    const getIntWidth = useCallback((wid: string | number | undefined) => {
        if (!wid) {
            return 0;
        }
        if (typeof wid === "string") {
            return parseInt(wid.replace("px", "")) || 0;
        }
        return typeof wid === "number" ? wid : 0;
    }, []);

    // 计算基础列宽总和和列数量
    const { baseWidth, colCount } = useMemo(() => {
        let totalWidth = 0;
        let totalCount = 0;

        const countColumns = (list: CustomTreeNode[]) => {
            list.forEach(col => {
                // 检查是否是分组节点
                if (!('type' in col) || col.type !== "group") {
                    totalWidth += getIntWidth(col.width);
                    totalCount += 1;
                }
                if (col?.children && col.children.length > 0) {
                    countColumns(col.children);
                }
            });
        };

        countColumns(columns);
        return { baseWidth: totalWidth, colCount: totalCount };
    }, [columns, getIntWidth]);

    // 处理合并列的列宽计算
    const mergedColumns = useMemo(() => {
        const mergeColumn = (list: CustomTreeNode[]) => {
            return list.map(column => {
                // 列宽不满时，分到每个列上
                let avg = 0;
                // 使用 baseWidth 而不是依赖 effect 更新的 usedWidth
                if (baseWidth < tableWidth && colCount > 0) {
                    avg = Math.floor((tableWidth - baseWidth) / colCount);
                }

                // 处理普通列
                const widthValue = column.width ? getIntWidth(column.width) : COL_WIDTH;
                const adjustedWidth = widthValue + avg;

                // 处理列合并
                if (column.colSpan && column.colSpan > 1) {
                    // 如果有列合并，计算合并后的宽度
                    column.width = adjustedWidth * column.colSpan;
                } else {
                    column.width = adjustedWidth;
                }

                // 禁用固定列，虚拟滚动不支持固定列
                if (column.fixed) {
                    column.fixed = false;
                }

                // 递归处理子列
                if (column?.children && column.children.length > 0) {
                    column.children = mergeColumn(column.children);
                }

                return column;
            });
        };

        return mergeColumn(cloneDeep(columns));
    }, [columns, baseWidth, tableWidth, colCount, getIntWidth]);


    // 计算最终使用宽度（用于Renderer）
    const finalUsedWidth = useMemo(() => {
        let totalWidth = 0;
        const countColumns = (list: CustomTreeNode[]) => {
            list.forEach(col => {
                if (!('type' in col) || col.type !== "group") {
                    totalWidth += getIntWidth(col.width);
                }
                if (col?.children && col.children.length > 0) {
                    countColumns(col.children);
                }
            });
        };
        countColumns(mergedColumns);
        return totalWidth;
    }, [mergedColumns, getIntWidth]);

    // 滚动联动处理
    const headerRef = useRef<HTMLDivElement>(null);
    const bodyRef = useRef<any>(null); // Grid ref
    const isScrolling = useRef(false);

    const handleBodyScroll = useCallback(({ scrollLeft }: { scrollLeft: number }) => {
        if (isScrolling.current) return;
        isScrolling.current = true;

        if (headerRef.current) {
            headerRef.current.scrollLeft = scrollLeft;
        }

        requestAnimationFrame(() => {
            isScrolling.current = false;
        });
    }, []);

    const handleHeaderScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        if (isScrolling.current) return;
        isScrolling.current = true;

        const scrollLeft = e.currentTarget.scrollLeft;
        if (bodyRef.current) {
            bodyRef.current.scrollLeft = scrollLeft;
        }

        requestAnimationFrame(() => {
            isScrolling.current = false;
        });
    }, []);

    return (
        <ResizeObserver
            onResize={({ width }) => {
                if (width && width !== tableWidth) {
                    setTableWidth(width);
                }
            }}>
            <div
                className={classNames("virtual-table", props.className)}
                style={{ width: '100%', ...props.style }}
            >
                <TableHeader
                    ref={headerRef}
                    columns={mergedColumns}
                    width={tableWidth - 8} // Subtract approximate scrollbar width
                    onScroll={handleHeaderScroll}
                    meta={meta}
                />
                <div className="virtual-table-body" style={{ width: '100%' }}>
                    <Renderer
                        data={list}
                        info={{
                            ref: bodyRef,
                            onScroll: handleBodyScroll
                        }}
                        scroll={scroll}
                        columns={mergedColumns}
                        tableWidth={tableWidth}
                        gridWidth={finalUsedWidth}
                        handleExpand={handleExpand}
                        meta={meta}
                    />
                </div>
            </div>
        </ResizeObserver>
    );
});
