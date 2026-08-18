import { parseRequestLine } from './requestLine';

// A block starts at a column-0 line `METHOD /path` (method required — unlike
// parseRequestLine's single-request tolerance for a bare path). A flush-left
// unquoted METHOD line inside a body would split the block, but such a line
// makes the JSON invalid anyway — same tradeoff Kibana's console makes.
const REQUEST_LINE = /^(GET|POST|PUT|DELETE|HEAD|PATCH)\s+\S/i;

export interface RequestBlock {
  method: string;
  path: string;
  index?: string;
  endpoint?: string;
  lineFrom: number; // offset of the first char of the METHOD line (always column 0)
  lineTo: number; // offset just past the METHOD line's content (excludes \r and \n)
  bodyFrom: number; // start of the line after the METHOD line; === docText.length when it is the last line
  bodyTo: number; // end of body, trailing blank lines/whitespace excluded; === bodyFrom when body is empty
  bodyText: string; // docText.slice(bodyFrom, bodyTo)
}

export interface TextEdit {
  from: number;
  to: number;
  insert: string;
}

export function splitBlocks(docText: string): RequestBlock[] {
  const starts: { lineFrom: number; lineTo: number; nextLineStart: number; content: string }[] = [];
  let offset = 0;
  for (;;) {
    const nl = docText.indexOf('\n', offset);
    const end = nl === -1 ? docText.length : nl;
    let content = docText.slice(offset, end);
    let lineTo = end;
    if (content.endsWith('\r')) {
      content = content.slice(0, -1);
      lineTo -= 1;
    }
    if (REQUEST_LINE.test(content)) {
      starts.push({ lineFrom: offset, lineTo, nextLineStart: nl === -1 ? docText.length : nl + 1, content });
    }
    if (nl === -1) break;
    offset = nl + 1;
  }

  return starts.map((s, i) => {
    const bodyFrom = s.nextLineStart;
    const rawEnd = starts[i + 1]?.lineFrom ?? docText.length;
    const bodyText = docText.slice(bodyFrom, rawEnd).replace(/\s+$/, '');
    const { method, path, index, endpoint } = parseRequestLine(s.content);
    return {
      method,
      path,
      index,
      endpoint,
      lineFrom: s.lineFrom,
      lineTo: s.lineTo,
      bodyFrom,
      bodyTo: bodyFrom + bodyText.length,
      bodyText,
    };
  });
}

// The last block whose request line starts at or before `pos`. One rule covers
// every boundary: inside a block -> that block; on a blank line after a block
// -> the preceding block; at the first char of the next request line -> the
// next block; before the first block -> undefined.
export function blockAt(blocks: RequestBlock[], pos: number): RequestBlock | undefined {
  let found: RequestBlock | undefined;
  for (const b of blocks) {
    if (b.lineFrom > pos) break;
    found = b;
  }
  return found;
}

// The block Run/Cmd+Enter would execute: the block at `pos`, falling back to
// the first block when the cursor sits in leading junk.
export function runnableBlockAt(blocks: RequestBlock[], pos: number): RequestBlock | undefined {
  return blockAt(blocks, pos) ?? blocks[0];
}

export function activeBlockRange(docText: string, pos: number): { from: number; to: number } | undefined {
  const block = runnableBlockAt(splitBlocks(docText), pos);
  if (!block) return undefined;
  return { from: block.lineFrom, to: block.bodyText ? block.bodyTo : block.lineTo };
}

// One edit per block whose body is valid JSON and not already pretty-printed.
export function formatBodyEdits(docText: string): TextEdit[] {
  const edits: TextEdit[] = [];
  for (const block of splitBlocks(docText)) {
    if (!block.bodyText) continue;
    try {
      const insert = JSON.stringify(JSON.parse(block.bodyText), null, 2);
      if (insert !== block.bodyText) edits.push({ from: block.bodyFrom, to: block.bodyTo, insert });
    } catch {
      /* invalid JSON body stays as typed */
    }
  }
  return edits;
}

export function applyEdits(docText: string, edits: TextEdit[]): string {
  let out = docText;
  for (const e of [...edits].sort((a, b) => b.from - a.from)) {
    out = out.slice(0, e.from) + e.insert + out.slice(e.to);
  }
  return out;
}

// Insert-only edit that appends a request after the existing content with
// exactly one blank line of separation (none for an empty doc; extra existing
// trailing newlines are left alone). `cursor` is the start of the METHOD line.
export function appendRequestEdit(
  docText: string,
  r: { method: string; path: string; body?: string },
): { from: number; insert: string; cursor: number } {
  const from = docText.length;
  let sep = '';
  if (docText.trim() !== '') {
    const trailing = (docText.match(/(?:\r?\n)*$/)?.[0].match(/\n/g) ?? []).length;
    sep = '\n'.repeat(Math.max(0, 2 - trailing));
  }
  const insert = `${sep}${r.method} ${r.path}${r.body ? `\n${r.body}` : ''}`;
  return { from, insert, cursor: from + sep.length };
}
