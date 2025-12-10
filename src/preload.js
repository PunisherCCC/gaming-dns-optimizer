const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  listProviders: () => ipcRenderer.invoke('dns:listProviders'),
  runTests: (options) => ipcRenderer.invoke('dns:runTests', options),
  applyDns: (servers) => ipcRenderer.invoke('dns:apply', servers),
  listSites: () => ipcRenderer.invoke('sites:list'),
  testSites: (sites) => ipcRenderer.invoke('sites:test', sites),
  // Advanced APIs
  runScan: (mode) => ipcRenderer.invoke('scan:run', { mode }),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (s) => ipcRenderer.invoke('settings:set', s),
  applyDnsCross: (payload) => ipcRenderer.invoke('apply-dns', payload),
  revertDns: () => ipcRenderer.invoke('dns:revert'),
  flushDns: () => ipcRenderer.invoke('dns:flush'),
  listHistory: () => ipcRenderer.invoke('history:list'),
  testSiteWithDns: (payload) => ipcRenderer.invoke('sites:testWithDns', payload)
});
