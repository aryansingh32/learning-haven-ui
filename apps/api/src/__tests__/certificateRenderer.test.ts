/** Certificates drawn from templates: wording, defaults, odd names, and a real PDF. */
import { PDFDocument } from 'pdf-lib';
import { DEFAULT_LAYOUT, fill, normalizeLayout, renderCertificatePdf } from '../modules/learning/services/certificateRenderer';

const data = { name: 'Priya Nair', achievement: 'Binary Search', issuedAt: new Date('2026-10-10T10:00:00Z'), code: 'ABC123', grade: 'Merit', verifyUrl: 'https://forge.example/certificates/verify/ABC123' };

describe('certificate templates', () => {
    it('fills the placeholders', () => {
        expect(fill('{name} completed {achievement} on {date} ({code}, {grade})', data))
            .toBe('Priya Nair completed Binary Search on 10 October 2026 (ABC123, Merit)');
    });

    it('falls back to defaults for missing or unsafe values', () => {
        const l = normalizeLayout({ title: 'Hello', accent: 'red', border: 'zigzag', showQr: 'yes', logoUrl: 'http://insecure.example/logo.png', extra: 1 });
        expect(l).toMatchObject({ title: 'Hello', accent: DEFAULT_LAYOUT.accent, border: DEFAULT_LAYOUT.border, showQr: true, logoUrl: '' });
        expect(normalizeLayout(null)).toEqual(DEFAULT_LAYOUT);
        expect(normalizeLayout({ title: 'x'.repeat(500) }).title).toHaveLength(80);
    });

    it('draws a one-page landscape PDF', async () => {
        const bytes = await renderCertificatePdf({ ...DEFAULT_LAYOUT, signatoryName: 'Dean of Learning', signatoryTitle: 'Forge' }, data);
        const doc = await PDFDocument.load(bytes);
        expect(doc.getPageCount()).toBe(1);
        expect(doc.getPage(0).getSize()).toEqual({ width: 842, height: 595 });
        expect(doc.getTitle()).toBe('CERTIFICATE OF ACHIEVEMENT - Priya Nair');
    });

    it('copes with very long and non-Latin names', async () => {
        await expect(renderCertificatePdf({}, { ...data, name: 'Venkata Satya Sai Lakshmi Narasimha Subrahmanya Chaitanya Raghavendra' })).resolves.toBeInstanceOf(Uint8Array);
        await expect(renderCertificatePdf({ showQr: false, border: 'none' }, { ...data, name: 'प्रिया नायर' })).resolves.toBeInstanceOf(Uint8Array);
    });
});
