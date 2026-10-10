import { PDFDocument, PDFFont, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';

/**
 * Draws a certificate from a template. Used for practice-topic and apprenticeship
 * certificates, the admin preview, and on-demand downloads, so a certificate always
 * looks the way its template says.
 */

export interface CertificateLayout {
    title: string;
    subtitle: string;
    intro: string;            // "This is to certify that"
    body: string;             // "has successfully completed all problems in"
    footer: string;
    accent: string;           // #RRGGBB
    background: string;
    text: string;
    border: 'double' | 'single' | 'none';
    showQr: boolean;
    signatoryName: string;
    signatoryTitle: string;
    logoUrl: string;          // https PNG/JPG, optional
}

export interface CertificateData {
    name: string;
    achievement: string;      // the topic or program
    issuedAt: Date;
    code: string;
    grade?: string | null;
    verifyUrl: string;
}

export const DEFAULT_LAYOUT: CertificateLayout = {
    title: 'CERTIFICATE OF ACHIEVEMENT', subtitle: 'Forge', intro: 'This is to certify that',
    body: 'has successfully completed all problems in', footer: 'Forge — from zero to hired',
    accent: '#D9A521', background: '#FAF8F2', text: '#262626', border: 'double', showQr: true,
    signatoryName: '', signatoryTitle: '', logoUrl: '',
};

const HEX = /^#[0-9a-fA-F]{6}$/;
/** Template values with defaults for anything missing or malformed. */
export function normalizeLayout(raw: unknown): CertificateLayout {
    const l = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof CertificateLayout, unknown>>;
    const str = (k: keyof CertificateLayout, max: number) => (typeof l[k] === 'string' ? (l[k] as string).slice(0, max) : (DEFAULT_LAYOUT[k] as string));
    const color = (k: 'accent' | 'background' | 'text') => (typeof l[k] === 'string' && HEX.test(l[k] as string) ? (l[k] as string) : DEFAULT_LAYOUT[k]);
    return {
        title: str('title', 80), subtitle: str('subtitle', 80), intro: str('intro', 120), body: str('body', 160), footer: str('footer', 160),
        accent: color('accent'), background: color('background'), text: color('text'),
        border: l.border === 'single' || l.border === 'none' || l.border === 'double' ? l.border : DEFAULT_LAYOUT.border,
        showQr: typeof l.showQr === 'boolean' ? l.showQr : DEFAULT_LAYOUT.showQr,
        signatoryName: str('signatoryName', 80), signatoryTitle: str('signatoryTitle', 80),
        logoUrl: typeof l.logoUrl === 'string' && /^https:\/\//.test(l.logoUrl) ? l.logoUrl.slice(0, 1000) : '',
    };
}

/** Fills {name} {achievement} {date} {code} {grade}. */
export function fill(text: string, d: CertificateData): string {
    const date = d.issuedAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    return text
        .replace(/\{name\}/g, d.name).replace(/\{achievement\}/g, d.achievement).replace(/\{date\}/g, date)
        .replace(/\{code\}/g, d.code).replace(/\{grade\}/g, d.grade ?? '');
}

const toRgb = (hex: string) => rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);
// The standard PDF fonts only cover Latin-1; anything else would throw, so it is replaced.
const latin1 = (s: string) => s.replace(/[—–]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');

/** Largest size (down to `min`) at which the text fits the width. */
function fit(font: PDFFont, text: string, size: number, maxWidth: number, min = 10) {
    let s = size;
    while (s > min && font.widthOfTextAtSize(text, s) > maxWidth) s -= 1;
    return s;
}

async function fetchImage(url: string): Promise<{ bytes: Uint8Array; png: boolean } | null> {
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return null;
        const type = res.headers.get('content-type') ?? '';
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (bytes.length > 2_000_000) return null;
        if (type.includes('png')) return { bytes, png: true };
        if (type.includes('jpeg') || type.includes('jpg')) return { bytes, png: false };
        return null;
    } catch {
        return null; // a logo that can't be fetched never blocks a certificate
    }
}

