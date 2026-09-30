#!/usr/bin/env node
/**
 * Fetches DBLP publication data for team members (by DBLP person id, via the DBLP SPARQL
 * endpoint) and writes _data/dblp_research.json.
 * Run before `jekyll build` (e.g. in CI or locally) so the research page is static.
 *
 * Usage: node scripts/fetch-dblp.js
 * Requires: Node 18+, no npm dependencies.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const TEAM_YML = path.join(ROOT, '_data', 'team.yml');
const OUT_JSON = path.join(ROOT, '_data', 'dblp_research.json');
const SPARQL_ENDPOINT = 'https://sparql.dblp.org/sparql';
// Abort instead of writing if the paper count falls below this share of the existing file.
const MIN_RETAINED_SHARE = 0.8;

// ----- Parse team.yml (no YAML dep) -----
function parseTeamYml(content) {
  const members = [];
  let current = {};
  for (const line of content.split(/\r?\n/)) {
    const nameMatch = line.match(/^-\s+name:\s*(.+)$/);
    const dblpMatch = line.match(/^\s+dblp:\s*(.+)$/);
    if (nameMatch) {
      if (current.name !== undefined && current.dblp) members.push(current);
      current = { name: nameMatch[1].trim() };
    } else if (dblpMatch) {
      current.dblp = dblpMatch[1].trim();
    }
  }
  if (current.name !== undefined && current.dblp) members.push(current);
  return members;
}

// ----- Fetch DBLP (SPARQL endpoint; the HTML/search API sits behind a bot check) -----
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fetchOnce(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'zkbricks-site-builder/1.0 (+https://zkbricks.com)', Accept: 'application/json' }, timeout: 30000 }, (res) => {
      let body = '';
      res.on('data', (ch) => (body += ch));
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          // DBLP sometimes serves an HTML bot-check page instead of JSON.
          reject(new Error('Non-JSON response (' + body.slice(0, 60).replace(/\s+/g, ' ') + '...)'));
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

async function fetch(url, attempts = 4) {
  for (let i = 1; ; i++) {
    try {
      return await fetchOnce(url);
    } catch (e) {
      if (i >= attempts) throw e;
      console.warn(`  attempt ${i} failed (${e.message}); retrying...`);
      await sleep(5000 * i);
    }
  }
}

const PEER_REVIEWED_TYPES = ['Inproceedings', 'Article'];

// One row per (publication, author signature, document page); grouped back into records below.
function publicationsQuery(pid) {
  return `PREFIX dblp: <https://dblp.org/rdf/schema#>
SELECT ?pub ?type ?title ?year ?venue ?primary ?page ?ord ?name WHERE {
  ?pub dblp:authoredBy <https://dblp.org/pid/${pid}> ;
       a ?type ; dblp:title ?title ; dblp:yearOfPublication ?year ; dblp:hasSignature ?sig .
  VALUES ?type { dblp:Inproceedings dblp:Article dblp:Informal }
  ?sig a dblp:AuthorSignature ; dblp:signatureOrdinal ?ord ; dblp:signatureDblpName ?name .
  OPTIONAL { ?pub dblp:publishedIn ?venue }
  OPTIONAL { ?pub dblp:primaryDocumentPage ?primary }
  OPTIONAL { ?pub dblp:documentPage ?page }
}`;
}

// Returns records shaped like the DBLP search API's `hit.info`, which the merge logic below expects.
async function fetchMemberPublications(pid) {
  const data = await fetch(`${SPARQL_ENDPOINT}?query=${encodeURIComponent(publicationsQuery(pid))}`);
  const byPub = new Map();
  for (const row of data.results.bindings) {
    const v = (k) => (row[k] ? row[k].value : '');
    let rec = byPub.get(v('pub'));
    if (!rec) {
      rec = { key: v('pub'), types: new Set(), title: v('title'), year: v('year'), venue: '', primary: new Set(), pages: new Set(), authors: new Map() };
      byPub.set(v('pub'), rec);
    }
    rec.types.add(v('type').replace(/^.*#/, ''));
    if (!rec.venue && v('venue')) rec.venue = v('venue');
    if (v('primary')) rec.primary.add(v('primary'));
    if (v('page')) rec.pages.add(v('page'));
    rec.authors.set(parseInt(v('ord'), 10), v('name'));
  }
  return [...byPub.values()].map((rec) => ({
    key: rec.key,
    info: {
      title: rec.title,
      year: rec.year,
      venue: rec.venue,
      peerReviewed: !rec.types.has('Informal') && PEER_REVIEWED_TYPES.some((t) => rec.types.has(t)),
      ee: [...new Set([...rec.primary, ...rec.pages])],
      authors: { author: [...rec.authors.keys()].sort((a, b) => a - b).map((k) => ({ text: rec.authors.get(k) })) }
    }
  }));
}

// ----- Presentation helpers (applied to every paper we write) -----
const VENUE_SHORT = {
  'SP': 'IEEE S&P',
  'USENIX Security Symposium': 'USENIX Security',
  'Proc. Priv. Enhancing Technol.': 'PETS',
  'Public Key Cryptography': 'PKC',
  'Financial Cryptography': 'FC',
  'Des. Codes Cryptogr.': 'DCC',
  'Electron. Colloquium Comput. Complex.': 'ECCC',
  'IACR Commun. Cryptol.': 'IACR CiC',
  'J. Cryptol.': 'J. Cryptology',
  'IACR Trans. Symmetric Cryptol.': 'ToSC',
  'IACR Cryptol. ePrint Arch.': 'IACR ePrint',
  'CoRR': 'arXiv'
};

const AREAS = {
  crypto: ['CRYPTO', 'EUROCRYPT', 'ASIACRYPT', 'TCC', 'PKC', 'J. Cryptology', 'IACR CiC', 'ToSC', 'SCN', 'INDOCRYPT', 'ITC', 'CHES', 'DCC', 'IACR ePrint'],
  security: ['IEEE S&P', 'USENIX Security', 'CCS', 'PETS', 'NDSS', 'EuroS&P', 'AFT', 'FC', 'ESORICS', 'ARES', 'HICSS'],
  theory: ['J. ACM', 'SIAM J. Comput.', 'Algorithmica', 'Commun. ACM', 'ITCS', 'ICALP', 'FOCS', 'STOC', 'SODA', 'ECCC', 'ISIT'],
  ml: ['NeurIPS', 'ALT', 'ICML', 'ICLR', 'arXiv']
};

function venueShort(venue) {
  // DBLP appends proceedings volumes, e.g. "CRYPTO (2)" or "TCC (B1)".
  const v = (venue || '').trim().replace(/\s*\([A-Z]?\d+\)$/, '');
  return VENUE_SHORT[v] || v;
}

function venueArea(short) {
  for (const area of Object.keys(AREAS)) {
    if (AREAS[area].includes(short)) return area;
  }
  return 'other';
}

// DBLP returns XML-escaped text (e.g. "O&apos;Neill"); store plain text and escape on output.
function decodeEntities(s) {
  return String(s || '')
    .replace(/&(amp;)+/g, '&')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(parseInt(n, 10)));
}

function cleanTitle(t) {
  return decodeEntities(t || 'Untitled').replace(/\.\s*$/, '').trim();
}

function authorsHtmlFromString(authors, teamNamesSet) {
  return String(authors || '').split(/\s*,\s*/).filter(Boolean).map((name) => {
    const esc = escapeHtml(name);
    return teamNamesSet.has(name.toLowerCase()) ? `<span class="is-team">${esc}</span>` : esc;
  }).join(', ');
}

