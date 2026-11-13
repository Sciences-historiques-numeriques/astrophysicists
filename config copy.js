'use strict';

// ---- Site configuration ----
const ENDPOINT = 'https://open-gdb.lod4hss.org/repositories/astrophysicists';  // SPARQL endpoint URL, e.g. 'https://example.org/sparql' (must allow CORS)

// Preferred label languages, in order ('' = untagged label; other languages are used last)
const LABEL_LANGS = ['en', 'fr', 'de', ''];

// Rows per page on the instance list (class.html)
const PAGE_SIZE = 50;
