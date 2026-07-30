export interface DocRef {
  index: string;
  type?: string; // hit._type; undefined on 7.x+
  id: string;
}

export interface DocMeta {
  source: Record<string, unknown>;
  seqNo?: number;
  primaryTerm?: number;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function documentPath(ref: DocRef): string {
  const type = ref.type ?? '_doc';
  return `/${ref.index}/${type}/${encodeURIComponent(ref.id)}`;
}

export function writePath(path: string, guard: { seqNo?: number; primaryTerm?: number }): string {
  const params = ['refresh=wait_for'];
  if (guard.seqNo !== undefined && guard.primaryTerm !== undefined) {
    params.push(`if_seq_no=${guard.seqNo}`, `if_primary_term=${guard.primaryTerm}`);
  }
  return `${path}?${params.join('&')}`;
}

export function extractDocMeta(getBody: unknown): DocMeta | undefined {
  if (!isPlainObject(getBody) || getBody.found !== true) return undefined;
  const source = getBody._source;
  if (!isPlainObject(source)) return undefined;
  const seqNo = typeof getBody._seq_no === 'number' ? getBody._seq_no : undefined;
  const primaryTerm = typeof getBody._primary_term === 'number' ? getBody._primary_term : undefined;
  return { source, seqNo, primaryTerm };
}

export function parseEditableSource(
  text: string,
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Invalid JSON' };
  }
  if (!isPlainObject(parsed)) return { ok: false, error: 'Document must be a JSON object' };
  return { ok: true, value: parsed };
}
