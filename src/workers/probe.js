// Worker-style script: when run directly, it expects JSON via process.stdin or process.send messages.
// It measures ping, jitter, packet loss via OS ping, and short download/upload throughput.

const os = require('os');
const { Resolver } = require('dns');
const { spawn } = require('child_process');
const https = require('https');

function parsePing(output, platform) {
  const lines = output.split(/\r?\n/).filter(Boolean);
  const times = [];
  let sent = 0, received = 0;

  if (platform === 'win32') {
    for (const line of lines) {
      const m = line.match(/time[=<]([0-9]+)ms/i);
      if (m) times.push(Number(m[1]));
      const p = line.match(/Packets: Sent = (\d+), Received = (\d+), Lost = (\d+)/i);
      if (p) { sent = Number(p[1]); received = Number(p[2]); }
    }
  } else {
    for (const line of lines) {
      const m = line.match(/time[=<]([0-9.]+) ?ms/i);
      if (m) times.push(Number(m[1]));
      const p = line.match(/(\d+) packets transmitted, (\d+) (?:packets )?received/i);
      if (p) { sent = Number(p[1]); received = Number(p[2]); }
    }
  }

  const lossPct = sent > 0 ? Math.max(0, Math.min(100, ((sent - received) / sent) * 100)) : 100;
  const pingAvgMs = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null;
  let jitterMs = null;
  if (times.length > 1) {
    let sum = 0; for (let i = 1; i < times.length; i++) sum += Math.abs(times[i] - times[i - 1]);
    jitterMs = Math.round(sum / (times.length - 1));
  }
  return { pingAvgMs, jitterMs, lossPct: Math.round(lossPct) };
}

function pingHost(host, count, timeoutMs) {
  return new Promise((resolve) => {
    const platform = os.platform();
    const args = platform === 'win32'
      ? ['-n', String(count), '-w', String(timeoutMs), host]
      : ['-c', String(count), platform === 'darwin' ? '-W' : '-W', platform === 'darwin' ? String(Math.ceil(timeoutMs)) : String(Math.ceil(timeoutMs / 1000)), host];
    const cmd = 'ping';
    const proc = spawn(cmd, args, { windowsHide: true });
    let out = '';
    proc.stdout.on('data', d => out += d.toString());
    proc.stderr.on('data', d => out += d.toString());
    proc.on('close', () => resolve(parsePing(out, platform)));
    proc.on('error', () => resolve({ pingAvgMs: null, jitterMs: null, lossPct: 100 }));
  });
}

function resolveWith(server, hostname) {
  return new Promise((resolve, reject) => {
    const r = new Resolver();
    r.setServers([server]);
    r.resolve4(hostname, (err, addresses) => {
      if (err) reject(err); else resolve(addresses[0]);
    });
  });
}

function downloadThroughput({ ip, host, path, bytes, servername }) {
  return new Promise((resolve) => {
    const start = Date.now();
    let received = 0;
    const req = https.request({
      host: ip,
      servername, // SNI
      method: 'GET',
      path: `${path}?bytes=${bytes}`,
      headers: { Host: host }
    }, (res) => {
      res.on('data', chunk => { received += chunk.length; });
      res.on('end', () => {
        const dt = (Date.now() - start) / 1000;
        const mbps = dt > 0 ? (received * 8 / 1e6) / dt : 0;
        resolve({ mbps: Number(mbps.toFixed(2)) });
      });
    });
    req.on('error', () => resolve({ mbps: 0 }));
    req.end();
  });
}

function uploadThroughput({ ip, host, path, bytes, servername }) {
  return new Promise((resolve) => {
    const payload = Buffer.alloc(bytes, 1);
    const start = Date.now();
    const req = https.request({
      host: ip,
      servername,
      method: 'POST',
      path,
      headers: {
        Host: host,
        'Content-Type': 'application/octet-stream',
        'Content-Length': payload.length
      }
    }, (res) => {
      res.resume();
      res.on('end', () => {
        const dt = (Date.now() - start) / 1000;
        const mbps = dt > 0 ? (payload.length * 8 / 1e6) / dt : 0;
        resolve({ mbps: Number(mbps.toFixed(2)) });
      });
    });
    req.on('error', () => resolve({ mbps: 0 }));
    req.write(payload);
    req.end();
  });
}

function computeScore(metrics, weights) {
  // Normalize some values to keep scores sane
  const latency = metrics.pingAvgMs ?? 500;
  const jitter = metrics.jitterMs ?? 200;
  const loss = metrics.lossPct ?? 100;
  const down = metrics.throughputDownMbps ?? 0;
  const up = metrics.throughputUpMbps ?? 0;
  return (
    weights.latency * latency +
    weights.loss * loss +
    weights.jitter * jitter -
    weights.throughputDown * down -
    weights.throughputUp * up
  );
}

async function testProvider(provider, opts, throughputCfg) {
  const host = throughputCfg.host;
  const downloadPath = throughputCfg.downloadPath;
  const uploadPath = throughputCfg.uploadPath;

  const primary = provider.servers[0];
  const targetDns = primary;
  const pingStats = await pingHost(targetDns, opts.pingCount, opts.pingTimeoutMs);

  let ip;
  try {
    ip = await resolveWith(targetDns, host);
  } catch (e) {
    // DNS failed for throughput host — set metrics to zero
  }

  let down = { mbps: 0 }, up = { mbps: 0 };
  if (ip) {
    down = await downloadThroughput({ ip, host, path: downloadPath, bytes: opts.downloadBytes, servername: host });
    // Upload is best-effort; if it fails, it returns 0
    up = await uploadThroughput({ ip, host, path: uploadPath, bytes: opts.uploadBytes, servername: host });
  }

  const metrics = {
    ...pingStats,
    throughputDownMbps: down.mbps,
    throughputUpMbps: up.mbps
  };

  return metrics;
}

async function runAll(providers, mode, config) {
  const opts = mode === 'quick' ? config.quick : config.full;
  const weights = config.weights;
  const throughputCfg = config.throughput;

  const results = [];
  let idx = 0;
  const conc = Math.min(config.concurrency || 3, providers.length || 1);

  async function worker() {
    while (true) {
      const myIdx = idx++;
      if (myIdx >= providers.length) break;
      const provider = providers[myIdx];
      try {
        const metrics = await testProvider(provider, opts, throughputCfg);
        const score = computeScore(metrics, weights);
        results.push({ provider, metrics, score });
        if (process.send) process.send({ type: 'progress', index: myIdx, total: providers.length, provider: provider.name });
      } catch (e) {
        results.push({ provider, metrics: { pingAvgMs: null, jitterMs: null, lossPct: 100, throughputDownMbps: 0, throughputUpMbps: 0 }, score: Number.POSITIVE_INFINITY });
      }
    }
  }

  const workers = Array.from({ length: conc }, () => worker());
  await Promise.all(workers);
  results.sort((a, b) => a.score - b.score);
  return results;
}

if (require.main === module) {
  // Allow being run as a forked process, receiving a single message with { providers, mode, config }
  process.on('message', async (msg) => {
    if (!msg || msg.type !== 'run') return;
    const { providers, mode, config } = msg;
    const results = await runAll(providers, mode, config);
    if (process.send) process.send({ type: 'done', results });
  });
}

module.exports = { runAll };
