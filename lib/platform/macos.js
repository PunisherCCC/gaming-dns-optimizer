const sudo = require('sudo-prompt');
const { exec } = require('child_process');

function execProm(cmd) { return new Promise(res => exec(cmd, (e, stdout, stderr)=> res({ e, stdout, stderr }))); }

async function listInterfaces(){
  // networksetup -listallnetworkservices (ignore the first line that is a note)
  const r = await execProm('networksetup -listallnetworkservices');
  if (r.e) return [];
  return r.stdout.split('\n').slice(1).map(s => s.trim()).filter(Boolean);
}

async function readCurrentDns(){
  const services = await listInterfaces();
  const results = [];
  for (const s of services) {
    const r = await execProm(`networksetup -getdnsservers "${s}"`);
    const lines = r.stdout.trim().split(/\s+/).filter(Boolean);
    if (lines[0] && lines[0].toLowerCase() !== 'there') results.push({ service: s, servers: lines });
  }
  return results;
}

function applyDns(servers, service){
  const cmd = `networksetup -setdnsservers "${service}" ${servers.join(' ')}`;
  return new Promise((resolve)=>{
    sudo.exec(cmd, { name: 'Gaming DNS Optimizer' }, (error, stdout, stderr)=>{
      if (error) return resolve({ ok:false, error: String(error) });
      if (stderr && String(stderr).trim()) return resolve({ ok:false, error: String(stderr) });
      resolve({ ok:true, stdout });
    });
  });
}

function flushDns(){
  const cmd = 'dscacheutil -flushcache && sudo killall -HUP mDNSResponder';
  return new Promise((resolve)=>{
    sudo.exec(cmd, { name: 'Gaming DNS Optimizer' }, (error, stdout, stderr)=>{
      if (error) return resolve({ ok:false, error: String(error) });
      if (stderr && String(stderr).trim()) return resolve({ ok:false, error: String(stderr) });
      resolve({ ok:true, stdout });
    });
  });
}

module.exports = { listInterfaces, readCurrentDns, applyDns, flushDns };
