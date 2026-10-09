// College question-bank import: one question per row of a CSV (or an Excel
// sheet converted to CSV in the browser). Forgiving about headers and answer
// styles, strict about content; every problem is reported with its line.

import { parseCsv } from './roster';

export type SheetQuestionType = 'mcq' | 'msq' | 'nat' | 'tf' | 'fib' | 'descriptive';

export interface SheetQuestion {
  line: number;
  type: SheetQuestionType;
  body: string;
  /** mcq/msq: option texts in order. */
  options: string[];
  /** mcq/msq: zero-based indices of the correct options. */
  correct: number[];
  natAnswer: number | null;
  natTolerance: number;
  marks: number;
  negativeMarks: number;
  section: string | null;
  topic: string | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  explanation: string | null;
  /** fib: accepted answers (Answer column, separated by |). */
  textAnswers: string[];
  /** descriptive: what earns marks (Answer or Rubric column). */
  rubric: string | null;
  tags: string[];
}

export interface SheetError { line: number; message: string }
export interface SheetParseResult { questions: SheetQuestion[]; errors: SheetError[] }

export const MAX_SHEET_QUESTIONS = 500;
const LETTERS = 'abcdefghij';

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');
const FIELDS: Record<string, string[]> = {
  type: ['type', 'questiontype', 'qtype', 'kind'],
  body: ['question', 'questiontext', 'body', 'text', 'q'],
  correct: ['correct', 'answer', 'correctanswer', 'correctoption', 'correctoptions', 'key', 'answerkey'],
  tolerance: ['tolerance', 'allowederror', 'range'],
  marks: ['marks', 'mark', 'score', 'points'],
  negative: ['negative', 'negativemarks', 'negativemark', 'minus', 'penalty'],
  section: ['section', 'part'],
  topic: ['topic', 'subject', 'chapter'],
  tags: ['tags', 'tag', 'keywords', 'labels'],
  rubric: ['rubric', 'markingscheme', 'modelanswer'],
  difficulty: ['difficulty', 'level'],
  explanation: ['explanation', 'solution', 'reason'],
};

/** Column index of each option A–J: "Option A", "A", "Option 1", "Opt1"… */
function optionColumns(headers: string[]): number[] {
  const cols: number[] = [];
  for (let k = 0; k < LETTERS.length; k++) {
    const names = [`option${LETTERS[k]}`, LETTERS[k], `option${k + 1}`, `opt${LETTERS[k]}`, `opt${k + 1}`, `choice${LETTERS[k]}`, `choice${k + 1}`];
    const i = headers.findIndex((h) => names.includes(h));
    if (i < 0) break;
    cols.push(i);
  }
  return cols;
}

function parseType(raw: string | null): SheetQuestionType | null | 'bad' {
  if (!raw) return null;
  const t = norm(raw);
  if (['mcq', 'single', 'singlechoice', 'singlecorrect', 'scq'].includes(t)) return 'mcq';
  if (['msq', 'multiple', 'multiplechoice', 'multiplecorrect', 'mcqmultiple', 'mamcq'].includes(t)) return 'msq';
  if (['nat', 'numeric', 'number', 'numerical', 'integer'].includes(t)) return 'nat';
  if (['tf', 'truefalse', 'trueorfalse', 'boolean', 'yesno'].includes(t)) return 'tf';
  if (['fib', 'fillintheblank', 'fillintheblanks', 'blank', 'fillup', 'fillups', 'shortanswer', 'oneword'].includes(t)) return 'fib';
  if (['descriptive', 'subjective', 'essay', 'longanswer', 'written', 'theory'].includes(t)) return 'descriptive';
  return 'bad';
}

