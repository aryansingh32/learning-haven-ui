import logger from '../../../config/logger';
import { parseCsv } from '../utils/csv.util';

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
            return parseCsv(csvText);
        } catch (error) {
            logger.error('Google Sheets fetch error:', error);
            throw error;
        }
    }
}
