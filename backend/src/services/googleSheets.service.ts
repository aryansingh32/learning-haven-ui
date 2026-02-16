import logger from '../config/logger';

export class GoogleSheetsService {
    /**
     * Fetch CSV data from a public Google Sheets export link
     * @param url Public Google Sheets URL (can be regular or export link)
     */
    static async fetchCsvData(url: string): Promise<any[]> {
        try {
            // Convert regular Sheet URL to CSV export URL if needed
            let exportUrl = url;
            if (url.includes('/edit')) {
                exportUrl = url.replace(/\/edit.*$/, '/export?format=csv');
            } else if (!url.includes('/export?format=csv')) {
                // Try to append if it's just the ID or basic link
                const match = url.match(/d\/([a-zA-Z0-9-_]+)/);
                if (match) {
                    exportUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
                }
            }

            const response = await fetch(exportUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch Google Sheet: ${response.statusText}`);
            }

            const csvText = await response.text();
            return this.parseCsv(csvText);
        } catch (error) {
            logger.error('Google Sheets fetch error:', error);
            throw error;
        }
    }

    /**
     * Simple CSV parser to convert text to JSON objects
     */
    private static parseCsv(text: string): any[] {
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length < 2) return [];

        const headers = this.splitCsvLine(lines[0]).map(h => h.trim().toLowerCase());
        const results = [];

        for (let i = 1; i < lines.length; i++) {
            const values = this.splitCsvLine(lines[i]);
            const obj: any = {};

            headers.forEach((header, index) => {
                let val = values[index]?.trim() || '';

                // Smart parsing for common fields
                if (['is_premium', 'is_active'].includes(header)) {
                    val = (val.toLowerCase() === 'true' || val === '1') as any;
                } else if (['companies', 'hints'].includes(header)) {
                    // Try to parse as array or split by comma
                    try {
                        val = JSON.parse(val);
                    } catch (e) {
                        val = val ? val.split(',').map(s => s.trim()) : [];
                    }
                } else if (['test_cases', 'code_templates'].includes(header)) {
                    try {
                        val = JSON.parse(val);
                    } catch (e) {
                        val = []; // Fallback to empty array if invalid JSON
                    }
                }

                obj[header] = val;
            });

            results.push(obj);
        }

        return results;
    }

    /**
     * Split CSV line handling quoted values
     */
    private static splitCsvLine(line: string): string[] {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
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
}
