const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');

// Legacy services (kept for backward compatibility with current UI)
const dnsTester = require('./services/dnsTester');
const restrictionCheck = require('./services/restrictionCheck');
const storage = require('./services/storage');

// Platform modules
let platformMod;
if (process.platform === 'win32') platformMod = require('../lib/platform/windows');
else if (process.platform === 'darwin') platformMod = require('../lib/platform/macos');
else platformMod = require('../lib/platform/linux');

const configPath = path.join(__dirname, 'config.json');
function readConfig() {
  try { return JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch { return { weights:{ latency:0.5, loss:1.0, jitter:0.3, throughputDown:0.5, throughputUp:0.2 }, quick:{ pingCount:5, pingTimeoutMs:900, downloadBytes:3000000, uploadBytes:1000000, resolveTries:3 }, full:{ pingCount:10, pingTimeoutMs:1000, downloadBytes:8000000, uploadBytes:4000000, resolveTries:5 }, concurrency:3, throughput:{ host:'speed.cloudflare.com', downloadPath:'/__down', uploadPath:'/__up' } }; }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 860,
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Remove the default menu bar completely
  Menu.setApplicationMenu(null);
  win.setMenuBarVisibility(false);

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

const providersPath = path.join(__dirname, '..', 'data', 'dns_providers.json');
const restrictedSitesPath = path.join(__dirname, '..', 'data', 'restricted_sites.json');

function readJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// Legacy IPCs
ipcMain.handle('dns:listProviders', async () => readJson(providersPath) || []);
ipcMain.handle('dns:runTests', async (event, options) => {
  const providers = readJson(providersPath) || [];
  return await dnsTester.testAll(providers, options);
});
ipcMain.handle('dns:apply', async (event, serverAddresses) => {
  // Legacy Windows-only apply
  const winApply = require('./services/windowsDnsApply');
  return await winApply.applyDns(serverAddresses);
});
ipcMain.handle('sites:list', async () => readJson(restrictedSitesPath) || []);
ipcMain.handle('sites:test', async (event, sites) => await restrictionCheck.checkSites(sites));
ipcMain.handle('sites:testWithDns', async (event, payload) => {
  const dnsTest = require('./services/dnsSpecificTest');
  const { dns, website } = payload;
  return await dnsTest.testSiteWithDns(dns, website);
});

// Settings and history
ipcMain.handle('settings:get', async () => ({ config: readConfig(), user: storage.getSettings() }));
ipcMain.handle('settings:set', async (event, s) => { storage.setSettings(s || {}); return { ok: true }; });
ipcMain.handle('history:list', async () => storage.listHistory());

// Scan run via worker
ipcMain.handle('scan:run', async (event, payload) => {
  const mode = (payload && payload.mode) === 'full' ? 'full' : 'quick';
  const providers = readJson(providersPath) || [];
  const config = readConfig();

  return await new Promise((resolve) => {
    const workerPath = path.join(__dirname, 'workers', 'probe.js');
    const child = fork(workerPath, [], { stdio: ['inherit', 'inherit', 'inherit', 'ipc'] });
    child.on('message', (msg) => {
      if (msg && msg.type === 'done') {
        resolve(msg.results);
        child.disconnect();
      }
      // Could emit progress to renderer: event.sender.send('scan:progress', msg)
    });
    child.send({ type: 'run', providers, mode, config });
  });
});

// Cross-platform apply and revert
ipcMain.handle('apply-dns', async (event, payload) => {
  const servers = (payload && payload.servers) || [];
  const iface = payload && (payload.interfaceIndex || payload.service || payload.connection);
  if (!servers.length) return { ok: false, error: 'No servers specified' };

  // Read current DNS to history
  const before = await platformMod.readCurrentDns();
  storage.pushHistory({ platform: process.platform, before });

  const res = await platformMod.applyDns(servers, iface);
  // Command preview when available (Windows)
  let commandPreview;
  if (process.platform === 'win32') {
    try { commandPreview = require('../lib/platform/windows').getApplyCommand(servers, iface); } catch {}
  }
  return { ...res, commandPreview };
});

ipcMain.handle('dns:revert', async () => {
  const hist = storage.listHistory();
  if (!hist.length) return { ok: false, error: 'No history to revert' };
  const last = hist[0];
  // Aggregate previous servers (fallback)
  const prevServers = Array.from(new Set([].concat(...(last.before || []).map(x => x.ServerAddresses || x.servers || [])))).filter(Boolean);
  if (!prevServers.length) return { ok: false, error: 'No previous servers recorded' };
  const res = await platformMod.applyDns(prevServers);
  return res;
});

ipcMain.handle('dns:flush', async () => {
  return await platformMod.flushDns();
});
