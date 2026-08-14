// Single source of truth for the store screenshot set: the capture step writes
// `raw/<file>`, the compose step reads it back and renders the framed 1280x800
// listing image to `docs/store/screenshots/<file>`. Keeping both halves on one
// list is what stops the caption from drifting away from the UI it describes.
//
// The Chrome Web Store accepts at most 5 screenshots, so this list is capped at
// 5 on purpose — see docs/store/submission-checklist.md step 9.
export const SHOTS = [
  {
    id: 1,
    file: '01-search.png',
    title: 'Search your cluster visually',
    subtitle: 'Pick indices, run the query, browse hits in a sortable table.',
  },
  {
    id: 2,
    file: '02-console-autocomplete.png',
    title: 'Autocomplete that reads your mappings',
    subtitle: 'Real field names from your own indices, suggested as you type.',
  },
  {
    id: 3,
    file: '03-cluster.png',
    title: 'Cluster health at a glance',
    subtitle: 'Version, shards and docs, plus RAM, heap, disk and CPU per node.',
  },
  {
    id: 4,
    file: '04-saved-queries.png',
    title: 'Save queries, keep every request',
    subtitle: 'Name and tag what you reuse — history records the rest for you.',
  },
  {
    id: 5,
    file: '05-dark-mode.png',
    title: 'Many clusters, light or dark',
    subtitle: 'Switch clusters instantly. Connections never leave your machine.',
  },
];

export const RAW_DIR = 'node_modules/.cache/elasticvix-shots-raw';
export const OUT_DIR = 'docs/store/screenshots';

// Capture viewport (CSS px). Aspect ratio matches the frame's 1204x640 card, so
// nothing is cropped or letterboxed. Deliberately narrower than the card: the
// UI is scaled *up* on the way in, which is what keeps the editor font legible
// at the size the store actually renders these images.
export const SHOT_VIEWPORT = { width: 1120, height: 610 };

// Card the frame draws the capture into. Height follows the viewport aspect so
// the UI is scaled, never cropped or squashed.
export const CARD_WIDTH = 1204;
export const CARD_HEIGHT = Math.round((CARD_WIDTH * SHOT_VIEWPORT.height) / SHOT_VIEWPORT.width);
