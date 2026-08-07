/**
 * csv.util.ts
 * Shared CSV parsing utilities.
 * Used by GoogleSheetsService and ContentImportService so both paths
 * produce identical row objects from the same raw text.
 */

/**
 * Split a single CSV line, handling double-quoted fields that may contain commas.
 */
export function splitCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            // Handle escaped double-quotes ("")
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

/**
 * Parse CSV text into an array of plain objects.
 * First row is treated as the header. All header keys are lower-cased and trimmed.
 * Smart coercion applied for common field names (booleans, comma-separated arrays, JSON blobs).
 */
export function parseCsv(text: string): any[] {
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 2) return [];

    const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
    const results: any[] = [];

    for (let i = 1; i < lines.length; i++) {
        const values = splitCsvLine(lines[i]);
        const obj: any = {};

        headers.forEach((header, index) => {
            let val: any = values[index]?.trim() ?? '';

            // Boolean coercion
            if (['is_premium', 'is_active'].includes(header)) {
                val = val.toLowerCase() === 'true' || val === '1';
            }
            // Array fields (comma-separated string → string[])
            else if (['companies', 'hints'].includes(header)) {
                try {
                    val = JSON.parse(val);
                } catch {
                    val = val ? val.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
                }
            }
            // JSON blob fields
            else if (
                [
                    'test_cases', 'code_templates',
                    'problems_json', 'quiz_json', 'tasks_json',
                    'video_timestamps_json',
                ].includes(header)
            ) {
                try {
                    val = JSON.parse(val);
                } catch {
                    val = [];
                }
            }
            // Numeric coercion for known integer fields
            else if (
                [
                    'chapter_number', 'est_minutes', 'stage_number',
                    'timeout_seconds', 'expected_exit_code',
                ].includes(header)
            ) {
                const parsed = parseInt(val, 10);
                val = isNaN(parsed) ? val : parsed;
            }

            obj[header] = val;
        });

        results.push(obj);
    }

    return results;
}
