import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { api } from '../services/api.svc';

export const useApiQuery = <T>(
    queryKey: any[],
    url: string,
    options?: Omit<UseQueryOptions<T, Error>, 'queryKey' | 'queryFn'>
) => {
    return useQuery<T, Error>({
        queryKey,
        queryFn: () => api.get(url),
        ...options,
    });
};

export const useApiMutation = <TData = any, TVariables = any>(
    mutationFn: (variables: TVariables) => Promise<TData>,
    options?: UseMutationOptions<TData, Error, TVariables>
) => {
    return useMutation<TData, Error, TVariables>({
        mutationFn,
        ...options,
    });
};
