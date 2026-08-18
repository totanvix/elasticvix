export type ReleaseEntry = {
  version: string;
  date: string; // ISO 'YYYY-MM-DD'
  changes: readonly string[];
};

// Newest first. Add an entry before running `pnpm release` — the version bump
// creates the tag commit, so anything added later lands outside the tag.
export const RELEASES: readonly ReleaseEntry[] = [
  {
    version: '1.0.9',
    date: '2026-08-18',
    changes: [
      'Multi-request console — write several requests in one editor; Cmd+Enter or Run executes the request at the cursor.',
      'Autocomplete now covers many more query types — wildcard, prefix, fuzzy, regexp, multi_match, query_string, simple_query_string, ids, nested, constant_score, dis_max and function_score.',
      'Autocomplete for more aggregations — date_histogram, histogram, percentiles, cardinality, stats, value_count, range, filter, top_hits, and nested sub-aggregations.',
      'Fix: Cmd+Enter in the REST console runs the request instead of inserting a blank line.',
    ],
  },
  {
    version: '1.0.8',
    date: '2026-08-13',
    changes: [
      'Backup & restore — export your connections and saved queries to a JSON file, and import them back on another machine.',
      "Release notes now live in the extension — open Settings → What's new to see what changed.",
      'Backup, theme and website links now live in one Settings menu in the nav.',
    ],
  },
  {
    version: '1.0.7',
    date: '2026-08-03',
    changes: [
      'Help icon in the nav opens the Elasticvix website.',
      'Fix: the type column stays visible for long field names in the mapping dialog.',
    ],
  },
  {
    version: '1.0.6',
    date: '2026-07-31',
    changes: [
      'CLUSTER tab with a per-node table of RAM, heap, disk and CPU.',
      'Edit and delete a document straight from the document dialog.',
    ],
  },
  {
    version: '1.0.5',
    date: '2026-07-30',
    changes: ['Response viewer — fold JSON, filter by path, and download the response.'],
  },
  {
    version: '1.0.4',
    date: '2026-07-30',
    changes: [
      'Field linting against the index mapping, with an on/off toggle.',
      'Searchable mapping viewer — browse every field and its type.',
    ],
  },
  {
    version: '1.0.3',
    date: '2026-07-29',
    changes: ['Field-value autocomplete — real keyword values pulled from your data and cached.'],
  },
  {
    version: '1.0.2',
    date: '2026-07-23',
    changes: ['First Chrome Web Store release.'],
  },
];
