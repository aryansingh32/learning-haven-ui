// Parse and validate a college roster spreadsheet (CSV) before anything is
// written. Every problem is reported against its line so an admin can fix
// the file and re-upload; nothing is partially imported.

export const ROSTER_ROLES = ['student', 'faculty', 'evaluator', 'invigilator', 'placement_officer', 'admin'] as const;
export type RosterRole = (typeof ROSTER_ROLES)[number];

export const MAX_ROSTER_ROWS = 5000;

export interface RosterRow {
  line: number;
  email: string;
  fullName: string | null;
  rollNumber: string | null;
  department: string | null;
  batch: string | null;
  role: RosterRole;
}

export interface RosterIssue {
  line: number;
  message: string;
}

export interface RosterParseResult {
  rows: RosterRow[];
  errors: RosterIssue[];
}

// Header spellings people actually use in college spreadsheets.
const HEADER_ALIASES: Record<string, keyof Omit<RosterRow, 'line'>> = {
  email: 'email',
  'email address': 'email',
  'e-mail': 'email',
  mail: 'email',
  name: 'fullName',
  'full name': 'fullName',
  'student name': 'fullName',
  fullname: 'fullName',
  'roll number': 'rollNumber',
  'roll no': 'rollNumber',
  'roll no.': 'rollNumber',
  roll: 'rollNumber',
  'registration number': 'rollNumber',
  'reg no': 'rollNumber',
  'enrollment number': 'rollNumber',
  department: 'department',
  dept: 'department',
  branch: 'department',
  batch: 'batch',
  section: 'batch',
  class: 'batch',
  role: 'role',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** RFC 4180-style CSV: quoted fields, doubled quotes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/^﻿/, ''); // strip Excel's UTF-8 BOM

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const clean = (v: string | undefined) => {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
};

export function parseRoster(text: string): RosterParseResult {
  // Keep each row's line number in the file so errors point at the right place.
  const table = parseCsv(text)
    .map((cells, i) => ({ cells, line: i + 1 }))
    .filter((r) => r.cells.some((cell) => cell.trim() !== ''));
  const errors: RosterIssue[] = [];
  if (table.length === 0) {
    return { rows: [], errors: [{ line: 1, message: 'The file is empty.' }] };
  }

  const header = table[0].cells.map((h) => HEADER_ALIASES[h.trim().toLowerCase().replace(/\s+/g, ' ')]);
  if (!header.includes('email')) {
    return { rows: [], errors: [{ line: table[0].line, message: 'Add an "email" column to the first row.' }] };
  }
  if (table.length - 1 > MAX_ROSTER_ROWS) {
    return { rows: [], errors: [{ line: 1, message: `Upload at most ${MAX_ROSTER_ROWS} people per file.` }] };
  }

  const rows: RosterRow[] = [];
  const seenEmail = new Map<string, number>();
  const seenRoll = new Map<string, number>();

  table.slice(1).forEach(({ cells, line }) => {
    const get = (key: keyof Omit<RosterRow, 'line'>) => clean(cells[header.indexOf(key)]);

    const email = (get('email') ?? '').toLowerCase();
    if (!email) {
      errors.push({ line, message: 'Email is missing.' });
      return;
    }
    if (!EMAIL_RE.test(email)) {
      errors.push({ line, message: `"${email}" is not a valid email address.` });
      return;
    }
    if (seenEmail.has(email)) {
      errors.push({ line, message: `${email} already appears on line ${seenEmail.get(email)}.` });
      return;
    }

    const roleText = (get('role') ?? 'student').toLowerCase().replace(/[\s-]+/g, '_');
    if (!(ROSTER_ROLES as readonly string[]).includes(roleText)) {
      errors.push({ line, message: `Role "${get('role')}" is not one of: ${ROSTER_ROLES.join(', ')}.` });
      return;
    }

    const rollNumber = get('rollNumber');
    if (rollNumber) {
      const key = rollNumber.toLowerCase();
      if (seenRoll.has(key)) {
        errors.push({ line, message: `Roll number ${rollNumber} already appears on line ${seenRoll.get(key)}.` });
        return;
      }
      seenRoll.set(key, line);
    }

    seenEmail.set(email, line);
    rows.push({
      line,
      email,
      fullName: get('fullName'),
      rollNumber,
      department: get('department'),
      batch: get('batch'),
      role: roleText as RosterRole,
    });
  });

  return { rows, errors };
}
