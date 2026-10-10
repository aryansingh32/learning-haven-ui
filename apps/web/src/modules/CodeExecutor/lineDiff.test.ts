import { collapseUnchanged, diffLines, diffStats, toSideBySide } from './lineDiff';

describe('line diff', () => {
  it('finds added, removed and unchanged lines with their line numbers', () => {
    const before = 'a\nb\nc\nd\n';
    const after = 'a\nB\nc\nd\ne\n';
    const ops = diffLines(before, after);
    expect(ops).toEqual([
      { type: 'same', text: 'a', a: 1, b: 1 },
      { type: 'del', text: 'b', a: 2 },
      { type: 'add', text: 'B', b: 2 },
      { type: 'same', text: 'c', a: 3, b: 3 },
      { type: 'same', text: 'd', a: 4, b: 4 },
      { type: 'add', text: 'e', b: 5 },
    ]);
    expect(diffStats(ops)).toEqual({ added: 2, removed: 1 });
  });

  it('identical code has no changes; CRLF and a trailing newline do not count', () => {
    expect(diffStats(diffLines('x\r\ny', 'x\ny\n'))).toEqual({ added: 0, removed: 0 });
  });

  it('handles an empty side', () => {
    expect(diffStats(diffLines('', 'a\nb'))).toEqual({ added: 2, removed: 0 });
    expect(diffLines('a', 'a')).toHaveLength(1);
  });

  it('keeps the longest common lines in the middle of an edit', () => {
    const ops = diffLines('x\n1\n2\n3\ny', 'z\n1\n2\n3\nw');
    expect(ops.filter((o) => o.type === 'same').map((o) => o.text)).toEqual(['1', '2', '3']);
  });

  it('pairs removed and added lines side by side', () => {
    const rows = toSideBySide(diffLines('a\nb\nc', 'a\nB1\nB2\nc'));
    expect(rows).toEqual([
      { left: { no: 1, text: 'a', changed: false }, right: { no: 1, text: 'a', changed: false } },
      { left: { no: 2, text: 'b', changed: true }, right: { no: 2, text: 'B1', changed: true } },
      { right: { no: 3, text: 'B2', changed: true } },
      { left: { no: 3, text: 'c', changed: false }, right: { no: 4, text: 'c', changed: false } },
    ]);
  });

  it('collapses long unchanged stretches around changes', () => {
    const lines = Array.from({ length: 20 }, (_, i) => `l${i}`);
    const after = [...lines];
    after[10] = 'changed';
    const ops = diffLines(lines.join('\n'), after.join('\n'));
    const shown = collapseUnchanged(ops, (o) => o.type !== 'same', 2);
    expect(shown[0]).toEqual({ skipped: 8 });
    expect(shown[shown.length - 1]).toEqual({ skipped: 7 });
    expect(shown.filter((s) => !('skipped' in s))).toHaveLength(6);
  });
});
