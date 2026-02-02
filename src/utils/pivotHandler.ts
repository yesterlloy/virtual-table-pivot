/**
 * 透视表数据处理
 * 
 * fields 配置项
 *
 */
import { EMPTY_VALUE, TOTAL_DEFAULT_VALUE } from './vars';
import { CustomTreeNode, PivotParams, DataCell, TableRow, DimensionNode, MetricNode } from '@/types';

// 辅助函数：递归获取所有叶子节点
const getAllLeafNodes = (nodes: CustomTreeNode[]): CustomTreeNode[] => {
    const leafNodes: CustomTreeNode[] = [];

    const traverse = (node: CustomTreeNode) => {
        if (node.children && node.children.length > 0) {
            node.children.forEach(child => traverse(child));
        } else {
            leafNodes.push(node);
        }
    };

    nodes.forEach(node => traverse(node));
    return leafNodes;
};

// 辅助函数：获取字段值
const getFieldValue = (record: any, fieldPath: string) => {
    const fields = fieldPath.split('.');
    let value = record;

    for (const field of fields) {
        if (value === null || value === undefined) return value;
        value = value[field];
    }

    if (value === null || value === undefined) {
        value = EMPTY_VALUE;
    };

    return value;
};

// 辅助函数：生成唯一键
//生成的key需要|开头
const generateKey = (record: any, fields: string[]) => {
    let key = fields.map(field => getFieldValue(record, field)).join('|');
    return '|' + key;
};

// 辅助函数：计算表达式
const evaluateExpression = (expression: string, context: Record<string, number>): number | null => {
    if (!expression) return null;
    try {
        // 替换变量 {field} -> value
        // 使用正则替换，同时检查上下文是否存在该值
        const processedExpr = expression.replace(/\{(\w+)\}/g, (_match, field) => {
            const value = context[field];
            // 如果引用值不存在或非数字，视为0 (或者根据策略处理)
            return (value !== undefined && value !== null && !isNaN(value)) ? String(value) : '0';
        });

        // 安全性检查：仅允许数字、运算符、括号、小数点
        if (!/^[\d\.\+\-\*\/\(\)\s]+$/.test(processedExpr)) {
            console.warn('Invalid characters in expression:', expression);
            return null;
        }

        // 执行计算
        return new Function(`return ${processedExpr}`)();
    } catch (error) {
        console.error('Expression evaluation error:', expression, error);
        return null;
    }
};

// 聚合函数映射
const aggregators: Record<string, (values: any[]) => number> = {
    sum: (values) => values.reduce((acc, val) => acc + (Number(val) || 0), 0),
    avg: (values) => {
        const validValues = values.filter(val => !isNaN(Number(val)));
        return validValues.length > 0 ? validValues.reduce((acc, val) => acc + Number(val), 0) / validValues.length : 0;
    },
    count: (values) => values.length,
    min: (values) => Math.min(...values.map(val => Number(val) || Infinity)),
    max: (values) => Math.max(...values.map(val => Number(val) || -Infinity)),
    d_count: (values) => new Set(values).size,
    variance: (values) => {
        const validValues = values.map(val => Number(val)).filter(val => !isNaN(val));
        if (validValues.length === 0) return 0;
        const mean = validValues.reduce((acc, val) => acc + val, 0) / validValues.length;
        const squareDiffs = validValues.map(val => Math.pow(val - mean, 2));
        return squareDiffs.reduce((acc, val) => acc + val, 0) / validValues.length;
    },
    stddev: (values) => {
        const validValues = values.map(val => Number(val)).filter(val => !isNaN(val));
        if (validValues.length === 0) return 0;
        const mean = validValues.reduce((acc, val) => acc + val, 0) / validValues.length;
        const squareDiffs = validValues.map(val => Math.pow(val - mean, 2));
        const variance = squareDiffs.reduce((acc, val) => acc + val, 0) / validValues.length;
        return Math.sqrt(variance);
    },
};

