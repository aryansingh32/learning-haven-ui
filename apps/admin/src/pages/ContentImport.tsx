import React, { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    contentImportService,
    type ContentType,
    type ImportRow,
    type ImportBatch,
    type ParseResponse,
} from '../services/contentImport.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    Download,
    Upload,
    Link2,
    Loader2,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    ChevronDown,
    Send,
    RotateCcw,
    Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────

// Non-chapter content types rendered via the generic loop
const NON_CHAPTER_CONTENT_TYPES: { key: ContentType; label: string }[] = [
    { key: 'problems', label: 'Problems' },
    { key: 'build_stages', label: 'Build Stages' },
];

// ─── Row status badge helper ──────────────────────────────────

const StatusBadge = ({ status }: { status: string }) => {
    if (status === 'valid')
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Valid</Badge>;
    if (status === 'warning')
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Warning</Badge>;
    if (status === 'error')
        return <Badge className="bg-red-100 text-red-800 border-red-200">Error</Badge>;
    if (status === 'published')
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Published</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
};

// ─── Editable cell ────────────────────────────────────────────

interface EditableCellProps {
    value: string;
    onSave: (val: string) => void;
    disabled?: boolean;
}

const EditableCell: React.FC<EditableCellProps> = ({ value, onSave, disabled }) => {
    const [editing, setEditing] = useState(false);
    const [local, setLocal] = useState(String(value ?? ''));

    const commit = () => {
        setEditing(false);
        if (local !== String(value ?? '')) onSave(local);
    };

    if (disabled || !editing) {
        return (
            <span
                className={cn(
                    'block truncate max-w-[200px] cursor-pointer hover:underline',
                    disabled && 'cursor-default hover:no-underline'
                )}
                title={local}
                onClick={() => !disabled && setEditing(true)}
            >
                {local || <span className="text-muted-foreground/40 italic">—</span>}
            </span>
        );
    }

    return (
        <Input
            autoFocus
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') {
                    setLocal(String(value ?? ''));
                    setEditing(false);
                }
            }}
            className="h-7 text-xs"
        />
    );
};

// ─── Staged Rows Table ────────────────────────────────────────

interface StagedRowsTableProps {
    rows: ImportRow[];
    batchId: string;
    isPublished: boolean;
    onRowUpdated: (updated: ImportRow) => void;
}

