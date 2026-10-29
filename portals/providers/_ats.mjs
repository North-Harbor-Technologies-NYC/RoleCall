// ATS providers driven by an explicit `scan:` block in portals/scan-targets.yml.
// Each takes (entry, ctx) and returns [{ title, url, company, location, posted }].
// Keep every provider small and dumb: fetch, parse, normalize. No filtering here.

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
const browserHeaders = { 'user-agent': UA, accept: 'application/json, text/plain, */*', 'accept-language': 'en-US,en;q=0.9' };
const strip = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Workday: POST {host}/wday/cxs/{tenant}/{site}/jobs, 20 per page.
async function workday(entry, ctx) {
  const { host, tenant, site, searchText = '', maxPages = 60 } = entry.scan;
  const url = `https://${host}/wday/cxs/${tenant}/${site}/jobs`;
  const out = []; let offset = 0, total = Infinity;
  for (let page = 0; page < maxPages && offset < total; page++) {
    const json = await ctx.fetchJson(url, { method: 'POST', headers: { ...browserHeaders, 'content-type': 'application/json' }, body: JSON.stringify({ appliedFacets: {}, limit: 20, offset, searchText }), timeoutMs: 20000 });
    if (page === 0) total = json.total ?? 0; // later pages report total as 0
    for (const j of json.jobPostings || []) {
      out.push({ title: j.title || '', url: `https://${host}/${site}${j.externalPath || ''}`, company: entry.name, location: j.locationsText || '', posted: j.postedOn || '' });
    }
    offset += 20;
    if (!(json.jobPostings || []).length) break;
  }
  return out;
}

// SmartRecruiters public postings API.
async function smartrecruiters(entry, ctx) {
  const { company } = entry.scan; const out = []; let offset = 0, total = Infinity;
  while (offset < total && offset < 2000) {
    const json = await ctx.fetchJson(`https://api.smartrecruiters.com/v1/companies/${company}/postings?limit=100&offset=${offset}`, { headers: browserHeaders, timeoutMs: 20000 });
    total = json.totalFound ?? 0;
    for (const j of json.content || []) {
      const loc = [j.location?.city, j.location?.region, j.location?.country].filter(Boolean).join(', ');
      out.push({ title: j.name || '', url: `https://jobs.smartrecruiters.com/${company}/${j.id}`, company: entry.name, location: loc + (j.location?.remote ? ' (remote)' : ''), posted: (j.releasedDate || '').slice(0, 10) });
    }
    offset += 100; if (!(json.content || []).length) break;
  }
  return out;
}

// Eightfold (Netflix): GET {host}/api/apply/v2/jobs?domain=...&start=N&num=100&sort_by=new
async function eightfold(entry, ctx) {
  const { host, domain, pages = 5, num = 10 } = entry.scan; // the API serves 10 per page regardless of num
  const out = [];
  for (let p = 0; p < pages; p++) {
    const json = await ctx.fetchJson(`https://${host}/api/apply/v2/jobs?domain=${domain}&start=${p * num}&num=${num}&sort_by=new`, { headers: browserHeaders, timeoutMs: 20000 });
    const pos = json.positions || [];
    for (const j of pos) out.push({ title: j.name || '', url: j.canonicalPositionUrl || `https://${host}/careers/job/${j.id}`, company: entry.name, location: j.location || '', posted: j.t_create ? new Date(j.t_create * 1000).toISOString().slice(0, 10) : '' });
    if (pos.length < num) break; await sleep(800);
  }
  return out;
}

// Amazon Jobs: search.json per query, country=USA, sort=recent.
async function amazonjobs(entry, ctx) {
  const { queries = [''], limit = 100, pages = 2 } = entry.scan; const out = [];
  for (const q of queries) for (let p = 0; p < pages; p++) {
    const json = await ctx.fetchJson(`https://www.amazon.jobs/en/search.json?base_query=${encodeURIComponent(q)}&country=USA&sort=recent&result_limit=${limit}&offset=${p * limit}`, { headers: browserHeaders, timeoutMs: 20000 });
    const jobs = json.jobs || [];
    for (const j of jobs) out.push({ title: j.title || '', url: `https://www.amazon.jobs${j.job_path || ''}`, company: entry.name, location: j.normalized_location || j.location || '', posted: j.posted_date || '' , team: j.team || j.business_category || '' });
    if (jobs.length < limit) break; await sleep(400);
  }
  return out;
}

