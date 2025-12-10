const { Resolver } = require('dns');
const { spawn } = require('child_process');

const DEFAULT_TEST_DOMAINS = [
  'www.google.com',
  'www.cloudflare.com',
  'store.steampowered.com',
  'api.steampowered.com',
  'steamcommunity.com',
  'www.nvidia.com',
  'developer.nvidia.com',
  'www.ea.com',
  'www.ubisoft.com',
  'www.playstation.com',
  'www.xbox.com',
  'www.riotgames.com',
  'www.epicgames.com',
  'www.battle.net'
];

function parsePingWindows(output) {
  const lines = output.split(/\r?\n/).filter(Boolean);
  const times = [];
  let sent = 0, received = 0, lost = 0;
  for (const line of lines) {
    const m = line.match(/time[=<]([0-9]+)ms/i);
    if (m) times.push(Number(m[1]));
    const p = line.match(/Packets: Sent = (\d+), Received = (\d+), Lost = (\d+)/i);
    if (p) { sent = Number(p[1]); received = Number(p[2]); lost = Number(p[3]); }
  }
  // Compute stats
  const lossPct = sent > 0 ? Math.max(0, Math.min(100, ((sent - received) / sent) * 100)) : 100;
  const pingAvgMs = times.length ? Math.round(times.reduce((a,b)=>a+b,0)/times.length) : null;
  // Jitter as mean absolute deviation between consecutive pings
  let jitterMs = null;
  if (times.length > 1) {
    let sum = 0;
    for (let i=1;i<times.length;i++) sum += Math.abs(times[i]-times[i-1]);
    jitterMs = Math.round(sum / (times.length - 1));
  }
  return { pingAvgMs, jitterMs, lossPct: Math.round(lossPct) };
}

function pingHost(host, count = 8, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const args = ['-n', String(count), '-w', String(timeoutMs), host];
    const proc = spawn('ping', args, { windowsHide: true });
    let out = '';
    proc.stdout.on('data', d => out += d.toString());
    proc.stderr.on('data', d => out += d.toString());
    proc.on('close', () => {
      const stats = parsePingWindows(out);
      resolve(stats);
    });
    proc.on('error', () => resolve({ pingAvgMs: null, jitterMs: null, lossPct: 100 }));
  });
}

async function measureResolve(server, count = 3) {
  const resolver = new Resolver();
  resolver.setServers([server]);
  let total = 0;
  let success = 0;
  for (let i = 0; i < count; i++) {
    const domain = DEFAULT_TEST_DOMAINS[i % DEFAULT_TEST_DOMAINS.length];
    const t0 = Date.now();
    try {
      await new Promise((resolve, reject) => {
        resolver.resolve4(domain, (err) => err ? reject(err) : resolve());
      });
      total += (Date.now() - t0);
      success++;
    } catch (e) {
      // ignore
    }
  }
  if (!success) return null;
  return Math.round(total / success);
}

function computeScore(metrics) {
  // Weighted sum: lower is better
  const wPing = 0.5, wJitter = 0.3, wLoss = 1.0, wResolve = 0.6;
  const ping = metrics.pingAvgMs ?? 500;
  const jitter = metrics.jitterMs ?? 200;
  const loss = metrics.lossPct ?? 100;
  const resolve = metrics.resolveMs ?? 800;
  return wPing * ping + wJitter * jitter + wLoss * loss + wResolve * resolve;
}

async function testProvider(provider, options = {}) {
  const count = Math.max(3, Math.min(20, Number(options.count) || 8));
  const primary = provider.servers[0];
  const secondary = provider.servers[1];

  const pingStats = await pingHost(primary, count, 1000);
  let resolveMs = await measureResolve(primary, Math.min(5, Math.max(3, Math.round(count/2))));
  // If primary resolve fails entirely, try secondary
  if (resolveMs == null && secondary) {
    resolveMs = await measureResolve(secondary, Math.min(5, Math.max(3, Math.round(count/2))));
  }

  const metrics = { ...pingStats, resolveMs };
  const score = computeScore(metrics);

  return { provider, metrics, score };
}

async function testAll(providers, options = {}) {
  const results = [];
  const concurrency = 3;
  let idx = 0;

  async function worker() {
    while (idx < providers.length) {
      const current = providers[idx++];
      try {
        const r = await testProvider(current, options);
        results.push(r);
      } catch (e) {
        results.push({ provider: current, metrics: { pingAvgMs: null, jitterMs: null, lossPct: 100, resolveMs: null }, score: Number.POSITIVE_INFINITY });
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, providers.length) }, () => worker());
  await Promise.all(workers);
  results.sort((a, b) => a.score - b.score);
  return results;
}

module.exports = { testAll };
