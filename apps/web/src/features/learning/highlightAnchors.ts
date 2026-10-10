/**
 * Finding a saved highlight again in a lesson's text, and turning a text
 * selection into something we can save. Offsets count characters of the
 * container's text nodes in document order (the same as textContent).
 */

export type HighlightAnchor = { text: string; prefix: string; suffix: string; start_offset: number };

const CONTEXT = 32;

/** Where the highlight sits in `fullText` now: its saved offset, else the best match by context, else null. */
export function locateHighlight(fullText: string, h: HighlightAnchor): { start: number; end: number } | null {
  const { text } = h;
  if (!text) return null;
  if (fullText.substr(h.start_offset, text.length) === text) return { start: h.start_offset, end: h.start_offset + text.length };

  const hits: number[] = [];
  for (let i = fullText.indexOf(text); i !== -1; i = fullText.indexOf(text, i + 1)) hits.push(i);
  if (!hits.length) return null;
  const score = (i: number) => {
    let s = 0;
    if (h.prefix && fullText.slice(Math.max(0, i - h.prefix.length), i) === h.prefix) s += 2;
    if (h.suffix && fullText.slice(i + text.length, i + text.length + h.suffix.length) === h.suffix) s += 2;
    return s;
  };
  const best = hits.reduce((a, b) => {
    const d = score(b) - score(a);
    if (d !== 0) return d > 0 ? b : a;
    return Math.abs(b - h.start_offset) < Math.abs(a - h.start_offset) ? b : a;
  });
  return { start: best, end: best + text.length };
}

/** An anchor for `[start, end)` of `fullText`, trimmed of surrounding whitespace. Null if nothing is left. */
export function anchorFromOffsets(fullText: string, start: number, end: number): HighlightAnchor | null {
  let s = Math.max(0, Math.min(start, end));
  let e = Math.min(fullText.length, Math.max(start, end));
  while (s < e && /\s/.test(fullText[s])) s++;
  while (e > s && /\s/.test(fullText[e - 1])) e--;
  if (e <= s) return null;
  return {
    text: fullText.slice(s, e),
    prefix: fullText.slice(Math.max(0, s - CONTEXT), s),
    suffix: fullText.slice(e, e + CONTEXT),
    start_offset: s,
  };
}

function textNodes(container: Node): Text[] {
  const out: Text[] = [];
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n as Text);
  return out;
}

export function containerText(container: Node): string {
  return textNodes(container).map((t) => t.data).join('');
}

/** Character offset of a (node, offset) boundary inside `container`. */
function boundaryOffset(container: Node, node: Node, offset: number): number {
  const r = document.createRange();
  r.setStart(container, 0);
  r.setEnd(node, offset);
  return r.toString().length;
}

/** Anchor for the current selection if it lies inside `container`. */
export function anchorFromSelection(container: HTMLElement, selection: Selection | null): HighlightAnchor | null {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) return null;
  const start = boundaryOffset(container, range.startContainer, range.startOffset);
  const end = boundaryOffset(container, range.endContainer, range.endOffset);
  return anchorFromOffsets(containerText(container), start, end);
}

/** A DOM Range covering `[start, end)` of the container's text. */
export function rangeFromOffsets(container: Node, start: number, end: number): Range | null {
  let pos = 0;
  let startNode: Text | null = null;
  let startOff = 0;
  for (const node of textNodes(container)) {
    const len = node.data.length;
    if (!startNode && start < pos + len) {
      startNode = node;
      startOff = start - pos;
    }
    if (startNode && end <= pos + len) {
      const r = document.createRange();
      r.setStart(startNode, startOff);
      r.setEnd(node, end - pos);
      return r;
    }
    pos += len;
  }
  return null;
}
