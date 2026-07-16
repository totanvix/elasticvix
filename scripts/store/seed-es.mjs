const ES = process.env.ES_URL;
if (!ES) {
  console.error('ES_URL is required, e.g. ES_URL=http://localhost:9201 node scripts/store/seed-es.mjs');
  process.exit(1);
}

// LCG có seed cố định để dữ liệu tái lập được giữa các lần chạy
let seed = 42;
function rand() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
function pick(arr) {
  return arr[Math.floor(rand() * arr.length)];
}

async function createIndex(name, mappings) {
  await fetch(`${ES}/${name}`, { method: 'DELETE' }).catch(() => {});
  const res = await fetch(`${ES}/${name}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mappings }),
  });
  if (!res.ok) throw new Error(`create ${name}: ${res.status} ${await res.text()}`);
}

async function bulk(index, docs) {
  const ndjson =
    docs.flatMap((d) => [JSON.stringify({ index: { _index: index } }), JSON.stringify(d)]).join('\n') + '\n';
  const res = await fetch(`${ES}/_bulk?refresh=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-ndjson' },
    body: ndjson,
  });
  const body = await res.json();
  if (body.errors) throw new Error(`bulk ${index} had errors`);
  console.log(`${index}: ${docs.length} docs`);
}

// --- products (200 docs) ---
await createIndex('products', {
  properties: {
    name: { type: 'text', fields: { keyword: { type: 'keyword' } } },
    category: { type: 'keyword' },
    brand: { type: 'keyword' },
    price: { type: 'float' },
    rating: { type: 'float' },
    in_stock: { type: 'boolean' },
    created_at: { type: 'date' },
  },
});
const categories = ['laptops', 'phones', 'audio', 'wearables', 'cameras', 'accessories'];
const brands = ['Aurora', 'Nimbus', 'Vertex', 'Pulse', 'Orbit'];
const adjectives = ['Pro', 'Air', 'Max', 'Lite', 'Ultra', 'Mini'];
const nouns = ['Book', 'Pad', 'Buds', 'Watch', 'Cam', 'Dock', 'Hub', 'Drive'];
const products = Array.from({ length: 200 }, (_, i) => ({
  name: `${pick(brands)} ${pick(nouns)} ${pick(adjectives)} ${100 + i}`,
  category: pick(categories),
  brand: pick(brands),
  price: Math.round((10 + rand() * 1990) * 100) / 100,
  rating: Math.round((1 + rand() * 4) * 10) / 10,
  in_stock: rand() > 0.2,
  created_at: new Date(Date.UTC(2026, 0, 1) + Math.floor(rand() * 190) * 86400000).toISOString(),
}));
await bulk('products', products);

// --- app-logs (500 docs) ---
await createIndex('app-logs', {
  properties: {
    '@timestamp': { type: 'date' },
    level: { type: 'keyword' },
    service: { type: 'keyword' },
    message: { type: 'text' },
    latency_ms: { type: 'integer' },
    status: { type: 'integer' },
  },
});
const levels = ['info', 'info', 'info', 'warn', 'error'];
const services = ['api-gateway', 'orders', 'payments', 'search', 'auth'];
const messages = [
  'request completed',
  'cache miss, falling back to database',
  'retrying upstream call',
  'connection pool exhausted',
  'token refreshed',
  'slow query detected',
];
const logs = Array.from({ length: 500 }, () => ({
  '@timestamp': new Date(Date.UTC(2026, 6, 15) + Math.floor(rand() * 86400000)).toISOString(),
  level: pick(levels),
  service: pick(services),
  message: pick(messages),
  latency_ms: Math.floor(rand() * 900) + 5,
  status: pick([200, 200, 200, 201, 404, 500]),
}));
await bulk('app-logs', logs);

console.log('Seed done.');