function decorate(p, teamNamesSet) {
  const venue_short = venueShort(p.venue);
  return {
    title: cleanTitle(p.title),
    authors: decodeEntities(p.authors),
    authors_html: authorsHtmlFromString(decodeEntities(p.authors), teamNamesSet),
    venue: p.venue || '',
    venue_short,
    area: venueArea(venue_short),
    year: String(p.year || ''),
    url: p.url || '#'
  };
}

// Normalises papers and featured entries and recomputes the summary stats.
function finalize(papers, featured, teamNamesSet, members) {
  const outPapers = papers.map((p) => decorate(p, teamNamesSet));
  const seen = new Set();
  const outFeatured = [];
  featured.map((p) => decorate(p, teamNamesSet)).forEach((f) => {
    const key = titleNormalizeForMatch(f.title).replace(/[^\w ]/g, '');
    if (seen.has(key)) return;
    seen.add(key);
    outFeatured.push(f);
  });

  const count = (key) => {
    const m = {};
    outPapers.forEach((p) => { m[p[key]] = (m[p[key]] || 0) + 1; });
    return Object.keys(m).map((k) => ({ name: k, count: m[k] })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  };
  const years = outPapers.map((p) => parseInt(p.year, 10)).filter(Boolean);

  return {
    // Team members whose DBLP records are included; the Team page only shows paper counts for these.
    members,
    papers: outPapers,
    featured: outFeatured,
    venue_stats: count('venue_short'),
    area_stats: count('area'),
    total_papers: outPapers.length,
    first_year: years.length ? Math.min(...years) : null,
    last_year: years.length ? Math.max(...years) : null
  };
}

function paperId(h) {
  const title = ((h.info && h.info.title) || '').toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  const year = (h.info && h.info.year) || '';
  return year + '|' + title;
}

function hasEprintLink(h) {
  const ee = h.info && h.info.ee;
  if (!ee) return false;
  const u = Array.isArray(ee) ? (ee[0] && (ee[0].href || ee[0])) : (ee.href || ee);
  return typeof u === 'string' && (u.includes('eprint.iacr.org') || u.includes('arxiv.org'));
}

function getEprintUrl(h) {
  const ee = h.info && h.info.ee;
  if (!ee) return null;
  const u = Array.isArray(ee) ? (ee[0] && (ee[0].href || ee[0])) : (ee.href || ee);
  return typeof u === 'string' && (u.includes('eprint.iacr.org') || u.includes('arxiv.org')) ? u : null;
}

function titleNormalizeForMatch(t) {
  return (t || '').toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ');
}
function titleMatchesBabe(title) {
  const n = titleNormalizeForMatch(title);
  return n.includes('babe') || n.includes('batch attribute-based');
}

function getLinks(info) {
  if (!info) return { primary: '#' };
  let ee = info.ee;
  const url = info.url || '';
  const candidates = [];
  if (Array.isArray(ee)) {
    ee.forEach((e) => {
      const u = (e && e.href) ? e.href : (typeof e === 'string' ? e : null);
      if (u) candidates.push(u);
    });
  } else if (ee) {
    const u = (ee && ee.href) ? ee.href : (typeof ee === 'string' ? ee : null);
    if (u) candidates.push(u);
  }
  if (url) candidates.push(url);
  let raw = candidates[0] || '#';
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (typeof c !== 'string') continue;
    if (c.includes('eprint.iacr.org')) {
      raw = c.includes('.pdf') ? c : c.replace(/\/$/, '') + '.pdf';
      return { primary: raw };
    }
    if (c.includes('arxiv.org')) {
      raw = c.replace(/\/abs\//, '/pdf/');
      if (!raw.includes('.pdf')) raw += '.pdf';
      return { primary: raw };
    }
  }
  return { primary: raw };
}

function authorList(authors) {
  if (!authors || !authors.author) return '';
  const list = Array.isArray(authors.author) ? authors.author : [authors.author];
  return list.map((a) => {
    const t = (a && a.text) ? a.text : '';
    return t.replace(/\s*\d+\s*$/, '').trim();
  }).filter(Boolean).join(', ');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const featuredPatterns = ['BABE', 'B.A.B.E.', 'Mempool privacy', 'Mempool Privacy', 'hinTS', 'HinTS', 'Jigsaw', 'Doubly Private Smart Contracts', 'zkSaaS', 'Zero-Knowledge SNARKs as a Service', 'Batch Attribute-Based'];
function matchesFeatured(title) {
  if (!title) return false;
  const t = title.toLowerCase();
  const tn = titleNormalizeForMatch(title);
  return featuredPatterns.some((p) => t.includes(p.toLowerCase()) || tn.includes(p.toLowerCase().replace(/\./g, ''))) || titleMatchesBabe(title);
}

const eprintFeaturedStatic = [
  { title: 'BABE: Verifying Proofs on Bitcoin Made 1000x Cheaper', authors: 'Sanjam Garg, Dimitris Kolonelos, Mikhail Sergeevitch, Srivatsan Sridhar, David Tse', year: '2026', venue: 'IACR ePrint', url: 'https://eprint.iacr.org/2026/065.pdf' },
  { title: 'Bypassing Prompt Guards in Production with Controlled-Release Prompting', authors: 'Jaiden Fairoze, Sanjam Garg, Keewoo Lee, Mingyuan Wang', year: '2025', venue: 'arXiv', url: 'https://arxiv.org/pdf/2510.01529.pdf' }
];

async function main() {
  const teamYml = fs.readFileSync(TEAM_YML, 'utf8');
  const team = parseTeamYml(teamYml);
  const teamWithDblp = team.filter((m) => m.dblp);
  if (!teamWithDblp.length) {
    console.error('No team members with dblp in _data/team.yml');
    process.exit(1);
  }

  const teamNamesSet = new Set(teamWithDblp.map((m) => m.name.toLowerCase().trim()));

  // `--redecorate` re-applies the presentation helpers to the existing JSON without hitting DBLP.
  if (process.argv.includes('--redecorate')) {
    const existing = JSON.parse(fs.readFileSync(OUT_JSON, 'utf8'));
    const out = finalize(existing.papers || [], existing.featured || [], teamNamesSet, existing.members || []);
    fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2) + '\n', 'utf8');
    console.log('Redecorated', OUT_JSON, '| papers:', out.papers.length, '| featured:', out.featured.length);
    return;
  }

  const allHits = [];
  const seenPubs = new Set();
  const failures = [];
  for (const member of teamWithDblp) {
    try {
      const pubs = await fetchMemberPublications(member.dblp);
      if (!pubs.length) throw new Error('no publications returned');
      console.log(`  ${member.name} (${member.dblp}): ${pubs.filter((h) => h.info.peerReviewed).length} peer-reviewed of ${pubs.length} records`);
      // Co-authored papers come back once per team member; keep one copy.
      pubs.forEach((h) => { if (!seenPubs.has(h.key)) { seenPubs.add(h.key); allHits.push({ hit: h }); } });
    } catch (e) {
      console.warn('DBLP fetch failed for', member.name, `(${member.dblp})`, e.message);
      failures.push(member.name);
    }
    await sleep(1000);
  }

  // Never replace good data with a partial or empty result.
  if (failures.length || !allHits.length) {
    console.error(`Aborting: DBLP fetch failed for ${failures.join(', ') || 'all members'}. Keeping existing ${path.relative(ROOT, OUT_JSON)}.`);
    process.exit(1);
  }

  const byPaperId = {};
  allHits.forEach(({ hit: h }) => {
    const id = paperId(h);
    if (!byPaperId[id]) byPaperId[id] = [];
    byPaperId[id].push(h);
  });

  const merged = [];
  const eprintOnlyFeatured = [];
  for (const id of Object.keys(byPaperId)) {
    const group = byPaperId[id];
    let eprintHit = null;
    let conferenceHit = null;
    for (let i = 0; i < group.length; i++) {
      if (hasEprintLink(group[i])) eprintHit = group[i];
      if (group[i].info.peerReviewed) conferenceHit = group[i];
    }
    let chosen = conferenceHit || eprintHit || group[0];
    if (eprintHit && chosen !== eprintHit) {
      const eprintUrl = getEprintUrl(eprintHit);
      if (eprintUrl) {
        chosen = JSON.parse(JSON.stringify(chosen));
        if (!chosen.info) chosen.info = {};
        chosen.info.ee = eprintUrl;
      }
    }
    merged.push(chosen);
    if (!conferenceHit && eprintHit && titleMatchesBabe((eprintHit.info && eprintHit.info.title) || '')) eprintOnlyFeatured.push(eprintHit);
  }

  const filtered = merged.filter((h) => h.info.peerReviewed);
  filtered.sort((a, b) => {
    const y1 = (a.info && a.info.year) ? parseInt(a.info.year, 10) : 0;
    const y2 = (b.info && b.info.year) ? parseInt(b.info.year, 10) : 0;
    if (y2 !== y1) return y2 - y1;
    const t1 = (a.info && a.info.title) ? a.info.title : '';
    const t2 = (b.info && b.info.title) ? b.info.title : '';
    return t1.localeCompare(t2);
  });

  // Featured list
  const featured = [];
  eprintFeaturedStatic.forEach((p) => featured.push({ static: true, title: p.title, authors: p.authors, year: p.year, venue: p.venue, url: p.url }));
  filtered.forEach((h) => {
    if (matchesFeatured((h.info && h.info.title) || '')) featured.push(h);
  });
  eprintOnlyFeatured.forEach((h) => featured.push(h));
  if (featured.length === 0 && filtered.length) featured.push(filtered[0]);

  const toPaper = (h) => {
    if (h.static) return { title: h.title, authors: h.authors, venue: h.venue, year: h.year, url: h.url };
    const info = h.info || {};
    return { title: info.title, authors: authorList(info.authors), venue: info.venue || '', year: info.year || '', url: getLinks(info).primary };
  };

  const out = finalize(filtered.map(toPaper), featured.map(toPaper), teamNamesSet, teamWithDblp.map((m) => m.name));
  if (fs.existsSync(OUT_JSON)) {
    const previous = JSON.parse(fs.readFileSync(OUT_JSON, 'utf8')).total_papers || 0;
    if (out.total_papers < previous * MIN_RETAINED_SHARE) {
      console.error(`Aborting: only ${out.total_papers} papers versus ${previous} in the existing file. Keeping it.`);
      process.exit(1);
    }
  }
  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log('Wrote', OUT_JSON, '| papers:', out.papers.length, '| featured:', out.featured.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
