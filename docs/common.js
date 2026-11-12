'use strict';
// Requires config.js (ENDPOINT, LABEL_LANGS, PAGE_SIZE) to be loaded first.

const LABEL_PROP = '<http://www.w3.org/2000/01/rdf-schema#label>';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

/* ---------- small helpers ---------- */
const $ = id => document.getElementById(id);
function esc(s) {
  return String(s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function short(iri) {
  const m = iri.match(/[#\/]([^#\/]+)\/?$/);
  return m ? m[1] : iri;
}

/* ---------- state ---------- */
// Hash format: #iri=...&page=...&g=<graph>&g=<graph>
//   no g param -> all graphs;  g= (empty) -> none;  g=a&g=b -> subset
let graphList = [];        // graph IRIs of the endpoint
let graphsLoaded = false;
let hashSel = null;        // selection read from the hash
let selCache = null;       // current selection (null = all)
let renderFn = null;

const endpoint = () => ENDPOINT.trim();
const hashParams = () => new URLSearchParams(location.hash.slice(1));
const param = name => hashParams().get(name);

function readHash() {
  const p = hashParams();
  if ($('iri') && p.get('iri') !== null) $('iri').value = p.get('iri');
  const g = p.getAll('g');
  hashSel = !g.length ? null : (g.length === 1 && g[0] === '') ? [] : g;
}

function computeSel() {
  if (!graphList.length) return null;
  const c = [...document.querySelectorAll('#graphs-list input:checked')].map(i => i.value);
  return c.length === graphList.length ? null : c;
}
function updateSel() { selCache = computeSel(); }
function currentSel() { return selCache; }

function applySel(p, sel) {
  p.delete('g');
  if (sel) { if (sel.length) sel.forEach(g => p.append('g', g)); else p.append('g', ''); }
}

// Link to another page, carrying the graph selection (+ extra params)
function href(file, extra = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  applySel(p, currentSel());
  return `${file}#${p}`;
}
// Hash of the current page with some params changed (null removes a param)
function hashWith(overrides = {}) {
  const p = hashParams();
  applySel(p, currentSel());
  for (const [k, v] of Object.entries(overrides)) v === null ? p.delete(k) : p.set(k, v);
  return '#' + p;
}
function goto(overrides = {}) {
  const before = location.hash;
  location.hash = hashWith(overrides).slice(1);
  if (location.hash === before) refresh();  // hashchange will not fire
}

function iriLink(iri, label, file = 'entity.html') {
  return `<a href="${esc(href(file, { iri }))}" title="${esc(iri)}">${esc(label || short(iri))}</a>`;
}

// Filter input to put above a table; wired up by start()
function filterInput() {
  return '<input type="search" class="tfilter" placeholder="Filter rows…" aria-label="Filter rows">';
}

/* ---------- SPARQL ---------- */
async function select(query) {
  const res = await fetch(endpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded',
               'Accept': 'application/sparql-results+json' },
    body: new URLSearchParams({ query })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()).results.bindings;
}

// Restrict a triple pattern to the selected graphs (binds ?g)
function inGraphs(sel, body) {
  const values = sel ? `VALUES ?g { ${sel.map(g => `<${g}>`).join(' ')} }` : '';
  return `${values} GRAPH ?g { ${body} }`;
}

// Optional rdfs:label for a set of IRIs, looked up in any graph. Returns Map(iri -> label)
async function fetchLabels(iris) {
  const best = new Map(), rank = new Map();
  const uniq = [...new Set(iris)].filter(Boolean);
  const chunks = [];
  for (let i = 0; i < uniq.length; i += 100) chunks.push(uniq.slice(i, i + 100));
  await Promise.all(chunks.map(async chunk => {
    const values = chunk.map(x => `<${x}>`).join(' ');
    try {
      const rows = await select(
        `SELECT ?s ?l WHERE { VALUES ?s { ${values} } ` +
        `{ ?s ${LABEL_PROP} ?l } UNION { GRAPH ?lg { ?s ${LABEL_PROP} ?l } } }`);
      for (const r of rows) {
        const lang = (r.l['xml:lang'] || '').toLowerCase().split('-')[0];
        let k = LABEL_LANGS.indexOf(lang);
        if (k < 0) k = LABEL_LANGS.length;
        if (!best.has(r.s.value) || k < rank.get(r.s.value)) {
          best.set(r.s.value, r.l.value);
          rank.set(r.s.value, k);
        }
      }
    } catch (e) { /* labels are optional */ }
  }));
  return best;
}

/* ---------- graph box ---------- */
async function loadGraphs() {
  if (graphsLoaded) return;
  graphsLoaded = true;
  graphList = [];
  $('graphs-list').innerHTML = '<span class="sub">Loading graphs…</span>';
  try {
    const rows = await select(
      'SELECT DISTINCT ?g WHERE { GRAPH ?g { ?s ?p ?o } } ORDER BY ?g LIMIT 500');
    graphList = rows.map(r => r.g.value);
  } catch (e) {
    $('graphs-list').innerHTML =
      `<span class="err">Could not list graphs (${esc(e.message)}). Querying without graph filter.</span>`;
    return;
  }
  $('graphs-list').innerHTML = graphList.length
    ? graphList.map(g =>
        `<label><input type="checkbox" value="${esc(g)}"> <span>${esc(g)}</span></label>`).join('')
    : '<span class="sub">No named graphs found.</span>';
}

function syncCheckboxes() {
  document.querySelectorAll('#graphs-list input').forEach(i => {
    i.checked = hashSel === null || hashSel.includes(i.value);
  });
  updateSel();
  const n = document.querySelectorAll('#graphs-list input:checked').length;
  $('graphs-summary').textContent = graphList.length
    ? `Graphs (${n} of ${graphList.length} selected)` : 'Graphs';
}

function setAll(v) {
  document.querySelectorAll('#graphs-list input').forEach(i => i.checked = v);
  updateSel();
  goto({ page: null });
}

/* ---------- page skeleton ---------- */
function buildChrome(withIri) {
  $('chrome').innerHTML = `
    <nav><a id="nav-classes" href="index.html">Classes</a></nav>
    ${withIri ? `<form id="cfg">
      <input type="text" id="iri" placeholder="Entity IRI">
      <button>Load</button>
    </form>` : ''}
    <details id="graphs-box">
      <summary id="graphs-summary">Graphs</summary>
      <div class="tools">
        <button type="button" id="g-all">Select all</button>
        <button type="button" id="g-none">Select none</button>
      </div>
      <div id="graphs-list"></div>
    </details>`;
}

async function refresh() {
  readHash();
  if (!endpoint()) {
    $('out').innerHTML = '<p class="err">No SPARQL endpoint configured. Set ENDPOINT in config.js.</p>';
    return;
  }
  await loadGraphs();
  syncCheckboxes();
  $('nav-classes').href = href('index.html');
  const sel = currentSel();
  if (sel && !sel.length) {
    $('out').innerHTML = '<p class="sub">No graph selected. Tick at least one graph above.</p>';
    return;
  }
  await renderFn();
}

function start(fn, opts = {}) {
  renderFn = fn;
  buildChrome(!!opts.iriField);
  if ($('cfg')) {
    $('cfg').addEventListener('submit', e => {
      e.preventDefault();
      goto({ page: null, iri: $('iri').value.trim() });
    });
  }
  $('graphs-list').addEventListener('change', () => { updateSel(); goto({ page: null }); });
  $('g-all').addEventListener('click', () => setAll(true));
  $('g-none').addEventListener('click', () => setAll(false));

  // Row filter for every table (one input per table, matches IRI, label, graph...)
  $('out').addEventListener('input', e => {
    if (!e.target.classList.contains('tfilter')) return;
    const q = e.target.value.trim().toLowerCase();
    const section = e.target.closest('section');
    section.querySelectorAll('tr').forEach(tr => {
      if (!tr.querySelector('td')) return;  // keep header rows
      const titles = [...tr.querySelectorAll('[title]')].map(a => a.title).join(' ');
      tr.hidden = q !== '' && !(tr.textContent + ' ' + titles).toLowerCase().includes(q);
    });
  });

  window.addEventListener('hashchange', refresh);
  refresh();
}