// Jibe (SiriusXM, Publicis): GET {host}/api/jobs?page=N&limit=100[&keywords=..&location=..]
async function jibe(entry, ctx) {
  const { host, maxPages = 12, query = '' } = entry.scan; const out = [];
  for (let p = 1; p <= maxPages; p++) {
    const json = await ctx.fetchJson(`https://${host}/api/jobs?page=${p}&limit=100${query}`, { headers: browserHeaders, timeoutMs: 20000 });
    const jobs = json.jobs || [];
    for (const w of jobs) {
      const j = w.data || w;
      const loc = j.full_location || [j.city, j.state, j.country].filter(Boolean).join(', ');
      out.push({ title: j.title || '', url: `https://${host}/jobs/${j.req_id || j.slug}${j.slug && j.slug !== j.req_id ? '/' + j.slug : ''}`, apply_url: j.apply_url || '', company: entry.name, location: loc, posted: (j.create_date || j.posted_date || '').slice(0, 10) });
    }
    if (jobs.length < 100) break;
  }
  return out;
}

// iCIMS: HTML search pages, 1-based pr= paging.
async function icims(entry, ctx) {
  const { host, maxPages = 12 } = entry.scan; const out = []; const seen = new Set();
  for (let p = 0; p < maxPages; p++) {
    const html = await ctx.fetchText(`https://${host}/jobs/search?ss=1&pr=${p}&in_iframe=1`, { headers: { ...browserHeaders, accept: 'text/html' }, timeoutMs: 20000 });
    const cards = html.split('class="iCIMS_JobCardItem"').slice(1); let found = 0;
    for (const c of cards) {
      const a = c.match(/href="(https:\/\/[^"]+\/jobs\/(\d+)\/[^"]+)"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/); if (!a) continue;
      if (seen.has(a[2])) continue; seen.add(a[2]); found++;
      const loc = strip((c.match(/Job Locations<\/span>\s*<span[^>]*>([\s\S]*?)<\/span>/) || [])[1] || '');
      const posted = strip((c.match(/Posted Date<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/) || [])[1] || '');
      out.push({ title: strip(a[3]), url: a[1].split('?')[0], company: entry.name, location: loc, posted });
    }
    if (!found) break;
  }
  return out;
}

// UKG Pro (UltiPro): POST LoadSearchResults.
async function ukgpro(entry, ctx) {
  const { company, board, top = 600 } = entry.scan;
  const base = `https://recruiting.ultipro.com/${company}/JobBoard/${board}`;
  const json = await ctx.fetchJson(`${base}/JobBoardView/LoadSearchResults`, { method: 'POST', headers: { ...browserHeaders, 'content-type': 'application/json' }, timeoutMs: 30000,
    body: JSON.stringify({ opportunitySearch: { Top: top, Skip: 0, QueryString: '', OrderBy: [{ Value: 'postedDateDesc', PropertyName: 'PostedDate', Ascending: false }], Filters: [] }, matchCriteria: { PreferredJobs: [], Educations: [], LicenseAndCertifications: [], Skills: [], hasNoLicenses: false, SkippedSkills: [] } }) });
  return (json.opportunities || []).map(j => ({ title: j.Title || '', url: `${base}/OpportunityDetail?opportunityId=${j.Id}`, company: entry.name, location: (j.Locations || []).map(l => l.LocalizedName || l.Address?.City).filter(Boolean).join('; '), posted: (j.PostedDate || '').slice(0, 10) }));
}

