const sudo = require('sudo-prompt');

function escPS(str){ return str.replace(/`/g,'``').replace(/"/g,'\"'); }

function getReadCommand(){
  const ps = `Get-DnsClientServerAddress -AddressFamily IPv4 | Select-Object InterfaceIndex,InterfaceAlias,ServerAddresses | ConvertTo-Json -Compress`;
  return `powershell -NoProfile -ExecutionPolicy Bypass -Command "${escPS(ps)}"`;
}

function getApplyCommand(servers, interfaceIndex){
  const list = servers.map(s => `'${s}'`).join(',');
  let scope = interfaceIndex ? `-InterfaceIndex ${interfaceIndex}` : `-InterfaceAlias (Get-NetAdapter | Where-Object { $_.Status -eq 'Up' }).Name`;
  const ps = `Set-DnsClientServerAddress ${scope} -ServerAddresses @(${list})`;
  return `powershell -NoProfile -ExecutionPolicy Bypass -Command "${escPS(ps)}"`;
}

function getInterfacesCommand(){
  const ps = `Get-NetAdapter | Where-Object { $_.Status -eq 'Up' } | Select-Object ifIndex,Name,InterfaceDescription | ConvertTo-Json -Compress`;
  return `powershell -NoProfile -ExecutionPolicy Bypass -Command "${escPS(ps)}"`;
}

function execElevated(cmd){
  return new Promise((resolve)=>{
    sudo.exec(cmd, { name: 'Gaming DNS Optimizer' }, (error, stdout, stderr)=>{
      if (error) return resolve({ ok:false, error: String(error) });
      if (stderr && String(stderr).trim()) return resolve({ ok:false, error: String(stderr) });
      resolve({ ok:true, stdout });
    });
  });
}

async function readCurrentDns(){
  const cmd = getReadCommand();
  // Reading current DNS does not strictly need elevation, but leave via sudo for consistency
  const res = await execElevated(cmd);
  if (!res.ok) return [];
  try { return JSON.parse(res.stdout); } catch { return []; }
}

async function applyDns(servers, interfaceIndex){
  const cmd = getApplyCommand(servers, interfaceIndex);
  return await execElevated(cmd);
}

async function listInterfaces(){
  const res = await execElevated(getInterfacesCommand());
  if (!res.ok) return [];
  try { return JSON.parse(res.stdout); } catch { return []; }
}

async function flushDns(){
  const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "ipconfig /flushdns"`;
  return await execElevated(cmd);
}

module.exports = { readCurrentDns, applyDns, listInterfaces, getApplyCommand, flushDns };
