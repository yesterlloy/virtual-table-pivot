/*
 * @Author: Yang yongjian
 * @Date: 2021-07-06 10:16:33
 * @LastEditors: Yang yongjian
 * @LastEditTime: 2026-01-22 17:46:48
 * @Description: file content
 * @FilePath: /virtual-table/src/crossTableHandler.jsx
 */
import pivotDataHandler from "./pivotHandler";


export const IDX_SEPERATER = "__";

// 使用WeakMap作为缓存，避免内存泄漏
export const crossTableCache = new WeakMap();



export const checkDataChanged = (params) => {
    console.group("crossTableHandler checkDataChanged")
    const { list } = params
    let rs = true
    console.log("checkDataChanged params", params)
    console.log("checkDataChanged crossTableCache", crossTableCache)
    if (crossTableCache.has(list)) {
        console.log("checkDataChanged crossTableCache has list")
        const cachedResults = crossTableCache.get(list);
        let cacheKey = getCacheKey(params);
        console.log("checkDataChanged cacheKey", cacheKey)
        if (cachedResults.has(cacheKey)) {
            console.log("checkDataChanged crossTableCache has cacheKey")
            rs = false
        }
    }
    console.log("checkDataChanged", rs)
    console.groupEnd("checkDataChanged")
    return rs
}

export const getCacheKey = ({
    list = [],
    rowdims = [],
    coldims = [],
    inds = [],
    orderParams = []
}) => {
    // 构建缓存键
    const cacheKey = JSON.stringify({
        listLength: list.length,
        rowdimsHash: rowdims.map(dim => dim.fieldName).join(','),
        coldimsHash: coldims.map(dim => dim.fieldName).join(','),
        indsHash: inds.map(ind => ind.fieldName).join(','),
        orderParamsHash: orderParams.map(op => `${op.paramName}-${op.sortVal}`).join(',')
    });
    return cacheKey;
}
export function tableDataHandler(params) {
    let {
        rowdims = [],
        coldims = [],
        inds = [],
        orderParams = []
    } = params;
    let list = params.list || [];

    if (list.length === 0) {
        return [];
    }



    let cacheKey = getCacheKey(params);
    // 检查缓存中是否已有结果
    if (crossTableCache.has(params.list)) {
        const cachedResults = crossTableCache.get(params.list);
        if (cachedResults.has(cacheKey)) {
            return cachedResults.get(cacheKey);
        }
    } else {
        crossTableCache.set(params.list, new Map());
    }

    let rows = rowdims.map(dm => ({
        field: dm.fieldName,
        title: dm.label || dm.fieldName,
        total: {
            enabled: dm.configData?.totalRowEnable,
            label: dm.configData?.totalRowName || '总计',
            position: dm.configData?.totalRowPosition || "top"
        },

        emptyReplace: dm.configData?.emptyReplace || "-",
        style: {
            textAlign: dm.configData?.align || "left",
        },
        sort: {
            enabled: dm.configData?.orderEnable,
            type: dm.configData?.orderType || "asc",
        },
    }));

    let columns = coldims.map(dm => ({
        field: dm.fieldName,
        title: dm.label || dm.fieldName,

        emptyReplace: dm.configData?.emptyReplace || "-",
        style: {
            textAlign: dm.configData?.align || "left",
        },
        sort: {
            enabled: dm.configData?.orderEnable,
            type: dm.configData?.orderType || "asc",
        },
    }));

    let values = inds.map(ind => ({
        field: ind.fieldName,
        title: ind.label || ind.fieldName,

        emptyReplace: ind.configData?.emptyReplace || "-",
        style: {
            textAlign: ind.configData?.align || "left",
        },
        calculateType: ind.configData?.calculateType || "sum"
    }));



    const pivotParams = {
        data: list,
        meta: [...rows, ...columns, ...values],
        sortParams: orderParams,
        fields: {
            rows,
            columns,
            values
        }
    };
    const pivotData = pivotDataHandler(pivotParams);
    console.log('pivotData', performance.now(), pivotData)



    // 将结果存入缓存
    if (!crossTableCache.has(params.list)) {
        crossTableCache.set(params.list, new Map());
    }
    crossTableCache.get(params.list).set(cacheKey, pivotData);

    return pivotData;
}