// Oracle HCM Cloud: REST recruitingCEJobRequisitions with keyword finder.
async function oraclehcm(entry, ctx) {
  const { host, site, keywords = [''], limit = 100 } = entry.scan; const out = []; const seen = new Set();
  for (const kw of keywords) {
    const finder = `findReqs;siteNumber=${site},keyword=${encodeURIComponent(kw)},limit=${limit},offset=0,sortBy=POSTING_DATES_DESC`;
    const json = await ctx.fetchJson(`https://${host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList&finder=${finder}`, { headers: browserHeaders, timeoutMs: 30000 });
    for (const j of json.items?.[0]?.requisitionList || []) {
      if (seen.has(j.Id)) continue; seen.add(j.Id);
      out.push({ title: j.Title || '', url: `https://${host}/hcmUI/CandidateExperience/en/sites/${site}/job/${j.Id}`, company: entry.name, location: j.PrimaryLocation || '', posted: (j.PostedDate || '').slice(0, 10) });
    }
  }
  return out;
}

// SAP SuccessFactors career sites (Paramount, Lionsgate): /search/?q=&startrow=N tiles of 25.
async function successfactors(entry, ctx) {
  const { host, maxPages = 20, q = '', pageSize = 25 } = entry.scan; const out = []; const seen = new Set();
  for (let p = 0; p < maxPages; p++) {
    const html = await ctx.fetchText(`https://${host}/search/?q=${encodeURIComponent(q)}&startrow=${p * pageSize}`, { headers: { ...browserHeaders, accept: 'text/html' }, timeoutMs: 20000 });
    const tiles = html.split(/data-row-index=/).slice(1); let found = 0;
    for (const t of tiles) {
      const a = t.match(/<a[^>]*class="jobTitle-link[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      if (!a) continue;
      const href = a[1].replace(/&amp;/g, '&');
      const url = href.startsWith('http') ? href : `https://${host}${href}`;
      if (seen.has(url)) continue; seen.add(url); found++;
      const loc = strip((t.match(/id="[^"]*-section-location-value"[^>]*>([\s\S]*?)<\/div>/) || [])[1] || '');
      const posted = strip((t.match(/id="[^"]*-section-date-value"[^>]*>([\s\S]*?)<\/div>/) || [])[1] || '');
      out.push({ title: strip(a[2]), url, company: entry.name, location: loc, posted });
    }
    if (!found) break;
  }
  return out;
}

// Disney careers: AJAX results endpoint returns an HTML fragment inside JSON.
async function disney(entry, ctx) {
  const { pages = 8, perPage = 100, keywords = '' } = entry.scan; const out = []; const seen = new Set();
  for (let p = 1; p <= pages; p++) {
    const url = `https://www.disneycareers.com/en/search-jobs/results?ActiveFacetID=0&CurrentPage=${p}&RecordsPerPage=${perPage}&Distance=50&RadiusUnitType=0&Keywords=${encodeURIComponent(keywords)}&Location=&ShowRadius=False&IsPagination=True&CustomFacetName=&FacetTerm=&FacetType=0&SearchResultsModuleName=Search+Results&SearchFiltersModuleName=Search+Filters&SortCriteria=5&SortDirection=1&SearchType=5&PostalCode=&ResultsType=0&fc=&fl=&fcf=&afc=&afl=&afcf=`;
    const json = await ctx.fetchJson(url, { headers: { ...browserHeaders, 'x-requested-with': 'XMLHttpRequest' }, timeoutMs: 20000 });
    const html = json.results || ''; let found = 0;
    const re = /<a[^>]+href="(\/en\/job\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g; let m;
    while ((m = re.exec(html))) {
      const url2 = `https://www.disneycareers.com${m[1]}`; if (seen.has(url2)) continue;
      const block = m[2];
      const title = strip((block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || [])[1] || '');
      if (!title) continue; seen.add(url2); found++;
      const loc = strip((block.match(/class="job-location"[^>]*>([\s\S]*?)<\/span>/) || [])[1] || '');
      const brand = strip((block.match(/class="job-brand"[^>]*>([\s\S]*?)<\/span>/) || [])[1] || '');
      const posted = strip((block.match(/class="job-date-posted"[^>]*>([\s\S]*?)<\/span>/) || [])[1] || '');
      out.push({ title, url: url2, company: brand ? `${entry.name} (${brand})` : entry.name, location: loc, posted });
    }
    if (!found) break; await sleep(300);
  }
  return out;
}

// Avature (Bloomberg): keyword-in-path search, server rendered.
async function avature(entry, ctx) {
  const { host, path = '/careers/SearchJobs', keywords = [''], perPage = 50 } = entry.scan; const out = []; const seen = new Set();
  for (const kw of keywords) {
    const html = await ctx.fetchText(`https://${host}${path}/${encodeURIComponent(kw)}?jobRecordsPerPage=${perPage}`, { headers: { ...browserHeaders, accept: 'text/html' }, timeoutMs: 20000 });
    const re = /<a class="link" href="(https?:\/\/[^"]+\/JobDetail\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g; let m;
    while ((m = re.exec(html))) {
      const url = m[1]; if (seen.has(url)) continue; seen.add(url);
      const after = html.slice(m.index, m.index + 1500);
      const loc = strip((after.match(/list-item-location"[^>]*>([\s\S]*?)<\/span>/) || [])[1] || '');
      out.push({ title: strip(m[2]), url, company: entry.name, location: loc, posted: '' });
    }
  }
  return out;
}

// Fox Corporation: JobsList fragment pages.
async function foxcareers(entry, ctx) {
  const { pages = 25, keyword = '' } = entry.scan; const out = []; const seen = new Set();
  for (let p = 1; p <= pages; p++) {
    const html = await ctx.fetchText(`https://www.foxcareers.com/Search/JobsList/?page=${p}&keyword=${encodeURIComponent(keyword)}`, { headers: { ...browserHeaders, accept: 'text/html' }, timeoutMs: 20000 });
    const blocks = html.split('class="jobListing"').slice(1); let found = 0;
    for (const b of blocks) {
      const a = b.match(/href="(\/Search\/JobDetail\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/); if (!a) continue;
      const url = `https://www.foxcareers.com${a[1].split('?')[0]}`; if (seen.has(url)) continue; seen.add(url); found++;
      const title = strip(a[2]).replace(/\s*\(R\d+\)\s*$/, '');
      const brand = strip((b.match(/searchResultBrand">([\s\S]*?)<\/p>/) || [])[1] || '');
      const loc = strip((b.match(/searchResultDetail">\s*<span>([\s\S]*?)<\/span>/) || [])[1] || '');
      const posted = strip((b.match(/Job Posting Date:\s*([^<]+)</) || [])[1] || '');
      out.push({ title, url, company: brand ? `${entry.name} (${brand})` : entry.name, location: loc, posted });
    }
    if (!found) break;
  }
  return out;
}

// Google careers: server-rendered results pages.
async function googlecareers(entry, ctx) {
  const { queries = [''], level = 'DIRECTOR_PLUS', pages = 3, companies = [] } = entry.scan; const out = []; const seen = new Set();
  const comp = companies.map(c => `&company=${encodeURIComponent(c)}`).join('');
  for (const q of queries) for (let p = 1; p <= pages; p++) {
    const html = await ctx.fetchText(`https://www.google.com/about/careers/applications/jobs/results?q=${encodeURIComponent(q)}&location=United%20States&target_level=${level}${comp}&page=${p}`, { headers: { ...browserHeaders, accept: 'text/html' }, timeoutMs: 20000 });
    // Each card ends with a "Learn more about <title>" link carrying the job path; the card body sits before it.
    const re = /href="(jobs\/results\/(\d+)-[^"?]+)[^"]*"\s+aria-label="Learn more about ([^"]+)"/g; let m, found = 0, last = 0;
    while ((m = re.exec(html))) {
      const card = html.slice(last, m.index); last = m.index;
      if (seen.has(m[2])) continue; seen.add(m[2]); found++;
      const locs = [...card.matchAll(/class="r0wTof[^"]*">([^<]+)<\/span>/g)].map(x => strip(x[1])).filter(Boolean);
      const co = strip((card.match(/corporate_fare<\/i><span>([^<]+)<\/span>/) || [])[1] || '');
      const loc = [...new Set(locs)].slice(0, 3).join(' ').replace(/^;\s*/, '');
      out.push({ title: strip(m[3]).replace(/&amp;/g, '&'), url: `https://www.google.com/about/careers/applications/${m[1]}`, company: co ? `${entry.name} (${co})` : entry.name, location: loc, posted: '' });
    }
    if (!found) break;
  }
  return out;
}

// Pinpoint (Brightcove under Bending Spoons): postings.json
async function pinpoint(entry, ctx) {
  const { host, filter = '' } = entry.scan;
  const json = await ctx.fetchJson(`https://${host}/postings.json`, { headers: browserHeaders, timeoutMs: 20000 });
  return (json.data || json.postings || json || []).filter(j => !filter || JSON.stringify(j).toLowerCase().includes(filter.toLowerCase())).map(j => ({ title: j.title || '', url: j.url || j.apply_url || '', company: entry.name, location: j.location?.name || j.location || '', posted: (j.created_at || '').slice(0, 10) }));
}

// Teamtailor (Backlight, Iconik): server-rendered /jobs page.
async function teamtailor(entry, ctx) {
  const { host } = entry.scan;
  const html = await ctx.fetchText(`https://${host}/jobs`, { headers: { ...browserHeaders, accept: 'text/html' }, timeoutMs: 20000 });
  const out = []; const seen = new Set();
  const re = /<a[^>]+href="(https:\/\/[^"]+\/jobs\/\d+-[^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<span[^>]*>([\s\S]*?)<\/span>\s*<\/div>/g; let m;
  while ((m = re.exec(html))) {
    if (seen.has(m[1])) continue; seen.add(m[1]);
    const meta = strip(m[3]).split(/\s*·\s*|\s*&middot;\s*/).map(x => x.trim()).filter(Boolean);
    out.push({ title: strip(m[2]), url: m[1], company: entry.name, location: meta.slice(1).join(', '), posted: '' });
  }
  return out;
}

// ADP Workforce Now recruitment (Anonymous Content): public JSON.
async function adp(entry, ctx) {
  const { cid, ccId = '', lang = 'en_US' } = entry.scan;
  const json = await ctx.fetchJson(`https://workforcenow.adp.com/mascsr/default/careercenter/public/events/staffing/v1/job-requisitions?cid=${cid}${ccId ? `&ccId=${ccId}` : ''}&lang=${lang}&$top=200&$skip=0`, { headers: browserHeaders, timeoutMs: 20000 });
  return (json.jobRequisitions || []).map(j => ({ title: j.requisitionTitle || '', url: `https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=${cid}${ccId ? `&ccId=${ccId}` : ''}&lang=${lang}&selectedMenuKey=CurrentOpenings&jobId=${j.itemID || j.customFieldGroup?.stringFields?.[0]?.stringValue || ''}`, company: entry.name, location: (j.requisitionLocations || []).map(l => l.nameCode?.shortName).filter(Boolean).join('; '), posted: (j.postDate || '').slice(0, 10) }));
}

// Accenture findjobs API (multipart POST).
async function accenture(entry, ctx) {
  const { queries = ['media'], max = 100 } = entry.scan; const out = []; const seen = new Set();
  for (const q of queries) {
    const fd = new FormData();
    fd.append('startIndex', '0'); fd.append('maxResultSize', String(max)); fd.append('jobKeyword', q); fd.append('jobCountry', 'USA'); fd.append('jobLanguage', 'en'); fd.append('countrySite', 'us-en'); fd.append('vectorSearch', 'true'); fd.append('sortBy', '1');
    const json = await ctx.fetchJson('https://www.accenture.com/api/accenture/elastic/findjobs', { method: 'POST', headers: { 'user-agent': UA, accept: 'application/json' }, body: fd, timeoutMs: 30000 });
    for (const j of json.data || []) {
      const id = j.requisitionId || j.jobId; if (!id || seen.has(id)) continue; seen.add(id);
      out.push({ title: j.title || '', url: `https://www.accenture.com/us-en/careers/jobdetails?id=${encodeURIComponent(id)}_en`, company: entry.name, location: Array.isArray(j.location) ? j.location.join('; ') : (j.location || ''), posted: j.postedDateText || '', level: j.careerLevel || '' });
    }
  }
  return out;
}

export const ATS = { workday, smartrecruiters, eightfold, amazonjobs, jibe, icims, ukgpro, oraclehcm, successfactors, disney, avature, foxcareers, googlecareers, pinpoint, teamtailor, adp, accenture };
