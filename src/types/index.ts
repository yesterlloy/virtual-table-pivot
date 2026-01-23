import React from 'react';

export interface CustomTreeNode {
    /**
     * 字段唯一标识
     */
    field: string;
    /**
     * 标题
     */
    title?: string;
    /**
     * 是否收起（默认都展开）
     * @description 优先级 `collapseFields` > `expandDepth` > `collapseAll` > `collapsed`
     */
    collapsed?: boolean;
    /**
     * 字段描述
     */
    description?: string;
    /**
     * 子节点
     */
    children?: CustomTreeNode[];
    
    // Additional properties inferred from usage
    width?: number | string;
    total?: {
        enabled: boolean;
        label?: string;
        position?: 'top' | 'bottom';
    };
    emptyReplace?: string;
    calculateType?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'd_count' | 'variance' | 'stddev';
    sort?: {
        enabled: boolean;
        type: 'asc' | 'desc';
    };
    style?: React.CSSProperties;
    fixed?: boolean | string;
    colSpan?: number;
    dataIndex?: string;
    render?: (val: any, record: any, index: number) => React.ReactNode;
    type?: string; // e.g. 'group'
}

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
    rows: CustomTreeNode[];
    columns: CustomTreeNode[];
    values: CustomTreeNode[];
}

export interface PivotParams {
    data: any[];
    meta: MetaItem[];
    sortParams: SortParam[];
    fields: PivotFields;
}
