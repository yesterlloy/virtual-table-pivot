// Simple implementation of cloneDeep
export const cloneDeep = <T>(obj: T): T => {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => cloneDeep(item)) as any;
    }

    const clonedObj = {} as T;
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            clonedObj[key] = cloneDeep(obj[key]);
        }
    }

    return clonedObj;
};
