import { describe, expect, it } from 'vitest';
import { anchorFromOffsets, anchorFromSelection, containerText, locateHighlight, rangeFromOffsets } from './highlightAnchors';

const TEXT = 'A stack is LIFO. A queue is FIFO. A stack is used for undo.';

describe('locateHighlight', () => {
  it('uses the saved offset when the text is still there', () => {
    const at = TEXT.indexOf('used for undo');
    expect(locateHighlight(TEXT, { text: 'used for undo', prefix: '', suffix: '', start_offset: at })).toEqual({ start: at, end: at + 13 });
  });

  it('finds the right copy by its context after the lesson changed', () => {
    const second = TEXT.lastIndexOf('A stack');
    const edited = 'Intro. ' + TEXT;
    const hit = locateHighlight(edited, { text: 'A stack', prefix: 'FIFO. ', suffix: ' is used', start_offset: second });
    expect(hit?.start).toBe(second + 7);
  });

  it('gives up when the text is gone', () => {
    expect(locateHighlight(TEXT, { text: 'heap', prefix: '', suffix: '', start_offset: 0 })).toBeNull();
  });
});

describe('anchors', () => {
  it('trims whitespace and keeps context on both sides', () => {
    const start = TEXT.indexOf(' A queue');
    const a = anchorFromOffsets(TEXT, start, start + 17);
    expect(a).toMatchObject({ text: 'A queue is FIFO.', start_offset: start + 1 });
    expect(a?.prefix).toBe('A stack is LIFO. ');
    expect(a?.suffix.startsWith(' A stack')).toBe(true);
  });

  it('turns a selection across elements into offsets and back', () => {
    const el = document.createElement('div');
    el.innerHTML = '<h1>Stacks</h1><p>A stack is <strong>LIFO</strong>: last in, first out.</p>';
    document.body.appendChild(el);
    const full = containerText(el);
    const start = full.indexOf('stack is');
    const end = full.indexOf(': last');
    const range = rangeFromOffsets(el, start, end)!;
    expect(range.toString()).toBe('stack is LIFO');
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    expect(anchorFromSelection(el, sel)).toMatchObject({ text: 'stack is LIFO', start_offset: start });
    const outside = document.createElement('p');
    outside.textContent = 'elsewhere';
    document.body.appendChild(outside);
    sel.removeAllRanges();
    const r2 = document.createRange();
    r2.selectNodeContents(outside);
    sel.addRange(r2);
    expect(anchorFromSelection(el, sel)).toBeNull();
  });
});