/** "B", "2", "B,D", "1;3", or the option's exact text → zero-based indices. */
function parseCorrect(raw: string, options: string[]): number[] | null {
  const exact = options.findIndex((o) => o.trim().toLowerCase() === raw.trim().toLowerCase());
  if (exact >= 0 && !/^[a-j]$|^\d+$/i.test(raw.trim())) return [exact];
  const parts = raw.split(/[,;/|&]|\s+and\s+|\s+/i).map((p) => p.trim()).filter(Boolean);
  const out: number[] = [];
  for (const p of parts) {
    let i = -1;
    if (/^[a-j]$/i.test(p)) i = LETTERS.indexOf(p.toLowerCase());
    else if (/^\d+$/.test(p)) i = Number(p) - 1;
    else if (/^\(?[a-j]\)?$/i.test(p)) i = LETTERS.indexOf(p.replace(/[()]/g, '').toLowerCase());
    if (i < 0 || i >= options.length) return null;
    if (!out.includes(i)) out.push(i);
  }
  return out.length ? out.sort((a, b) => a - b) : null;
}

const num = (v: string | null) => (v === null ? null : Number(v.replace(/,/g, '')));

export function parseQuestionSheet(text: string): SheetParseResult {
  const rows = parseCsv(text).filter((r) => r.some((c) => c.trim() !== ''));
  const errors: SheetError[] = [];
  if (rows.length === 0) return { questions: [], errors: [{ line: 1, message: 'The file is empty.' }] };

  const headers = rows[0].map(norm);
  const col = Object.fromEntries(Object.entries(FIELDS).map(([k, names]) => [k, headers.findIndex((h) => names.includes(h))])) as Record<keyof typeof FIELDS, number>;
  const optionCols = optionColumns(headers);
  if (col.body < 0) return { questions: [], errors: [{ line: 1, message: 'Add a "Question" column (the first row must be the column names).' }] };
  if (rows.length - 1 > MAX_SHEET_QUESTIONS) return { questions: [], errors: [{ line: 1, message: `Import up to ${MAX_SHEET_QUESTIONS} questions at a time.` }] };

  const questions: SheetQuestion[] = [];
  rows.slice(1).forEach((row, n) => {
    const line = n + 2;
    const get = (i: number) => (i >= 0 ? (row[i] ?? '').trim() || null : null);
    const fail = (message: string) => errors.push({ line, message });

    const body = get(col.body);
    if (!body) return fail('The question text is empty.');
    if (body.length > 10_000) return fail('The question is longer than 10,000 characters.');
    const options = optionCols.map((i) => get(i)).filter((o): o is string => o !== null);
    const correctRaw = get(col.correct);

    let type = parseType(get(col.type));
    if (type === 'bad') return fail(`Unknown type "${get(col.type)}". Use mcq, msq, nat, tf, fib or descriptive.`);
    if (!type) type = options.length === 0 ? 'nat' : (correctRaw && parseCorrect(correctRaw, options)?.length ? (parseCorrect(correctRaw, options)!.length > 1 ? 'msq' : 'mcq') : 'mcq');

    const marks = num(get(col.marks)) ?? 1;
    const negative = num(get(col.negative)) ?? 0;
    if (!Number.isFinite(marks) || marks <= 0 || marks > 100) return fail('Marks must be a number between 0 and 100.');
    if (!Number.isFinite(negative) || negative < 0 || negative > 100) return fail('Negative marks must be 0 or more.');

    const diffRaw = get(col.difficulty)?.toLowerCase() ?? null;
    if (diffRaw && !['easy', 'medium', 'hard'].includes(diffRaw)) return fail('Difficulty must be easy, medium or hard.');
    const tags = [...new Set((get(col.tags) ?? '').split(/[,;|]/).map((t) => t.trim().toLowerCase()).filter(Boolean))];
    if (tags.length > 20) return fail('Use at most 20 tags.');
    if (tags.some((t) => t.length > 40)) return fail('A tag is longer than 40 characters.');
    const common = {
      line, type, body, marks, negativeMarks: ['mcq', 'tf', 'fib'].includes(type) ? negative : 0,
      section: get(col.section), topic: get(col.topic), difficulty: diffRaw as SheetQuestion['difficulty'], explanation: get(col.explanation),
      textAnswers: [] as string[], rubric: null as string | null, tags,
    };

    if (type === 'tf') {
      const v = norm(correctRaw ?? '');
      const truth = ['true', 't', 'yes', 'y', 'a', '1'].includes(v) ? 0 : ['false', 'f', 'no', 'n', 'b', '2'].includes(v) ? 1 : -1;
      if (truth < 0) return fail('A true/false question needs True or False in the Answer column.');
      return void questions.push({ ...common, options: ['True', 'False'], correct: [truth], natAnswer: null, natTolerance: 0 });
    }
    if (type === 'fib') {
      const accepted = (correctRaw ?? '').split('|').map((a) => a.trim()).filter(Boolean);
      if (accepted.length === 0) return fail('A fill-in-the-blank needs the answer in the Answer column (several allowed, separated by |).');
      if (accepted.length > 20 || accepted.some((a) => a.length > 200)) return fail('Use up to 20 accepted answers of up to 200 characters.');
      return void questions.push({ ...common, textAnswers: accepted, options: [], correct: [], natAnswer: null, natTolerance: 0 });
    }
    if (type === 'descriptive') {
      const rubric = get(col.rubric) ?? correctRaw;
      if (rubric && rubric.length > 5000) return fail('The rubric is longer than 5,000 characters.');
      return void questions.push({ ...common, rubric, options: [], correct: [], natAnswer: null, natTolerance: 0 });
    }

    if (type === 'nat') {
      const answer = num(correctRaw);
      if (answer === null || !Number.isFinite(answer)) return fail('A numeric question needs a number in the Answer column.');
      const tol = num(get(col.tolerance)) ?? 0;
      if (!Number.isFinite(tol) || tol < 0) return fail('Tolerance must be 0 or more.');
      return void questions.push({ ...common, options: [], correct: [], natAnswer: answer, natTolerance: tol });
    }

    if (options.length < 2) return fail('Add at least two options (Option A, Option B…).');
    if (options.some((o) => o.length > 2000)) return fail('An option is longer than 2,000 characters.');
    if (!correctRaw) return fail('Say which option is correct (e.g. B, or B,D for several).');
    const correct = parseCorrect(correctRaw, options);
    if (!correct) return fail(`"${correctRaw}" doesn't match any option. Use a letter (A–${LETTERS[options.length - 1].toUpperCase()}), a number, or the option's text.`);
    if (type === 'mcq' && correct.length !== 1) return fail('A single-choice question needs exactly one correct option (use type msq for several).');
    questions.push({ ...common, options, correct, natAnswer: null, natTolerance: 0 });
  });

  return { questions, errors };
}

