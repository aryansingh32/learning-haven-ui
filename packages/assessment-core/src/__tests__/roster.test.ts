import { parseCsv, parseRoster, MAX_ROSTER_ROWS } from '../roster';

describe('parseCsv', () => {
  it('handles quotes, doubled quotes, commas in fields, CRLF and a BOM', () => {
    const text = '﻿name,email\r\n"Rao, Priya","priya@college.edu"\r\n"He said ""hi""",x@y.in\n';
    expect(parseCsv(text)).toEqual([
      ['name', 'email'],
      ['Rao, Priya', 'priya@college.edu'],
      ['He said "hi"', 'x@y.in'],
    ]);
  });
});

describe('parseRoster', () => {
  it('maps common header spellings and normalises values', () => {
    const { rows, errors } = parseRoster(
      'Student Name,Email Address,Roll No,Branch,Section,Role\n' +
        'Priya Rao, PRIYA@College.edu ,21CS001,CSE,CSE-A,\n' +
        'Dr. Mehta,mehta@college.edu,,CSE,,Faculty\n'
    );
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { line: 2, email: 'priya@college.edu', fullName: 'Priya Rao', rollNumber: '21CS001', department: 'CSE', batch: 'CSE-A', role: 'student' },
      { line: 3, email: 'mehta@college.edu', fullName: 'Dr. Mehta', rollNumber: null, department: 'CSE', batch: null, role: 'faculty' },
    ]);
  });

  it('accepts "placement officer" written with a space', () => {
    const { rows } = parseRoster('email,role\ntpo@college.edu,Placement Officer\n');
    expect(rows[0].role).toBe('placement_officer');
  });

  it('requires an email column', () => {
    expect(parseRoster('name,roll\nA,1\n').errors).toEqual([{ line: 1, message: 'Add an "email" column to the first row.' }]);
  });

  it('reports each bad row by line and keeps the good ones', () => {
    const { rows, errors } = parseRoster(
      'email,roll number,role\n' +
        'a@c.edu,1,\n' +
        'not-an-email,2,\n' +
        ',3,\n' +
        'A@c.edu,4,\n' +
        'b@c.edu,1,\n' +
        'c@c.edu,5,owner\n' +
        'd@c.edu,6,\n'
    );
    expect(rows.map((r) => r.email)).toEqual(['a@c.edu', 'd@c.edu']);
    expect(errors).toEqual([
      { line: 3, message: '"not-an-email" is not a valid email address.' },
      { line: 4, message: 'Email is missing.' },
      { line: 5, message: 'a@c.edu already appears on line 2.' },
      { line: 6, message: 'Roll number 1 already appears on line 2.' },
      { line: 7, message: 'Role "owner" is not one of: student, faculty, evaluator, invigilator, placement_officer, admin.' },
    ]);
  });

  it('never allows importing an owner', () => {
    expect(parseRoster('email,role\nx@c.edu,owner\n').rows).toEqual([]);
  });

  it('ignores blank lines', () => {
    expect(parseRoster('email\n\n a@c.edu \n\n').rows.map((r) => r.line)).toEqual([3]);
  });

  it('rejects oversized files outright', () => {
    const big = 'email\n' + Array.from({ length: MAX_ROSTER_ROWS + 1 }, (_, i) => `s${i}@c.edu`).join('\n');
    expect(parseRoster(big)).toEqual({ rows: [], errors: [{ line: 1, message: `Upload at most ${MAX_ROSTER_ROWS} people per file.` }] });
  });

  it('reports an empty file', () => {
    expect(parseRoster('').errors[0].message).toBe('The file is empty.');
  });
});