// 展开/收起状态管理
// 结构：expandState[level][rowValue] = true/false
const expandState = new Map<number, Map<string, boolean>>();

// 点击事件状态
const currentClickState = new Map<string, any>();

// 合计行状态管理
const totalState = new Map<string, number>();

const pivotDataHandler = (params: PivotParams) => {
    const { data, sortParams, fields } = params;
    const { rows, columns, values } = fields;

    // 如果没有数据或没有配置维度，直接返回空结果
    if (!data || data.length === 0 || (!rows.length && !columns.length && !values.length)) {
        return {
            list: [],
            dataExpandFilter: (list: any[]) => list
        };
    }
    console.group('透视表数据处理');

    // 获取所有叶子节点
    const rowLeafNodes = getAllLeafNodes(rows) as DimensionNode[];
    const colLeafNodes = getAllLeafNodes(columns) as DimensionNode[];
    const valueLeafNodes = (getAllLeafNodes(values) as MetricNode[]).filter(node => !node.hidden);
    console.log('透视表值字段', valueLeafNodes);

    // 提取字段名
    const rowFields = rowLeafNodes.map(node => node.field);
    const colFields = colLeafNodes.map(node => node.field);
    // const valueFields = valueLeafNodes.map(node => node.field);

    // 数据分组
    const rowGroupMap = new Map<string, any[]>();
    const colGroupMap = new Map<string, any[]>();
    const cellDataMap = new Map<string, any[]>(); // 用于快速查找单元格数据的映射

    // 按行维度和列维度分组
    data.forEach(record => {
        // 按行分组
        const rowKey = generateKey(record, rowFields);
        if (!rowGroupMap.has(rowKey)) {
            rowGroupMap.set(rowKey, []);
        }
        rowGroupMap.get(rowKey)!.push(record);

        // 按列分组
        const colKey = generateKey(record, colFields);
        if (!colGroupMap.has(colKey)) {
            colGroupMap.set(colKey, []);
        }
        colGroupMap.get(colKey)!.push(record);

        // 按单元格分组（行+列）
        const cellKey = `${rowKey}||${colKey}`;
        if (!cellDataMap.has(cellKey)) {
            cellDataMap.set(cellKey, []);
        }
        cellDataMap.get(cellKey)!.push(record);
    });

    // 应用排序
    const sortRowGroups = () => {
        return Array.from(rowGroupMap.entries()).sort(([_keyA, dataA], [_keyB, dataB]) => {
            // 1. 优先使用外部传入的 sortParams
            if (sortParams && sortParams.length > 0) {
                for (const sortParam of sortParams) {
                    const { field, sortType } = sortParam;
                    const isAsc = sortType === 'asc';

                    const valueA = getFieldValue(dataA[0], field);
                    const valueB = getFieldValue(dataB[0], field);

                    if (valueA < valueB) return isAsc ? -1 : 1;
                    if (valueA > valueB) return isAsc ? 1 : -1;
                }
            }

            // 2. 使用行维度配置的排序
            for (let i = 0; i < rowFields.length; i++) {
                const field = rowFields[i];
                const config = rowLeafNodes[i];
                const valueA = getFieldValue(dataA[0], field);
                const valueB = getFieldValue(dataB[0], field);

                if (valueA === valueB) continue;

                if (config.sort && config.sort.enabled) {
                    const isAsc = config.sort.type === 'asc';
                    if (valueA < valueB) return isAsc ? -1 : 1;
                    if (valueA > valueB) return isAsc ? 1 : -1;
                } else {
                    // 默认排序
                    if (valueA < valueB) return -1;
                    if (valueA > valueB) return 1;
                }
            }

            return 0;
        });
    };

    // 应用列排序
    const sortColGroups = () => {
        return Array.from(colGroupMap.entries()).sort(([_keyA, dataA], [_keyB, dataB]) => {
            for (let i = 0; i < colFields.length; i++) {
                const field = colFields[i];
                const config = colLeafNodes[i];
                const valueA = getFieldValue(dataA[0], field);
                const valueB = getFieldValue(dataB[0], field);

                if (valueA === valueB) continue;

                if (config.sort && config.sort.enabled) {
                    const isAsc = config.sort.type === 'asc';
                    if (valueA < valueB) return isAsc ? -1 : 1;
                    if (valueA > valueB) return isAsc ? 1 : -1;
                } else {
                    // 默认按字段值升序排序
                    if (valueA < valueB) return -1;
                    if (valueA > valueB) return 1;
                }
            }
            return 0;
        });
    };

    // 辅助函数：获取行维度的层级结构
    const getRowHierarchy = () => {
        const hierarchy: DimensionNode[][] = [];
        const leafNodes = getAllLeafNodes(rows) as DimensionNode[];

        // 按顺序组合生成层级
        for (let i = 1; i <= leafNodes.length; i++) {
            // 第i级包含前i个行维度
            hierarchy.push(leafNodes.slice(0, i));
        }

        return hierarchy;
    };

    // 辅助函数：获取启用小计的行维度级别
    const getEnabledSubtotalLevels = () => {
        const rowHierarchy = getRowHierarchy();
        const enabledLevels = new Set<number>();

        rowHierarchy.forEach((levelNodes, level) => {
            const currentNode = levelNodes[levelNodes.length - 1];
            const hasSubtotal = currentNode.total && currentNode.total.enabled;
            if (hasSubtotal) {
                enabledLevels.add(level);
            }
        });

        return enabledLevels;
    };

    // 计算行维度小计
    const calculateRowSubtotals = () => {
        const rowHierarchy = getRowHierarchy();
        const subtotals: { level: number; data: Record<string, { records: any[]; config: any }> }[] = [];
        const enabledLevels = getEnabledSubtotalLevels();

        // 如果没有启用小计的级别，直接返回空数组
        if (enabledLevels.size === 0) return subtotals;

        // 处理所有启用小计的级别
        enabledLevels.forEach(level => {
            let levelNodes: CustomTreeNode[] = [];
            if (level > 0) {
                levelNodes = rowHierarchy[level - 1];
            }

            // 为当前级别计算小计
            const levelSubtotals: Record<string, { records: any[]; config: any }> = {};

            // 遍历所有数据行，按当前层级的字段值分组
            data.forEach(record => {
                let groupKey = '';
                if (level > 0) {
                    groupKey = levelNodes.map(node => getFieldValue(record, node.field)).join('|');
                } else {
                    groupKey = '__GLOBAL__';
                }

                if (!levelSubtotals[groupKey]) {
                    const configNode = rowHierarchy[level][level];
                    const subtotalConfig = configNode.total;
                    levelSubtotals[groupKey] = {
                        records: [],
                        config: subtotalConfig
                    };
                }
                levelSubtotals[groupKey].records.push(record);
            });

            subtotals.push({ level, data: levelSubtotals });
        });

        return subtotals;
    };

    // 获取排序后的列组
    const sortedColGroups = sortColGroups();

    // 记录每个级别的第一条子项
    const firstChildMap = new Map<string, string>();

    // 切换展开/收起状态
    const toggleExpand = (level: number, rowKey: string) => {
        console.log('toggleExpand', level, rowKey);
        if (expandState.has(level)) {
            const levelState = expandState.get(level)!;
            const currentState = levelState.get(rowKey);
            const newState = !currentState;
            levelState.set(rowKey, newState);

            // 更新当前点击状态
            currentClickState.set('rowKey', rowKey);
            currentClickState.set('level', level);
            currentClickState.set('expanded', newState);

            // Handle clickExpandChildren behavior
            // Check configuration for current level
            // Note: level is 1-based index (1, 2, 3...)
            // rowLeafNodes is 0-based array
            const nodeIndex = level - 1;
            if (nodeIndex >= 0 && nodeIndex < rowLeafNodes.length) {
                const node = rowLeafNodes[nodeIndex];
                if (node.clickExpandChildren && newState === true) {
                    // Expand all children of this node
                    // We need to find all child rows that start with the current rowKey
                    const childLevel = level + 1;
                    if (expandState.has(childLevel)) {
                        const childLevelState = expandState.get(childLevel)!;
                        // Iterate all keys in child level
                        // Key format: |Level1Value|Level2Value...
                        // Current rowKey: |Level1Value
                        // Child key should start with rowKey + '|'
                        const prefix = rowKey + '|';
                        childLevelState.forEach((_val, key) => {
                            if (key.startsWith(prefix)) {
                                childLevelState.set(key, true);
                                // Recursively expand if needed? 
                                // Requirement says "expand all subsequent row dimension data for that node".
                                // This might imply deep expansion or just next level.
                                // "expand all" suggests deep.
                                // Let's try to expand deeply.
                                toggleExpandChildren(childLevel, key);
                            }
                        });
                    }
                }
            }
        }
    };

    const toggleExpandChildren = (level: number, parentKey: string) => {
        const childLevel = level + 1;
        if (expandState.has(childLevel)) {
            const childLevelState = expandState.get(childLevel)!;
            const prefix = parentKey + '|';
            childLevelState.forEach((_val, key) => {
                if (key.startsWith(prefix)) {
                    childLevelState.set(key, true);
                    toggleExpandChildren(childLevel, key);
                }
            });
        }
    };

    // 生成小计行
    const generateSubtotalRows = (dataRows: DataCell[][]) => {
        const subtotals = calculateRowSubtotals();
        const resultRows = [...dataRows];

        // 如果没有小计配置，直接返回原数据
        if (subtotals.length === 0) return resultRows;

        // 按层级从高到低处理小计（从最内层到最外层）
        for (let i = 0; i < subtotals.length; i++) {
            const { level, data: levelSubtotals } = subtotals[i];

            // 遍历当前层级的所有小计组
            Object.keys(levelSubtotals).forEach(groupKey => {
                const { records, config } = levelSubtotals[groupKey];
                const { label = TOTAL_DEFAULT_VALUE, position = 'bottom' } = config || {};

                // 查找当前组在数据中的位置
                const groupValues = groupKey.split('|');
                let startIndex = -1;
                let endIndex = -1;

                if (level === 0) {
                    // 全局合计，匹配所有行
                    startIndex = 0;
                    endIndex = resultRows.length - 1;
                } else {
                    for (let j = 0; j < resultRows.length; j++) {
                        const row = resultRows[j];
                        // 匹配逻辑改为匹配前level个字段
                        const match = rowFields.slice(0, level).every((_field, idx) => {
                            return row[idx]?.content === groupValues[idx];
                        });

                        if (match) {
                            if (startIndex === -1) startIndex = j;
                            endIndex = j;
                        }
                    }
                }

                if (startIndex !== -1) {
                    // 生成小计行
                    const subtotalRow: DataCell[] = [];

                    // 添加行维度数据
                    let currentSubtotalRowKey = '';
                    rowFields.forEach((_field, idx) => {
                        let value: any = EMPTY_VALUE;
                        const currentLevel = idx + 1;
                        const hasNextLevel = currentLevel < rowFields.length;
                        const fieldConfig = rowLeafNodes[idx];

                        if (idx <= level) {
                            if (idx === level) {
                                value = label;
                            } else {
                                value = groupValues[idx];
                            }
                            currentSubtotalRowKey += `|${value}`;
                        }

                        // 检查当前级别的展开状态
                        const isExpanded = expandState.has(currentLevel) ? expandState.get(currentLevel)!.get(currentSubtotalRowKey) || true : true;

                        // 应用空值替换
                        // Type assertion to access emptyReplace as it might be on a metric node but here we are iterating rowFields (DimensionNodes)
                        // Wait, rowFields correspond to rowLeafNodes which are DimensionNodes.
                        // Does DimensionNode support emptyReplace? In the new types, NO.
                        // Only MetricNode has emptyReplace.
                        // If the requirement is that dimensions also support empty replacement, we need to add it to DimensionNode or BaseNode.
                        // Assuming BaseNode should have it if it's common.
                        // Checking original types: emptyReplace was on CustomTreeNode.
                        // Let's check if we should move it to BaseNode.
                        // The user said "shared parts can be set as base type".
                        // emptyReplace seems useful for dimensions too (replacing null/empty strings).
                        // I will cast to any for now to fix the build, or better, move it to BaseNode if appropriate.
                        // Given I cannot edit types file again easily without risking loops, I will cast to any.
                        if ((value === EMPTY_VALUE || value === null || value === undefined) && (fieldConfig as any).emptyReplace) {
                            value = (fieldConfig as any).emptyReplace;
                        }

                        subtotalRow.push({
                            content: value,
                            rowspan: 1,
                            colspan: 1,
                            data: null,
                            rowKey: currentSubtotalRowKey,
                            expandable: position === 'top' && hasNextLevel && value !== EMPTY_VALUE && value !== TOTAL_DEFAULT_VALUE,
                            expanded: position === 'top' ? isExpanded : false,
                            level: currentLevel,
                            onClick: (position === 'top' && hasNextLevel) ? (record) => toggleExpand(record.level, record.rowKey) : undefined
                        });
                    });

                    // 计算值字段的小计
                    sortedColGroups.forEach(([colKey, _colData]) => {
                        const currentContext: Record<string, number> = {};

                        // 1. 计算基础聚合指标
                        valueLeafNodes.forEach(valueNode => {
                            if (valueNode.calculateType === 'expr') return;

                            const valueField = valueNode.field;
                            const aggregator = valueNode.calculateType || 'sum';

                            // 计算当前组的聚合值
                            const cellRecords = records.filter(record => generateKey(record, colFields) === colKey);
                            const valuesToAggregate = cellRecords.map(record => getFieldValue(record, valueField));
                            let val = 0;
                            if (aggregators[aggregator]) {
                                val = aggregators[aggregator](valuesToAggregate);
                            }
                            currentContext[valueNode.field] = val;
                        });

                        // 2. 计算表达式指标
                        valueLeafNodes.forEach(valueNode => {
                            if (valueNode.calculateType === 'expr' && valueNode.expression) {
                                const result = evaluateExpression(valueNode.expression, currentContext);
                                currentContext[valueNode.field] = result !== null ? result : 0;
                            }
                        });

                        // 3. 生成单元格
                        valueLeafNodes.forEach(valueNode => {
                            let aggregatedValue: string | number = currentContext[valueNode.field];

                            // 应用空值替换
                            if ((aggregatedValue === (EMPTY_VALUE as any) || aggregatedValue === null || aggregatedValue === undefined || (typeof aggregatedValue === 'number' && isNaN(aggregatedValue))) && valueNode.emptyReplace) {
                                aggregatedValue = valueNode.emptyReplace;
                            }

                            subtotalRow.push({
                                content: aggregatedValue,
                                rowspan: 1,
                                colspan: 1,
                                data: null,
                            });
                        });
                    });

                    // 插入小计行
                    const insertIndex = position === 'top' ? startIndex : endIndex + 1;
                    if (!totalState.has(currentSubtotalRowKey)) {
                        resultRows.splice(insertIndex, 0, subtotalRow);
                        // 记录当前小计行的展开状态
                        totalState.set(currentSubtotalRowKey, 1);

                        if (position === 'top' && level > 0) {
                            firstChildMap.set(groupKey, currentSubtotalRowKey);
                        }
                    }
                }
            });
        }

        return resultRows;
    };

    const leafNodes = getAllLeafNodes(rows);

    // 2. 初始化展开状态映射
    expandState.clear();

    // 初始化所有行维度值为展开状态
    data.forEach(record => {
        let currentKey = '';
        rowFields.forEach((field, idx) => {
            const level = idx + 1;
            const value = getFieldValue(record, field);
            currentKey += `|${value}`;

            if (!expandState.has(level)) {
                expandState.set(level, new Map());
            }

            // 初始化所有行维度值为展开状态
            // Check collapsed property from configuration
            // 优先级 `collapseFields` > `expandDepth` > `collapseAll` > `collapsed`
            // Currently only checking `collapsed`
            const isCollapsed = rowLeafNodes[idx].collapsed;
            expandState.get(level)!.set(currentKey, !isCollapsed);
        });
    });

    // 2. 生成数据部分
    const sortedRowGroups = sortRowGroups();
    let dataRows: TableRow[] = [];

    // 统计每个级别的行维度记录数量
    const levelRecordCount = new Map<number, Map<string, number>>();

    // 第一遍遍历：统计每个级别的行维度记录数量
    sortedRowGroups.forEach(([_rowKey, rowDataList]) => {
        const rowData = rowDataList[0];
        let currentRowKey = '';

        rowFields.forEach((field, idx) => {
            const value = getFieldValue(rowData, field);
            const level = idx + 1;

            // 生成当前级别的行键
            currentRowKey += `|${value}`;

            if (!levelRecordCount.has(level)) {
                levelRecordCount.set(level, new Map());
            }

            // 统计每个级别的行维度记录数量
            const levelMap = levelRecordCount.get(level)!;
            levelMap.set(currentRowKey, (levelMap.get(currentRowKey) || 0) + 1);
        });
    });

    // 第二遍遍历：生成数据行
    sortedRowGroups.forEach(([_rowKey, rowDataList]) => {
        const rowData = rowDataList[0];
        const rowCells: DataCell[] = [];
        let currentRowKey = '';

        // 添加行维度数据
        rowFields.forEach((field, idx) => {
            let value = getFieldValue(rowData, field);
            const level = idx + 1;
            const hasNextLevel = level < rowFields.length;
            const fieldConfig = rowLeafNodes[idx];

            // 生成当前级别的行键
            currentRowKey += `|${value}`;

            let firstChildKey = _rowKey; // rowKey is shadowing variable
            // Wait, I need rowKey from forEach loop, which is _rowKey.
            // I should rename _rowKey to rowKey and remove unused variable warning by using it or prefixing if strictly unused.
            // But it IS used here: `let firstChildKey = rowKey;` (original code).
            // Ah, I renamed it to `_rowKey`. So I should use `_rowKey`.
            
            const rowNode = leafNodes.find(node => node.field === field) as DimensionNode;
            if (rowNode?.total?.enabled && rowNode.total.label) {
                firstChildKey = `${currentRowKey}|${rowNode.total.label}`;
            }

            // 记录每个级别的第一条子项
            if (hasNextLevel) {
                const parentKey = currentRowKey;
                if (!firstChildMap.has(parentKey)) {
                    firstChildMap.set(parentKey, firstChildKey);
                }
            }

            // 检查当前级别的展开状态
            const isExpanded = expandState.has(level) ? expandState.get(level)!.get(currentRowKey) || true : true;

            // 检查同级别行维度是否有多个记录
            const hasMultipleRecords = level < rowFields.length ?
                (levelRecordCount.get(level)!.get(currentRowKey) || 0) > 1 : false;

            // 应用空值替换
            if ((value === EMPTY_VALUE || value === null || value === undefined) && (fieldConfig as any).emptyReplace) {
                value = (fieldConfig as any).emptyReplace;
            }

            rowCells.push({
                content: value,
                rowspan: 1,
                colspan: 1,
                data: rowData,
                expandable: hasNextLevel && hasMultipleRecords,
                expanded: isExpanded,
                level: level,
                rowKey: currentRowKey,
                onClick: (hasNextLevel && hasMultipleRecords) ? (record) => toggleExpand(record.level, record.rowKey) : undefined
            });
        });

        // 添加值数据
        sortedColGroups.forEach(([colKey, _colData]) => {
            const currentContext: Record<string, number> = {};

            // 1. 计算基础聚合指标
            valueLeafNodes.forEach(valueNode => {
                if (valueNode.calculateType === 'expr') return;

                const valueField = valueNode.field;
                const aggregator = valueNode.calculateType || 'sum';
                
                // 从cellDataMap快速获取匹配的数据
                const cellKey = `${_rowKey}||${colKey}`;
                const matchingData = cellDataMap.get(cellKey) || [];
                
                const valuesToAggregate = matchingData.map(record => getFieldValue(record, valueField));
                let val = 0;
                if (aggregators[aggregator]) {
                    val = aggregators[aggregator](valuesToAggregate);
                }
                currentContext[valueNode.field] = val;
            });

            // 2. 计算表达式指标
            valueLeafNodes.forEach(valueNode => {
                if (valueNode.calculateType === 'expr' && valueNode.expression) {
                    const result = evaluateExpression(valueNode.expression, currentContext);
                    currentContext[valueNode.field] = result !== null ? result : 0;
                }
            });

            // 3. 生成单元格
            valueLeafNodes.forEach(valueNode => {
                let aggregatedValue: string | number = currentContext[valueNode.field];

                // 应用空值替换
                if ((aggregatedValue === (EMPTY_VALUE as any) || aggregatedValue === null || aggregatedValue === undefined || (typeof aggregatedValue === 'number' && isNaN(aggregatedValue))) && valueNode.emptyReplace) {
                    aggregatedValue = valueNode.emptyReplace;
                }

                rowCells.push({
                    content: aggregatedValue,
                    rowspan: 1,
                    colspan: 1,
                    data: rowData,
                });
            });
        });

        dataRows.push({ cells: rowCells, rowKey: currentRowKey });
    });

    // 检查行是否可见
    const isRowVisible = (rowKey: string) => {
        const rowKeyParts = rowKey.split('|').filter(Boolean);
        const currentRowLevel = rowKeyParts.length;

        for (let level = 1; level < currentRowLevel; level++) {
            if (expandState.has(level)) {
                const levelState = expandState.get(level)!;
                const checkKey = rowKey.split('|').slice(0, level + 1).join('|');

                if (levelState.has(checkKey)) {
                    if (!levelState.get(checkKey)) {
                        const parentKey = checkKey;
                        const firstChildKey = firstChildMap.get(parentKey);

                        if (rowKey !== firstChildKey) {
                            return false;
                        }
                    }
                }
            }
        }

        return true;
    };

    // 3. 应用行合并逻辑
    const rowSpanHandler = (dataRows: DataCell[][]) => {
        if (!dataRows || dataRows.length === 0) {
            return dataRows;
        }
        for (let colIndex = 0; colIndex < rowLeafNodes.length; colIndex++) {
            let currentContent = dataRows[0][colIndex].content;
            let startRowIndex = 0;

            let rowNode = rowLeafNodes[colIndex];
            let hasTotal = rowNode.total?.enabled;
            let totalLabel = rowNode.total?.label || '';

            for (let rowIndex = 1; rowIndex < dataRows.length; rowIndex++) {
                const cell = dataRows[rowIndex][colIndex];

                if (
                    cell.content !== EMPTY_VALUE &&
                    (hasTotal ? cell.content !== totalLabel : true) &&
                    cell.content === currentContent
                ) {
                    cell.rowspan = 0;
                    dataRows[startRowIndex][colIndex].rowspan++;
                } else {
                    currentContent = cell.content;
                    startRowIndex = rowIndex;
                }
            }
        }
        return dataRows;
    }
    
    // 过滤可见行
    const dataExpandFilter = (list: TableRow[]): TableRow[] => {
        console.group('透视表数据处理 - 过滤可见行');
        
        // Filter rows and extract cells
        const visibleRows = list.filter(row => isRowVisible(row.rowKey));
        
        // Deep copy cells to avoid mutation issues (or map to new structure)
        const visibleCells = visibleRows.map(row => row.cells.map(cell => {
            const newCell = { ...cell };
            // Update expanded state based on current expandState
            if (newCell.expandable && newCell.level && newCell.rowKey) {
                 if (expandState.has(newCell.level)) {
                     const levelState = expandState.get(newCell.level)!;
                     if (levelState.has(newCell.rowKey)) {
                         newCell.expanded = levelState.get(newCell.rowKey)!;
                     }
                 }
            }
            return newCell;
        }));

        // 5. 应用行合并逻辑 (mutates visibleCells)
        rowSpanHandler(visibleCells);
        
        // Reconstruct TableRow[]
        const resultList = visibleRows.map((row, index) => ({
            rowKey: row.rowKey,
            cells: visibleCells[index]
        }));

        console.groupEnd();
        return resultList;
    }

    // 4. 生成并添加小计行
    totalState.clear();
    const dataRowsWithSubtotals = dataRows.map(row => row.cells);
    const dataRowsWithSubtotalsAndRowKeys = generateSubtotalRows(dataRowsWithSubtotals).map((cells, _index) => {
        let rowKey = '';
        cells.forEach((cell, cellIndex) => {
            if (cellIndex < rowFields.length && cell.rowKey) {
                rowKey = cell.rowKey;
            }
        });
        return { cells, rowKey };
    });

    // 5. 将数据行添加到结果中
    // result.push(...dataRowsWithSubtotalsAndRowKeys);
    
    // Clean up result construction
    const result = dataRowsWithSubtotalsAndRowKeys;

    // Generate Columns Configuration for TableHeader
    const generateColumns = () => {
        const columnsConfig: CustomTreeNode[] = [];

        // 1. Row Dimensions (Fixed Left)
        rowLeafNodes.forEach(node => {
            columnsConfig.push({
                ...node,
                width: node.width || 100,
                fixed: 'left',
                key: node.field
            } as any);
        });

        // 2. Column Dimensions & Values
        if (colLeafNodes.length === 0) {
            valueLeafNodes.forEach(node => {
                columnsConfig.push({
                    ...node,
                    width: node.width || 100,
                    key: node.field
                } as any);
            });
        } else {
            const colHeaderTree: CustomTreeNode[] = [];
            console.log('透视表列字段 sortedColGroups', sortedColGroups);

            sortedColGroups.forEach(([colKey, _colData]) => {
                const colValues = colKey.split('|').filter(s => s !== ''); 
                
                let currentLevelNodes = colHeaderTree;
                let currentKeyPath = '';

                colValues.forEach((val, index) => {
                    currentKeyPath += (currentKeyPath ? '|' : '') + val;
                    
                    // Find existing node for this value
                    let node = currentLevelNodes.find(n => n.title === val);
                    
                    if (!node) {
                        // Use column dimension field name as prefix for better identification
                        // colLeafNodes[index] corresponds to the dimension config for this level
                        const dimField = colLeafNodes[index]?.field || 'unknown';
                        const nodeField = `${dimField}__${val}`; // Format: dimensionField__value

                        const newNode = {
                            field: nodeField, 
                            title: val,
                            children: [],
                            key: nodeField
                        } as any;
                        currentLevelNodes.push(newNode);
                        node = newNode;
                    }

                    // If this is the last column dimension, add metrics as children
                    if (index === colValues.length - 1) {
                        // Add metrics
                        valueLeafNodes.forEach(valueNode => {
                            if (!node!.children) node!.children = [];
                            
                            // Ensure node!.children is treated as array
                            node!.children!.push({
                                ...valueNode,
                                field: `${colKey}||${valueNode.field}`,
                                title: valueNode.title || valueNode.field,
                                width: valueNode.width || 100,
                                key: `${colKey}||${valueNode.field}`
                            } as any);
                        });
                    } else {
                        // Go deeper
                        if (!node!.children) node!.children = [];
                        currentLevelNodes = node!.children!;
                    }
                });
            });

            columnsConfig.push(...colHeaderTree);
        }
        return columnsConfig;
    };

    const tableColumns = generateColumns();

    console.groupEnd();

    return {
        list: result,
        dataExpandFilter,
        tableColumns
    };
}

export default pivotDataHandler;
