const https = require('https');
const { Resolver } = require('dns');

function testSiteWithDns(dns, website) {
  return new Promise(async (resolve) => {
    // Clean up website input
    const cleanSite = website.replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    // First, try to resolve the site using the specified DNS
    const resolver = new Resolver();
    resolver.setServers([dns]);
    
    let ip;
    try {
      ip = await new Promise((res, rej) => {
        resolver.resolve4(cleanSite, (err, addresses) => {
          if (err) rej(err);
          else res(addresses[0]);
        });
      });
    } catch (e) {
      return resolve({
        ok: false,
        error: `DNS resolution failed with ${dns}`,
        detail: `Could not resolve ${cleanSite} - ${e.code || e.message}`
      });
    }
    
    // Now try to connect via HTTPS
    const req = https.request({
      host: ip,
      servername: cleanSite,
      method: 'GET',
      path: '/',
      headers: { Host: cleanSite },
      timeout: 5000
    }, (res) => {
      const ok = res.statusCode && res.statusCode < 400;
      res.resume();
      resolve({
        ok,
        detail: `DNS: ${dns} → IP: ${ip} → HTTP ${res.statusCode}`
      });
    });
    
    req.on('error', (err) => {
      resolve({
        ok: false,
        error: `Connection failed`,
        detail: `Resolved to ${ip} but HTTP failed: ${err.code || err.message}`
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({
        ok: false,
        error: 'Connection timeout',
        detail: `Resolved to ${ip} but connection timed out after 5s`
      });
    });
    
    req.end();
  });
}

module.exports = { testSiteWithDns };
