'use strict';

// ---- Site configuration ----

// true : ENDPOINT below is used on every page and nothing has to be entered.
// false: the start page (index.html) shows an input for the triplestore URL. It is remembered in
//        the browser (localStorage) while you navigate, and can be changed on the start page only.
//        ENDPOINT below is then just the default value of that input.
const FIXED_TRIPLESTORE_URL = false;

const ENDPOINT = 'https://open-gdb.lod4hss.org/repositories/astrophysicists';  // SPARQL endpoint URL, e.g. 'http://localhost:9091/rdf4j-server/repositories/myrepo' (must allow CORS)

// Preferred label languages, in order ('' = untagged label; other languages are used last)
const LABEL_LANGS = ['en', 'fr', 'de', ''];

// Rows per page on the instance list (class.html)
const PAGE_SIZE = 50;
