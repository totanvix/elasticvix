export function parseRequestLine(
  line: string,
): { method: string; path: string; index?: string; endpoint?: string } {
  const trimmed = line.trim();
  const space = trimmed.indexOf(' ');
  let method = 'GET';
  let path = trimmed;
  if (space !== -1) {
    method = trimmed.slice(0, space).toUpperCase();
    path = trimmed.slice(space + 1).trim();
  }
  const clean = (path.split('?')[0] ?? '').replace(/^\//, '');
  const segs = clean.split('/').filter(Boolean);
  let index: string | undefined;
  let endpoint: string | undefined;
  let foundEndpoint = false;
  for (const seg of segs) {
    if (seg.startsWith('_')) {
      foundEndpoint = true;
      endpoint = endpoint ? `${endpoint}/${seg}` : seg;
    } else if (foundEndpoint) {
      endpoint = endpoint ? `${endpoint}/${seg}` : seg;
    } else if (!index) {
      index = seg;
    }
  }
  return { method, path: path.startsWith('/') ? path : `/${path}`, index, endpoint };
}
