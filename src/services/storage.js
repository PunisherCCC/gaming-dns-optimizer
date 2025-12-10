const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function getStorePath(){
  const dir = app.getPath('userData');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'storage.json');
}

function readAll(){
  const p = getStorePath();
  try { const raw = fs.readFileSync(p, 'utf8'); return JSON.parse(raw); } catch { return { history: [], settings: {} }; }
}

function writeAll(data){
  const p = getStorePath();
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function getSettings(){
  const all = readAll();
  return all.settings || {};
}

function setSettings(settings){
  const all = readAll();
  all.settings = { ...(all.settings || {}), ...settings };
  writeAll(all);
}

function pushHistory(entry){
  const all = readAll();
  all.history = all.history || [];
  all.history.unshift({ ...entry, at: new Date().toISOString() });
  all.history = all.history.slice(0, 50);
  writeAll(all);
}

function listHistory(){
  return (readAll().history || []);
}

module.exports = { getSettings, setSettings, pushHistory, listHistory };
