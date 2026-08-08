/**
 * contentImport.service.ts  (admin frontend)
 *
 * Axios wrapper for the staged content-import API endpoints.
 * Mirrors the pattern used in problems.service.ts.
 */
import api from './api';

// ─── Types ──────────────────────────────────────────────────

export type ContentType = 'chapters_meta' | 'chapter_steps' | 'problems' | 'build_stages';

export interface ImportRow {
    id: string;
    row_number: number;
    raw_data: Record<string, any>;
    status: 'valid' | 'error' | 'warning';
    errors: string[];
    resolved_entity_id: string | null;
}

export interface ImportBatch {
    id: string;
    content_type: ContentType;
    source: 'upload' | 'sheet_url' | 'json';
    source_ref: string;
    uploaded_by: string;
    status: 'pending' | 'reviewed' | 'published' | 'rejected';
    total_rows: number;
    valid_rows: number;
    error_rows: number;
    created_at: string;
    published_at: string | null;
    uploader?: { email: string; full_name: string };
}

export interface ParseResponse {
    batch_id: string;
    total_rows: number;
    valid_rows: number;
    error_rows: number;
    warning_rows: number;
    rows: ImportRow[];
}

export interface PublishResponse {
    published: number;
    skipped: number;
    errors: string[];
}

export interface BatchDetailResponse {
    batch: ImportBatch;
    rows: ImportRow[];
}

export interface HistoryResponse {
    batches: ImportBatch[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        total_pages: number;
    };
}

// ─── Service ────────────────────────────────────────────────

export const contentImportService = {
    /**
     * Parse, validate, and stage an import.
     * Accepts either a File (CSV upload) or a Google Sheet URL.
     * Does NOT write to live content tables.
     */
    parseImport: async (params: {
        contentType: ContentType;
        file?: File;
        sheetUrl?: string;
    }): Promise<ParseResponse> => {
        const formData = new FormData();
        formData.append('content_type', params.contentType);

        if (params.file) {
            formData.append('file', params.file);
        } else if (params.sheetUrl) {
            formData.append('sheet_url', params.sheetUrl);
        } else {
            throw new Error('Either file or sheetUrl must be provided');
        }

        const response = await api.post<ParseResponse>(
            '/admin/content/import',
            formData,
            { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        return response.data;
    },

    /**
     * Get full detail for a batch (batch header + all rows).
     */
    getBatch: async (batchId: string): Promise<BatchDetailResponse> => {
        const response = await api.get<BatchDetailResponse>(
            `/admin/content/import/${batchId}`
        );
        return response.data;
    },

    /**
     * Edit one row's raw_data inline; backend re-validates and returns updated row.
     */
    updateRow: async (
        batchId: string,
        rowId: string,
        rawData: Record<string, any>
    ): Promise<ImportRow> => {
        const response = await api.patch<ImportRow>(
            `/admin/content/import/${batchId}/rows/${rowId}`,
            { raw_data: rawData }
        );
        return response.data;
    },

    /**
     * Publish a batch — writes valid (and warning if force=true) rows to live tables.
     */
    publishBatch: async (
        batchId: string,
        force = false
    ): Promise<PublishResponse> => {
        const response = await api.post<PublishResponse>(
            `/admin/content/import/${batchId}/publish`,
            { force }
        );
        return response.data;
    },

    /**
     * Paginated list of past import batches.
     */
    getHistory: async (params?: {
        contentType?: ContentType;
        page?: number;
    }): Promise<HistoryResponse> => {
        const query = new URLSearchParams();
        if (params?.contentType) query.set('content_type', params.contentType);
        if (params?.page) query.set('page', params.page.toString());

        const response = await api.get<HistoryResponse>(
            `/admin/content/import/history?${query.toString()}`
        );
        return response.data;
    },

    /**
     * Trigger a CSV template download in the browser.
     */
    downloadTemplate: async (contentType: ContentType): Promise<void> => {
        const response = await api.get(
            `/admin/content/templates/${contentType}`,
            { responseType: 'blob' }
        );
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${contentType}-template.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    },
};