export async function renderCertificatePdf(rawLayout: unknown, d: CertificateData): Promise<Uint8Array> {
    const L = normalizeLayout(rawLayout);
    const doc = await PDFDocument.create();
    doc.setTitle(latin1(`${L.title} - ${d.name}`));
    const page = doc.addPage([842, 595]); // A4 landscape
    const { width, height } = page.getSize();
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const regular = await doc.embedFont(StandardFonts.Helvetica);
    const italic = await doc.embedFont(StandardFonts.TimesRomanItalic);
    const accent = toRgb(L.accent);
    const ink = toRgb(L.text);
    const muted = rgb(0.45, 0.45, 0.45);

    page.drawRectangle({ x: 0, y: 0, width, height, color: toRgb(L.background) });
    if (L.border !== 'none') page.drawRectangle({ x: 10, y: 10, width: width - 20, height: height - 20, borderColor: accent, borderWidth: 3 });
    if (L.border === 'double') page.drawRectangle({ x: 22, y: 22, width: width - 44, height: height - 44, borderColor: accent, borderWidth: 1 });

    const centered = (raw: string, y: number, font: PDFFont, size: number, color = ink, maxWidth = width - 160) => {
        const text = latin1(fill(raw, d));
        if (!text.trim()) return;
        const s = fit(font, text, size, maxWidth);
        page.drawText(text, { x: (width - font.widthOfTextAtSize(text, s)) / 2, y, size: s, font, color });
    };

    if (L.logoUrl) {
        const img = await fetchImage(L.logoUrl);
        if (img) {
            const embedded = img.png ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes);
            const scale = Math.min(60 / embedded.height, 160 / embedded.width);
            page.drawImage(embedded, { x: (width - embedded.width * scale) / 2, y: height - 105, width: embedded.width * scale, height: embedded.height * scale });
        }
    }
    const top = L.logoUrl ? 20 : 0;
    centered(L.title, height - 110 - top, bold, 28);
    centered(L.subtitle, height - 138 - top, regular, 14, muted);
    page.drawLine({ start: { x: width * 0.25, y: height - 155 - top }, end: { x: width * 0.75, y: height - 155 - top }, thickness: 1, color: accent });
    centered(L.intro, height - 200 - top, italic, 16, muted);
    const name = latin1(d.name);
    const nameSize = fit(bold, name, 36, width - 200, 16);
    const nameWidth = bold.widthOfTextAtSize(name, nameSize);
    page.drawText(name, { x: (width - nameWidth) / 2, y: height - 255 - top, size: nameSize, font: bold, color: ink });
    page.drawLine({ start: { x: (width - nameWidth) / 2 - 20, y: height - 263 - top }, end: { x: (width + nameWidth) / 2 + 20, y: height - 263 - top }, thickness: 1, color: accent });
    centered(L.body, height - 303 - top, regular, 14, muted);
    centered('{achievement}', height - 343 - top, bold, 24, accent);
    centered('Issued on {date}', height - 395 - top, regular, 12, muted);

    if (L.signatoryName) {
        page.drawLine({ start: { x: 90, y: 120 }, end: { x: 290, y: 120 }, thickness: 0.8, color: ink });
        page.drawText(latin1(L.signatoryName), { x: 90, y: 104, size: 12, font: bold, color: ink });
        if (L.signatoryTitle) page.drawText(latin1(L.signatoryTitle), { x: 90, y: 89, size: 10, font: regular, color: muted });
    }
    if (L.showQr) {
        const png = await QRCode.toBuffer(d.verifyUrl, { margin: 1, width: 240, errorCorrectionLevel: 'M' });
        const qr = await doc.embedPng(png);
        page.drawImage(qr, { x: width - 150, y: 62, width: 90, height: 90 });
        page.drawText('Scan to verify', { x: width - 145, y: 50, size: 8, font: regular, color: muted });
    }
    page.drawLine({ start: { x: width * 0.3, y: 72 }, end: { x: width * 0.7, y: 72 }, thickness: 1, color: accent });
    centered(L.footer, 55, regular, 10, muted, width * 0.4);
    const code = latin1(`Certificate ID ${d.code} - ${d.verifyUrl}`);
    page.drawText(code, { x: (width - regular.widthOfTextAtSize(code, 8)) / 2, y: 34, size: 8, font: regular, color: muted });

    return doc.save();
}
