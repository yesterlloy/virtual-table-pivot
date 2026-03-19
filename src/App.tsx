import { useState, useMemo } from 'react';
import VirtualTable from './components/VirtualTable';
import { PivotParams, DimensionNode, MetricNode } from './types';
import testData from './test/data.json';

const App = () => {
    const [showLine, setShowLine] = useState(true);

    // Use data.json directly with proper type casting
    const params = useMemo((): PivotParams => {
        const jsonTestData = testData as unknown as {
            data: any[];
            meta: any[];
            sortParams: any[];
            fields: {
                rows: DimensionNode[];
                columns: DimensionNode[];
                values: MetricNode[];
            };
        };

        return {
            data: jsonTestData.data,
            meta: jsonTestData.meta,
            sortParams: jsonTestData.sortParams,
            fields: jsonTestData.fields,
            config: {
                showLine: showLine,
                showLineTitle: '序号'
            }
        };
    }, [showLine]);

    return (
        <div style={{ padding: 20 }}>
            <div style={{ marginBottom: 20, display: 'flex', gap: 10 }}>
                <label>
                    <input
                        type="checkbox"
                        checked={showLine}
                        onChange={(e) => setShowLine(e.target.checked)}
                    />
                    显示序号
                </label>
            </div>
            <h2>测试数据：{testData.data.length} 条</h2>
            <div style={{ height: 600, border: '1px solid #ccc' }}>
                <VirtualTable
                    {...params}
                    scroll={{ y: 600 }}
                />
            </div>
        </div>
    );
};

export default App;