/** A starter sheet for colleges (CSV; opens in Excel). */
export const QUESTION_SHEET_TEMPLATE = [
  'Type,Question,Option A,Option B,Option C,Option D,Answer,Marks,Negative marks,Section,Topic,Difficulty,Explanation,Tags',
  'mcq,"A train covers 120 km in 2 hours. What is its speed?",40 km/h,60 km/h,80 km/h,100 km/h,B,1,0.25,Aptitude,Speed and distance,easy,Speed = distance / time = 60 km/h,"quant, speed"',
  'msq,Which of these are O(1) on an array?,Index access,Linear search,Append (amortised),Binary search,"A,C",2,0,Technical,Arrays,medium,,arrays',
  'nat,What is 15% of 240?,,,,,36,1,0,Aptitude,Percentages,easy,0.15 × 240 = 36,quant',
  'tf,A stack is first-in first-out.,,,,,False,1,0,Technical,Stacks,easy,A stack is last-in first-out,data structures',
  'fib,The process plants use to make food from sunlight is ___.,,,,,photosynthesis|photo synthesis,1,0,General,Biology,easy,,science',
  'descriptive,"Explain the difference between a process and a thread, with an example.",,,,,"2 marks: definitions; 2 marks: memory sharing; 1 mark: example",5,0,Technical,Operating systems,medium,,os',
].join('\r\n');
