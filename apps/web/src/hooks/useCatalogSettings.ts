import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
});

export const useCatalogSettings = () => {
    return useQuery({
        queryKey: ['catalog_settings'],
        queryFn: async () => {
            const { data } = await api.get('/settings/public');
            return data.catalog_layout || null;
        },
        staleTime: 5 * 60 * 1000,
    });
};
