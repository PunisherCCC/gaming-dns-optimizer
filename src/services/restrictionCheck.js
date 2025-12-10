const https = require('https');
const { Resolver } = require('dns');

function fetchHead(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'GET' }, (res) => {
      // success for 2xx/3xx
      const ok = res.statusCode && res.statusCode < 400;
      res.resume();
      resolve({ ok, statusCode: res.statusCode });
    });
    req.on('error', (err) => resolve({ ok: false, error: String(err && err.code || err) }));
    req.setTimeout(timeoutMs, () => { req.destroy(new Error('ETIMEDOUT')); });
    req.end();
  });
}

async function checkSite(site) {
  // Try HTTPS
  const url = /^https?:\/\//i.test(site) ? site : `https://${site}`;
  const res = await fetchHead(url, 6000);
  if (res.ok) return { site, status: 'OK', detail: `HTTP ${res.statusCode}` };
  // Try DNS resolve as a hint
  try {
    const resolver = new Resolver();
    const t0 = Date.now();
    await new Promise((resolve, reject) => {
      resolver.resolve4(site, (err) => err ? reject(err) : resolve());
    });
    const dt = Date.now() - t0;
    return { site, status: 'Maybe blocked', detail: `HTTP failed (${res.error || res.statusCode}), DNS ok in ${dt}ms` };
  } catch (e) {
    return { site, status: 'Likely blocked', detail: `HTTP failed (${res.error || res.statusCode}), DNS failed (${e.code || e.message})` };
  }
}

async function checkSites(sites) {
  const results = [];
  for (const s of sites) {
    try {
      const r = await checkSite(s);
      results.push(r);
    } catch (e) {
      results.push({ site: s, status: 'Error', detail: String(e.message || e) });
    }
  }
  return results;
}

module.exports = { checkSites };
