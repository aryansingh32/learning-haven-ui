export const getWorkerUrl = (fileName: string): string => {
    const base = import.meta.env.BASE_URL || '/';
    if (base.endsWith('/')) return `${base}${fileName}`;
    return `${base}/${fileName}`;
};
