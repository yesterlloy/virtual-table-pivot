import { useState, useMemo } from 'react';
import VirtualTable from './components/VirtualTable';
import { PivotParams } from './types';

// Generate Sample Data with 4 levels of row dimensions
const generateData = (count: number) => {
    const provinces = ['Zhejiang', 'Jiangsu', 'Guangdong', 'Shandong', 'Fujian'];
    const cities: Record<string, string[]> = {
        'Zhejiang': ['Hangzhou', 'Ningbo', 'Wenzhou', 'Shaoxing'],
        'Jiangsu': ['Nanjing', 'Suzhou', 'Wuxi', 'Changzhou'],
        'Guangdong': ['Guangzhou', 'Shenzhen', 'Foshan', 'Dongguan'],
        'Shandong': ['Jinan', 'Qingdao', 'Yantai', 'Weifang'],
        'Fujian': ['Fuzhou', 'Xiamen', 'Quanzhou', 'Putian']
    };
    const districts = ['District A', 'District B', 'District C', 'District D', 'District E'];
    const streets = ['Street 1', 'Street 2', 'Street 3', 'Street 4', 'Street 5', 'Street 6', 'Street 7', 'Street 8'];
    const types = ['Furniture', 'Electronics', 'Clothing', 'Food', 'Books', 'Toys', 'Tools', 'Beauty'];
    const years = ['2023', '2024'];

    return Array.from({ length: count }).map((_, index) => {
        const province = provinces[Math.floor(Math.random() * provinces.length)];
        const cityList = cities[province];
        const city = cityList[Math.floor(Math.random() * cityList.length)];
        const district = districts[Math.floor(Math.random() * districts.length)];
        const street = streets[Math.floor(Math.random() * streets.length)];
        const type = types[Math.floor(Math.random() * types.length)];
        const year = years[Math.floor(Math.random() * years.length)];
        
        return {
            id: index,
            province,
            city,
            district,
            street,
            type,
            year,
            price: Math.floor(Math.random() * 5000) + 100,
            amount: Math.floor(Math.random() * 100) + 1
        };
    });
};

const data = generateData(2000); // Increased to 2000 to ensure good coverage

const meta: any[] = [];

const App = () => {
    const [mode, setMode] = useState<'detail' | 'group' | 'pivot' | 'hidden'>('pivot');

    const params = useMemo((): PivotParams => {
        const base = {
            data,
            meta,
            sortParams: [],
        };

        const rows = [
            { field: 'province', title: 'Province', width: 120, total: { enabled: true, label: 'Total' } },
            { field: 'city', title: 'City', width: 120, total: { enabled: true, label: 'Subtotal' } },
            { field: 'district', title: 'District', width: 120 },
            { field: 'street', title: 'Street', width: 150 }
        ];
        
        // Use Type and a custom Year field (simulated) or just Type for now. 
        // To test multi-level columns, let's pretend 'city' is a column dimension for a moment, 
        // but 'city' is already in rows.
        // Let's add a 'year' field to data generation or just use 'province' as column to see cross-tab.
        // But province is in rows.
        // Let's create a new field 'category' in data generation.
        
        const columns = [
             { field: 'year', title: 'Year', width: 100 },
             { field: 'type', title: 'Type', width: 120 }
        ];
        const values = [
            { field: 'amount', title: 'Amount', calculateType: 'sum', width: 100 },
            { 
                field: 'price', 
                title: 'Price', 
                calculateType: 'sum', 
                width: 100,
                formatter: (val: any) => `¥${val}`
            },
            { 
                field: 'expr_test', 
                title: 'Amt * Price', 
                calculateType: 'expr', 
                expression: '{amount} * {price}', 
                width: 120,
                hidden: true // Hidden test
            }
        ];

        if (mode === 'detail') {
             return {
                 ...base,
                 fields: {
                     rows: [],
                     columns: [],
                     values: [
                         { field: 'province', title: 'Province', width: 120 },
                         { field: 'city', title: 'City', width: 120 },
                         { field: 'district', title: 'District', width: 120 },
                         { field: 'street', title: 'Street', width: 150 },
                         { field: 'type', title: 'Type', width: 120 },
                         { field: 'amount', title: 'Amount', width: 100 },
                         { field: 'price', title: 'Price', width: 100 }
                     ]
                 }
             } as any;
        } else if (mode === 'group') {
             return {
                 ...base,
                 fields: {
                     rows: rows,
                     columns: [],
                     values: values
                 }
             } as any;
        } else if (mode === 'pivot') {
             return {
                 ...base,
                 fields: {
                     rows: rows,
                     columns: columns,
                     values: values
                 }
             } as any;
        } else { // hidden
             return {
                 ...base,
                 fields: {
                     rows: [],
                     columns: [],
                     values: []
                 }
             } as any;
        }
    }, [mode]);

    return (
        <div style={{ padding: 20 }}>
            <div style={{ marginBottom: 20, display: 'flex', gap: 10 }}>
                <button onClick={() => setMode('detail')}>Detail Table</button>
                <button onClick={() => setMode('group')}>Group Table</button>
                <button onClick={() => setMode('pivot')}>Pivot Table</button>
                <button onClick={() => setMode('hidden')}>Hidden</button>
            </div>
            <h2>Mode: {mode} (Data Count: {data.length})</h2>
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