const StagedRowsTable: React.FC<StagedRowsTableProps> = ({
    rows,
    batchId,
    isPublished,
    onRowUpdated,
}) => {
    const updateMutation = useMutation({
        mutationFn: ({
            rowId,
            rawData,
        }: {
            rowId: string;
            rawData: Record<string, any>;
        }) => contentImportService.updateRow(batchId, rowId, rawData),
        onSuccess: (updated) => {
            onRowUpdated(updated);
            toast.success('Row updated and re-validated');
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || 'Failed to update row');
        },
    });

    if (rows.length === 0) {
        return (
            <p className="text-center text-muted-foreground py-10">No rows found.</p>
        );
    }

    // Derive column headers from first row's raw_data keys
    const columns = rows[0]?.raw_data ? Object.keys(rows[0].raw_data) : [];

    return (
        <div className="border rounded-lg overflow-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead className="w-24">Status</TableHead>
                        {columns.slice(0, 6).map((col) => (
                            <TableHead key={col} className="min-w-[120px]">
                                {col}
                            </TableHead>
                        ))}
                        {columns.length > 6 && (
                            <TableHead>+{columns.length - 6} more</TableHead>
                        )}
                        <TableHead className="min-w-[200px]">Errors</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow
                            key={row.id}
                            className={cn(
                                row.status === 'error' && 'bg-red-50 hover:bg-red-100',
                                row.status === 'warning' && 'bg-amber-50 hover:bg-amber-100',
                                row.status === 'valid' && 'bg-emerald-50/30 hover:bg-emerald-50'
                            )}
                        >
                            <TableCell className="text-muted-foreground text-xs">
                                {row.row_number}
                            </TableCell>
                            <TableCell>
                                <StatusBadge status={row.status} />
                            </TableCell>
                            {columns.slice(0, 6).map((col) => (
                                <TableCell key={col}>
                                    <EditableCell
                                        disabled={isPublished || updateMutation.isPending}
                                        value={String(row.raw_data[col] ?? '')}
                                        onSave={(val) => {
                                            const updated = {
                                                ...row.raw_data,
                                                [col]: val,
                                            };
                                            updateMutation.mutate({
                                                rowId: row.id,
                                                rawData: updated,
                                            });
                                        }}
                                    />
                                </TableCell>
                            ))}
                            {columns.length > 6 && <TableCell>…</TableCell>}
                            <TableCell>
                                {row.errors?.length > 0 ? (
                                    <ul className="text-xs text-destructive space-y-0.5">
                                        {(row.errors as string[]).map((e, i) => (
                                            <li key={i}>• {e}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};

// ─── Per-Tab Import Panel ─────────────────────────────────────

interface ImportPanelProps {
    contentType: ContentType;
}

const ImportPanel: React.FC<ImportPanelProps> = ({ contentType }) => {
    const [sheetUrl, setSheetUrl] = useState('');
    const [staged, setStaged] = useState<ParseResponse | null>(null);
    const [localRows, setLocalRows] = useState<ImportRow[]>([]);
    const [forcePublish, setForcePublish] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const parseMutation = useMutation({
        mutationFn: (params: { file?: File; sheetUrl?: string }) =>
            contentImportService.parseImport({ contentType, ...params }),
        onSuccess: (data) => {
            setStaged(data);
            setLocalRows(data.rows);
            toast.success(`Parsed ${data.total_rows} rows — ${data.valid_rows} valid, ${data.error_rows} errors`);
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || 'Failed to parse');
        },
    });

    const publishMutation = useMutation({
        mutationFn: () =>
            contentImportService.publishBatch(staged!.batch_id, forcePublish),
        onSuccess: (result) => {
            toast.success(`Published ${result.published} rows`);
            if (result.errors.length > 0) {
                toast.warning(`${result.skipped} rows skipped with errors`);
            }
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || 'Publish failed');
        },
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) parseMutation.mutate({ file });
    };

    const handleSheetParse = () => {
        if (!sheetUrl.trim()) return;
        parseMutation.mutate({ sheetUrl: sheetUrl.trim() });
    };

    const handleRowUpdated = useCallback((updated: ImportRow) => {
        setLocalRows((prev) =>
            prev.map((r) => (r.id === updated.id ? updated : r))
        );
    }, []);

    const validCount = localRows.filter((r) => r.status === 'valid').length;
    const warningCount = localRows.filter((r) => r.status === 'warning').length;
    const canPublish = staged && (validCount > 0 || (forcePublish && warningCount > 0));
    const isPublished = publishMutation.isSuccess;

    return (
        <div className="space-y-6">
            {/* ── Controls ── */}
            <div className="flex flex-wrap gap-3 items-center">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => contentImportService.downloadTemplate(contentType)}
                >
                    <Download className="w-4 h-4 mr-2" />
                    Download Template
                </Button>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={parseMutation.isPending}
                >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload CSV
                </Button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileChange}
                />

                <div className="flex-1 flex items-center gap-2 min-w-[280px]">
                    <div className="relative flex-1">
                        <Link2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Paste Google Sheet URL…"
                            value={sheetUrl}
                            onChange={(e) => setSheetUrl(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                    <Button
                        size="sm"
                        onClick={handleSheetParse}
                        disabled={!sheetUrl.trim() || parseMutation.isPending}
                    >
                        {parseMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            'Parse'
                        )}
                    </Button>
                </div>
            </div>

            {/* ── Staged results ── */}
            {staged && (
                <>
                    {/* Summary bar */}
                    <div className="flex flex-wrap items-center gap-4 p-4 border rounded-lg bg-card/60">
                        <div className="flex items-center gap-1.5 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span className="font-medium">{validCount}</span>
                            <span className="text-muted-foreground">valid</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            <span className="font-medium">{warningCount}</span>
                            <span className="text-muted-foreground">warnings</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm">
                            <XCircle className="w-4 h-4 text-red-500" />
                            <span className="font-medium">
                                {localRows.filter((r) => r.status === 'error').length}
                            </span>
                            <span className="text-muted-foreground">errors</span>
                        </div>

                        <div className="ml-auto flex items-center gap-3">
                            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={forcePublish}
                                    onChange={(e) => setForcePublish(e.target.checked)}
                                    className="accent-primary"
                                />
                                Publish valid rows, skip errors
                            </label>

                            <Button
                                onClick={() => publishMutation.mutate()}
                                disabled={!canPublish || publishMutation.isPending || isPublished}
                                size="sm"
                            >
                                {publishMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : (
                                    <Send className="w-4 h-4 mr-2" />
                                )}
                                {isPublished
                                    ? 'Published'
                                    : `Publish ${validCount + (forcePublish ? warningCount : 0)} rows`}
                            </Button>

                            <Button
                                variant="ghost"
                                size="icon"
                                title="Reset"
                                onClick={() => {
                                    setStaged(null);
                                    setLocalRows([]);
                                    setSheetUrl('');
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
                            >
                                <RotateCcw className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    <StagedRowsTable
                        rows={localRows}
                        batchId={staged.batch_id}
                        isPublished={isPublished}
                        onRowUpdated={handleRowUpdated}
                    />
                </>
            )}
        </div>
    );
};

// ─── History Tab ──────────────────────────────────────────────

const HistoryTab: React.FC = () => {
    const [page, setPage] = useState(1);
    const [filter, setFilter] = useState<ContentType | ''>('');
    const [selectedBatch, setSelectedBatch] = useState<string | null>(null);

    const historyQuery = useQuery({
        queryKey: ['content-import-history', page, filter],
        queryFn: () =>
            contentImportService.getHistory({
                page,
                contentType: filter || undefined,
            }),
    });

    const batchDetailQuery = useQuery({
        queryKey: ['content-import-batch', selectedBatch],
        queryFn: () => contentImportService.getBatch(selectedBatch!),
        enabled: !!selectedBatch,
    });

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex gap-2 items-center">
                <select
                    value={filter}
                    onChange={(e) => {
                        setFilter(e.target.value as ContentType | '');
                        setPage(1);
                    }}
                    className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                >
                    <option value="">All types</option>
                    {([
                        { key: 'chapters_meta',  label: 'Chapter Metadata' },
                        { key: 'chapter_steps',  label: 'Chapter Steps' },
                        { key: 'problems',       label: 'Problems' },
                        { key: 'build_stages',   label: 'Build Stages' },
                    ] as { key: ContentType; label: string }[]).map((ct) => (
                        <option key={ct.key} value={ct.key}>
                            {ct.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Table */}
            {historyQuery.isLoading ? (
                <div className="flex justify-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <div className="border rounded-lg overflow-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Type</TableHead>
                                <TableHead>Source</TableHead>
                                <TableHead>Uploaded by</TableHead>
                                <TableHead>Rows</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Published</TableHead>
                                <TableHead className="w-10" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {(historyQuery.data?.batches || []).map((batch: ImportBatch) => (
                                <React.Fragment key={batch.id}>
                                    <TableRow
                                        className="cursor-pointer hover:bg-accent/50"
                                        onClick={() =>
                                            setSelectedBatch(
                                                selectedBatch === batch.id ? null : batch.id
                                            )
                                        }
                                    >
                                        <TableCell>
                                            <Badge variant="outline">{batch.content_type}</Badge>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                                            {batch.source_ref || batch.source}
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {batch.uploader?.full_name || batch.uploaded_by}
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            <span className="text-emerald-600">{batch.valid_rows}✓</span>
                                            {' / '}
                                            <span className="text-red-500">{batch.error_rows}✗</span>
                                            {' / '}
                                            {batch.total_rows}
                                        </TableCell>
                                        <TableCell>
                                            <StatusBadge status={batch.status} />
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {batch.published_at
                                                ? new Date(batch.published_at).toLocaleDateString()
                                                : '—'}
                                        </TableCell>
                                        <TableCell>
                                            <Eye className="w-4 h-4 text-muted-foreground" />
                                        </TableCell>
                                    </TableRow>

                                    {/* Expanded detail */}
                                    {selectedBatch === batch.id && (
                                        <TableRow>
                                            <TableCell colSpan={7} className="p-0">
                                                <div className="p-4 bg-muted/30 border-t">
                                                    {batchDetailQuery.isLoading ? (
                                                        <div className="flex justify-center py-4">
                                                            <Loader2 className="w-5 h-5 animate-spin" />
                                                        </div>
                                                    ) : batchDetailQuery.data ? (
                                                        <StagedRowsTable
                                                            rows={batchDetailQuery.data.rows}
                                                            batchId={batch.id}
                                                            isPublished={batch.status === 'published'}
                                                            onRowUpdated={() => {
                                                                batchDetailQuery.refetch();
                                                            }}
                                                        />
                                                    ) : null}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </React.Fragment>
                            ))}

                            {historyQuery.data?.batches.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                                        No import history yet.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            )}

            {/* Pagination */}
            {(historyQuery.data?.pagination.total_pages ?? 0) > 1 && (
                <div className="flex items-center justify-end gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                    >
                        Previous
                    </Button>
                    <span className="text-sm font-medium">
                        Page {page} / {historyQuery.data?.pagination.total_pages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={page >= (historyQuery.data?.pagination.total_pages ?? 1)}
                    >
                        Next
                    </Button>
                </div>
            )}
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────

const ContentImport: React.FC = () => {
    const [advancedOpen, setAdvancedOpen] = useState(false);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Content Import</h2>
                <p className="text-muted-foreground mt-1">
                    Upload CSV files or import from Google Sheets. Rows are staged for review
                    before being published to live tables.
                </p>
            </div>

            {/* Main Tabs */}
            <Tabs defaultValue="chapters">
                <TabsList className="grid grid-cols-5 w-full max-w-2xl">
                    <TabsTrigger value="chapters">Chapters</TabsTrigger>
                    <TabsTrigger value="problems">Problems</TabsTrigger>
                    <TabsTrigger value="build_stages">Build Stages</TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>

                {/* ── Chapters tab: split into metadata + steps sub-panels ── */}
                <TabsContent value="chapters" className="mt-6 space-y-8">
                    {/* Ordering note */}
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        <strong>Order matters:</strong> publish <em>Chapter Metadata</em> first.
                        Chapter Steps rows will fail to publish if the chapter does not already
                        exist in <code className="bg-amber-100 px-1 rounded text-xs">public.chapters</code>.
                    </div>

                    {/* Sub-panel: Chapter Metadata */}
                    <div className="space-y-3">
                        <div>
                            <h3 className="text-lg font-semibold">Chapter Metadata</h3>
                            <p className="text-sm text-muted-foreground">
                                8-column file — one row per chapter (roadmap_slug, chapter_number,
                                title, topic_tag, difficulty, est_minutes, story_hook, whatsapp_msg).
                            </p>
                        </div>
                        <ImportPanel contentType="chapters_meta" />
                    </div>

                    <div className="border-t" />

                    {/* Sub-panel: Chapter Steps */}
                    <div className="space-y-3">
                        <div>
                            <h3 className="text-lg font-semibold">Chapter Steps</h3>
                            <p className="text-sm text-muted-foreground">
                                6-column file — one row per step (roadmap_slug, chapter_number,
                                step_number, step_type, step_title, step_content_json). Uploading
                                replaces <em>all</em> existing steps for each chapter in the batch.
                            </p>
                        </div>
                        <ImportPanel contentType="chapter_steps" />
                    </div>
                </TabsContent>

                {/* ── Other content types ── */}
                {NON_CHAPTER_CONTENT_TYPES.map(({ key, label }) => (
                    <TabsContent key={key} value={key} className="mt-6">
                        <ImportPanel contentType={key} />
                    </TabsContent>
                ))}

                <TabsContent value="history" className="mt-6">
                    <HistoryTab />
                </TabsContent>
            </Tabs>

            {/* Advanced / Legacy fallback — collapsed by default */}
            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-muted-foreground gap-1">
                        <ChevronDown
                            className={cn(
                                'w-4 h-4 transition-transform',
                                advancedOpen && 'rotate-180'
                            )}
                        />
                        Advanced (Legacy JSON Import)
                    </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                    <div className="rounded-lg border border-dashed p-4 bg-muted/30 text-sm text-muted-foreground space-y-3">
                        <p className="font-medium text-foreground">Raw JSON endpoints (unchanged)</p>
                        <p>
                            The existing{' '}
                            <code className="bg-muted px-1 rounded text-xs">
                                POST /api/admin/problems/import
                            </code>{' '}
                            endpoint with a{' '}
                            <code className="bg-muted px-1 rounded text-xs">problems</code> array
                            body is still active and untouched. Use it from the{' '}
                            <strong>Problems</strong> page's "Bulk Import" button for the legacy
                            Google Sheets direct-import flow.
                        </p>
                        <p>
                            Chapter seeding from JSON files on disk is available via the npm
                            script:{' '}
                            <code className="bg-muted px-1 rounded text-xs">
                                pnpm --filter @repo/api seed:chapters
                            </code>
                        </p>
                        <p className="text-xs opacity-60">
                            These paths write directly to live tables with no staging step — use
                            them only when you trust the data source completely.
                        </p>
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
};

export default ContentImport;
