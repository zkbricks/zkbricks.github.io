#!/usr/bin/env node
/**
 * Fetches DBLP publication data for team members and writes _data/dblp_research.json.
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
const PAPERS_PER_AUTHOR = 1000;

// ----- Parse team.yml (no YAML dep) -----
function parseTeamYml(content) {
  const members = [];
  let current = {};
  for (const line of content.split('\n')) {
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

// ----- Fetch DBLP API -----
function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', (ch) => (body += ch));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function isEprintOrArchive(venue) {
  if (!venue) return false;
  const v = venue.toLowerCase();
  return v.includes('eprint') || v.includes('corr') || v.includes('res. repos') || v.includes('comput. res. repos');
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

const forceOtherVenues = ['Privacy Enhancing Technologies', 'Proc. Priv. Enhancing Technol.', 'ISIT', 'ASIACRYPT', 'Asiacrypt', 'Public Key Cryptography', 'INDOCRYPT', 'INCOCRYPT', 'SCN'];
function isForceOther(venue) {
  if (!venue) return true;
  const v = venue.toLowerCase();
  return forceOtherVenues.some((name) => v.includes(name.toLowerCase()));
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

function getAuthorHtml(authors, teamNamesSet) {
  if (!authors || !authors.author) return '';
  const list = Array.isArray(authors.author) ? authors.author : [authors.author];
  return list.map((a) => {
    const rawName = (a && a.text) ? a.text : '';
    const cleanName = rawName.replace(/\s*\d+\s*$/, '').trim();
    if (!cleanName) return '';
    const isTeam = teamNamesSet.has(cleanName.toLowerCase());
    const esc = escapeHtml(cleanName);
    return isTeam ? `<span class="text-body-emphasis">${esc}</span>` : `<span class="text-body-secondary opacity-75">${esc}</span>`;
  }).filter(Boolean).join(', ');
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

  const allHits = [];
  for (const member of teamWithDblp) {
    const url = `https://dblp.org/search/publ/api?q=author:${encodeURIComponent(member.dblp)}:&format=json&h=${PAPERS_PER_AUTHOR}`;
    try {
      const data = await fetch(url);
      if (data && data.result && data.result.hits && data.result.hits.hit) {
        const hits = data.result.hits.hit;
        const arr = Array.isArray(hits) ? hits : [hits];
        arr.forEach((h) => allHits.push({ hit: h }));
      }
    } catch (e) {
      console.warn('DBLP fetch failed for', member.dblp, e.message);
    }
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
      if (!isEprintOrArchive((group[i].info && group[i].info.venue) ? group[i].info.venue : '')) conferenceHit = group[i];
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

  const filtered = merged.filter((h) => !isEprintOrArchive((h.info && h.info.venue) ? h.info.venue : ''));
  filtered.sort((a, b) => {
    const y1 = (a.info && a.info.year) ? parseInt(a.info.year, 10) : 0;
    const y2 = (b.info && b.info.year) ? parseInt(b.info.year, 10) : 0;
    if (y2 !== y1) return y2 - y1;
    const t1 = (a.info && a.info.title) ? a.info.title : '';
    const t2 = (b.info && b.info.title) ? b.info.title : '';
    return t1.localeCompare(t2);
  });

  // Venue stats for pie
  const byVenue = {};
  filtered.forEach((h) => {
    let venue = (h.info && h.info.venue) ? h.info.venue.trim() : 'Other';
    if (!venue) venue = 'Other';
    byVenue[venue] = (byVenue[venue] || 0) + 1;
  });
  const minCount = 3;
  const main = [];
  let otherCount = 0;
  Object.keys(byVenue).forEach((v) => {
    const count = byVenue[v];
    if (isForceOther(v)) otherCount += count;
    else if (count >= minCount) main.push({ venue: v, count }); else otherCount += count;
  });
  main.sort((a, b) => b.count - a.count);
  if (otherCount > 0) main.push({ venue: 'Other', count: otherCount });
  const venueStats = main;

  // Featured list
  const featured = [];
  eprintFeaturedStatic.forEach((p) => featured.push({ static: true, title: p.title, authors: p.authors, year: p.year, venue: p.venue, url: p.url }));
  filtered.forEach((h) => {
    if (matchesFeatured((h.info && h.info.title) || '')) featured.push(h);
  });
  eprintOnlyFeatured.forEach((h) => featured.push(h));
  if (featured.length === 0 && filtered.length) featured.push(filtered[0]);

  // Output papers for list (with authors_html)
  const papers = filtered.map((h) => {
    const info = h.info || {};
    const links = getLinks(info);
    return {
      title: info.title || 'Untitled',
      authors: authorList(info.authors),
      authors_html: getAuthorHtml(info.authors, teamNamesSet),
      venue: info.venue || '',
      year: info.year || '',
      url: links.primary
    };
  });

  // Output featured for cards (with authors_html where applicable)
  const featuredOut = featured.map((f) => {
    if (f.static) {
      return {
        title: f.title || 'Untitled',
        authors: f.authors || '',
        authors_html: null,
        venue: f.venue || '',
        year: f.year || '',
        url: f.url || '#'
      };
    }
    const info = f.info || {};
    const links = getLinks(info);
    return {
      title: info.title || 'Untitled',
      authors: authorList(info.authors),
      authors_html: getAuthorHtml(info.authors, teamNamesSet),
      venue: info.venue || '',
      year: info.year || '',
      url: links.primary
    };
  });

  const totalPapers = filtered.length;
  const palette = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#64748b', '#84cc16', '#f43f5e', '#0ea5e9'];
  let cum = 0;
  const pie_segments = venueStats.map((e, i) => {
    const pct = totalPapers > 0 ? (e.count / totalPapers * 100) : 0;
    const seg = { venue: e.venue, count: e.count, start_pct: cum, end_pct: cum + pct, color: palette[i % palette.length] };
    cum += pct;
    return seg;
  });

  const out = { papers, venue_stats: venueStats, pie_segments, total_papers: totalPapers, featured: featuredOut };
  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2), 'utf8');
  console.log('Wrote', OUT_JSON, '| papers:', papers.length, '| featured:', featuredOut.length, '| venue segments:', venueStats.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
