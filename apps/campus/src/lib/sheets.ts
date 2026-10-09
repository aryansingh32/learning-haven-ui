// Read a spreadsheet the user picked into CSV text: .csv as is, .xlsx by
// unzipping it and reading the first sheet's XML. Old binary .xls isn't
// supported — Excel can "Save as" .xlsx or .csv.

import { unzipSync, strFromU8 } from 'fflate';

const csvField = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** "AB12" → zero-based column index 27. */
function columnIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? 'A';
  return [...letters].reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0) - 1;
}

function xml(text: string) {
  return new DOMParser().parseFromString(text, 'application/xml');
}

function firstSheetPath(files: Record<string, Uint8Array>): string {
  const workbook = files['xl/workbook.xml'];
  const rels = files['xl/_rels/workbook.xml.rels'];
  if (workbook && rels) {
    const sheet = xml(strFromU8(workbook)).getElementsByTagName('sheet')[0];
    const rid = sheet?.getAttribute('r:id') ?? sheet?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    const rel = [...xml(strFromU8(rels)).getElementsByTagName('Relationship')].find((r) => r.getAttribute('Id') === rid);
    const target = rel?.getAttribute('Target');
    if (target) return target.startsWith('/') ? target.slice(1) : `xl/${target}`;
  }
  return 'xl/worksheets/sheet1.xml';
}

export function xlsxToCsv(data: Uint8Array): string {
  const files = unzipSync(data);
  const shared = files['xl/sharedStrings.xml']
    ? [...xml(strFromU8(files['xl/sharedStrings.xml'])).getElementsByTagName('si')].map((si) =>
        [...si.getElementsByTagName('t')].map((t) => t.textContent ?? '').join(''))
    : [];
  const sheet = files[firstSheetPath(files)];
  if (!sheet) throw new Error("Couldn't find a sheet in this file.");
  const rows: string[][] = [];
  for (const row of [...xml(strFromU8(sheet)).getElementsByTagName('row')]) {
    const out: string[] = [];
    for (const c of [...row.getElementsByTagName('c')]) {
      const i = columnIndex(c.getAttribute('r') ?? '');
      const type = c.getAttribute('t');
      const v = c.getElementsByTagName('v')[0]?.textContent ?? '';
      const value = type === 's' ? shared[Number(v)] ?? ''
        : type === 'inlineStr' ? [...c.getElementsByTagName('t')].map((t) => t.textContent ?? '').join('')
        : type === 'b' ? (v === '1' ? 'TRUE' : 'FALSE')
        : v;
      out[i] = value;
    }
    const r = Number(row.getAttribute('r')) - 1;
    rows[Number.isFinite(r) && r >= 0 ? r : rows.length] = Array.from(out, (x) => x ?? '');
  }
  return Array.from(rows, (r) => (r ?? []).map(csvField).join(',')).join('\r\n');
}

export async function readSpreadsheet(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx')) return xlsxToCsv(new Uint8Array(await file.arrayBuffer()));
  if (name.endsWith('.xls')) throw new Error('Old .xls files aren\'t supported — in Excel, use File → Save As → .xlsx or .csv.');
  return file.text();
}

export const SPREADSHEET_ACCEPT = '.csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Same as QUESTION_SHEET_TEMPLATE in @repo/assessment-core (the API's parser). */
export const QUESTION_TEMPLATE = [
  'Type,Question,Option A,Option B,Option C,Option D,Answer,Marks,Negative marks,Section,Topic,Difficulty,Explanation',
  'mcq,"A train covers 120 km in 2 hours. What is its speed?",40 km/h,60 km/h,80 km/h,100 km/h,B,1,0.25,Aptitude,Speed and distance,easy,Speed = distance / time = 60 km/h',
  'msq,Which of these are O(1) on an array?,Index access,Linear search,Append (amortised),Binary search,"A,C",2,0,Technical,Arrays,medium,',
  'nat,What is 15% of 240?,,,,,36,1,0,Aptitude,Percentages,easy,0.15 × 240 = 36',
].join('\r\n');

export function downloadText(name: string, text: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob(['﻿' + text], { type: `${type};charset=utf-8` }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
