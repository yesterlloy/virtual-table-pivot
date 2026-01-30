import React from 'react';

export interface BaseNode {
    /**
     * 字段唯一标识
     */
    field: string;
    /**
     * 标题
     */
    title?: string;
    /**
     * 字段描述
     */
    description?: string;
    width?: number | string;
    style?: React.CSSProperties;
    fixed?: boolean | string;
    colSpan?: number;
    dataIndex?: string;
    hidden?: boolean;
    key?: string;
    children?: BaseNode[];
}

export interface DimensionNode extends BaseNode {
    /**
     * 是否收起（默认都展开）
     * @description 优先级 `collapseFields` > `expandDepth` > `collapseAll` > `collapsed`
     */
    collapsed?: boolean;
    total?: {
        enabled: boolean;
        label?: string;
        position?: 'top' | 'bottom';
    };
    sort?: {
        enabled: boolean;
        type: 'asc' | 'desc';
    };
    clickExpandChildren?: boolean;
    children?: DimensionNode[];
}

export interface MetricNode extends BaseNode {
    emptyReplace?: string;
    calculateType?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'd_count' | 'variance' | 'stddev' | 'expr';
    expression?: string;
    render?: (val: any, record: any, index: number) => React.ReactNode;
    formatter?: (val: any, record: any) => React.ReactNode;
    type?: string; // e.g. 'group'
    children?: MetricNode[];
}

export type CustomTreeNode = DimensionNode | MetricNode;

export interface DataCell {
    content: string | number | null | undefined;
    rowspan: number;
    colspan: number;
    data?: any;
    rowKey?: string;
    expandable?: boolean;
    expanded?: boolean;
    level?: number;
    onClick?: (record: any) => void;
    style?: React.CSSProperties;
}

export interface TableRow {
    cells: DataCell[];
    rowKey: string;
}

export interface MetaItem {
    field?: string;
    title?: string;
    description?: string;
    clickHandler?: (data: any) => void;
}

export interface SortParam {
    field: string;
    sortType: 'asc' | 'desc';
}

export interface PivotFields {
    rows: DimensionNode[];
    columns: DimensionNode[];
    values: MetricNode[];
}

export interface PivotParams {
    data: any[];
    meta: MetaItem[];
    sortParams: SortParam[];
    fields: PivotFields;
}
