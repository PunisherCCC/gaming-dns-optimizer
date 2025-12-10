const statusEl = document.getElementById('status');
const btnQuick = document.getElementById('btn-quick');
const btnFull = document.getElementById('btn-full');
const btnApplyTop = document.getElementById('btn-apply-top');
const btnRevert = document.getElementById('btn-revert');
const btnFlush = document.getElementById('btn-flush');
const testCountInput = document.getElementById('test-count');
const resultsBody = document.querySelector('#results tbody');
const sitesBody = document.querySelector('#sites tbody');
const btnCheckSites = document.getElementById('btn-check-sites');
const themeToggle = document.getElementById('theme-toggle');

let lastResults = [];

// Dark mode toggle
const savedTheme = localStorage.getItem('theme') || 'light';
if (savedTheme === 'dark') {
  document.body.classList.add('dark-mode');
}

themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

function fmtServers(p) {
  const s = p.servers || [];
  return s.join(', ');
}

function renderResults(results) {
  resultsBody.innerHTML = '';
  results.forEach((r, idx) => {
    const tr = document.createElement('tr');

    const btn = document.createElement('button');
    btn.textContent = 'Apply';
    btn.onclick = async () => {
      setStatus(`Applying DNS ${r.provider.name} ...`);
      btn.disabled = true;
      const ok = await window.api.applyDnsCross({ servers: r.provider.servers });
      btn.disabled = false;
      setStatus(ok.ok ? `Applied DNS: ${r.provider.name}` : `Failed to apply DNS: ${ok.error || 'unknown error'}`);
    };

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${r.provider.name}</td>
      <td>${fmtServers(r.provider)}</td>
      <td>${r.metrics.pingAvgMs ?? '-'}</td>
      <td>${r.metrics.jitterMs ?? '-'}</td>
      <td>${r.metrics.lossPct ?? '-'}</td>
      <td>${r.metrics.throughputDownMbps ?? '-'}</td>
      <td>${r.metrics.throughputUpMbps ?? '-'}</td>
      <td>${Number.isFinite(r.score) ? r.score.toFixed(2) : '∞'}</td>
      <td></td>
    `;
    tr.children[9 - 1].appendChild(btn);

    resultsBody.appendChild(tr);
  });

  btnApplyTop.disabled = results.length === 0;
}

function setStatus(msg) {
  statusEl.textContent = msg || '';
}

async function runLegacy() {
  // Keep legacy ping test support for users who want a quick check without throughput
  setStatus('Running legacy ping benchmark...');
  const providers = await window.api.listProviders();
  const count = Math.max(3, Math.min(20, Number(testCountInput.value) || 8));
  const results = await window.api.runTests({ count });
  lastResults = results;
  renderResults(results.map(r => ({ ...r, metrics: { ...r.metrics, throughputDownMbps: '-', throughputUpMbps: '-' } })));
  setStatus('Done (legacy).');
}

async function runScan(mode) {
  setStatus(mode === 'full' ? 'Running full scan… this may take ~1–2 minutes.' : 'Running quick scan…');
  btnQuick.disabled = true; btnFull.disabled = true;
  resultsBody.innerHTML = '<tr><td colspan="10">Scanning...</td></tr>';
  const results = await window.api.runScan(mode);
  lastResults = results;
  renderResults(results);
  setStatus('Done. Sorted by best score (lower is better).');
  btnQuick.disabled = false; btnFull.disabled = false;
}

btnQuick.addEventListener('click', () => runScan('quick'));
btnFull.addEventListener('click', () => runScan('full'));

btnApplyTop.addEventListener('click', async () => {
  if (!lastResults.length) return;
  const top = lastResults[0];
  setStatus(`Applying DNS ${top.provider.name} ...`);
  btnApplyTop.disabled = true;
  const ok = await window.api.applyDnsCross({ servers: top.provider.servers });
  btnApplyTop.disabled = false;
  setStatus(ok.ok ? `Applied DNS: ${top.provider.name}` : `Failed to apply DNS: ${ok.error || 'unknown error'}`);
});

btnRevert.addEventListener('click', async () => {
  setStatus('Reverting DNS to previous settings...');
  const res = await window.api.revertDns();
  setStatus(res.ok ? 'Reverted DNS to previous settings' : `Failed to revert: ${res.error || 'unknown error'}`);
});

btnFlush.addEventListener('click', async () => {
  setStatus('Flushing DNS cache...');
  btnFlush.disabled = true;
  const res = await window.api.flushDns();
  btnFlush.disabled = false;
  setStatus(res.ok ? 'DNS cache flushed successfully' : `Failed to flush DNS: ${res.error || 'unknown error'}`);
});

// DNS-specific website test
const testDnsInput = document.getElementById('test-dns');
const testWebsiteInput = document.getElementById('test-website');
const btnTestDnsSite = document.getElementById('btn-test-dns-site');
const dnsTestResult = document.getElementById('dns-test-result');

btnTestDnsSite.addEventListener('click', async () => {
  const dns = testDnsInput.value.trim();
  const website = testWebsiteInput.value.trim();
  
  if (!dns || !website) {
    dnsTestResult.innerHTML = '<p style="color: #ef4444; font-weight: 600;">Please enter both DNS server and website.</p>';
    return;
  }
  
  dnsTestResult.innerHTML = '<p style="color: rgba(255,255,255,0.9); font-weight: 600;">Testing access...</p>';
  
  const result = await window.api.testSiteWithDns({ dns, website });
  
  if (result.ok) {
    dnsTestResult.innerHTML = `
      <div style="background: rgba(16, 185, 129, 0.2); padding: 12px; border-radius: 10px; margin-top: 10px;">
        <p style="color: #10b981; font-weight: 700; margin: 0 0 6px 0;">✓ Accessible with ${dns}</p>
        <p style="color: rgba(0,0,0,0.7); font-size: 12px; margin: 0;">${result.detail || ''}</p>
      </div>
    `;
  } else {
    dnsTestResult.innerHTML = `
      <div style="background: rgba(239, 68, 68, 0.2); padding: 12px; border-radius: 10px; margin-top: 10px;">
        <p style="color: #ef4444; font-weight: 700; margin: 0 0 6px 0;">✗ Not accessible with ${dns}</p>
        <p style="color: rgba(0,0,0,0.7); font-size: 12px; margin: 0;">${result.error || result.detail || 'Failed to resolve or connect'}</p>
      </div>
    `;
  }
});

btnCheckSites.addEventListener('click', async () => {
  const sites = await window.api.listSites();
  if (!sites || sites.length === 0) {
    sitesBody.innerHTML = '<tr><td colspan="3">No sites configured</td></tr>';
    return;
  }
  sitesBody.innerHTML = '<tr><td colspan="3">Checking...</td></tr>';
  const res = await window.api.testSites(sites);
  sitesBody.innerHTML = '';
  res.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.site}</td><td>${r.status}</td><td>${r.detail || ''}</td>`;
    tr.className = r.status === 'OK' ? 'ok' : 'blocked';
    sitesBody.appendChild(tr);
  });
});

// Show loading screen, then hide it without auto-starting scan
const loadingScreen = document.getElementById('loading-screen');

// Hide loading screen after 2 seconds
setTimeout(() => {
  loadingScreen.classList.add('hidden');
}, 2000);
