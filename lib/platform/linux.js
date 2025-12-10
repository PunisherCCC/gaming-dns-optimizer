const sudo = require('sudo-prompt');
const { exec } = require('child_process');

function execProm(cmd) { return new Promise(res => exec(cmd, (e, stdout, stderr)=> res({ e, stdout, stderr }))); }

async function hasNmcli(){
  const r = await execProm('nmcli -v');
  return !r.e;
}

async function listInterfaces(){
  if (await hasNmcli()) {
    const r = await execProm('nmcli -t -f NAME,DEVICE connection show --active');
    if (r.e) return [];
    return r.stdout.split('\n').filter(Boolean).map(l => l.split(':')[0]);
  }
  return ['resolvconf'];
}

async function readCurrentDns(){
  if (await hasNmcli()) {
    const r = await execProm('nmcli -t -f NAME,ipv4.dns connection show --active');
    if (r.e) return [];
    return r.stdout.split('\n').filter(Boolean).map(line => {
      const [name, dns] = line.split(':');
      return { connection: name, servers: (dns || '').split(',').filter(Boolean) };
    });
  }
  const r = await execProm('cat /etc/resolv.conf');
  const servers = (r.stdout.match(/^nameserver\s+(.*)$/gm) || []).map(l => l.split(/\s+/)[1]);
  return [{ file: '/etc/resolv.conf', servers }];
}

function applyDns(servers, connection){
  return new Promise(async (resolve) => {
    if (await hasNmcli()) {
      const cmd = `nmcli con modify "${connection}" ipv4.dns "${servers.join(',')}" && nmcli con up "${connection}"`;
      return sudo.exec(cmd, { name: 'Gaming DNS Optimizer' }, (error, stdout, stderr)=>{
        if (error) return resolve({ ok:false, error: String(error) });
        if (stderr && String(stderr).trim()) return resolve({ ok:false, error: String(stderr) });
        resolve({ ok:true, stdout });
      });
    }
    const content = servers.map(s => `nameserver ${s}`).join('\n');
    const cmd = `bash -lc 'cp /etc/resolv.conf /etc/resolv.conf.backup && printf "%s\n" "${content.replace(/"/g,'\\"')}" > /etc/resolv.conf'`;
    sudo.exec(cmd, { name: 'Gaming DNS Optimizer' }, (error, stdout, stderr)=>{
      if (error) return resolve({ ok:false, error: String(error) });
      if (stderr && String(stderr).trim()) return resolve({ ok:false, error: String(stderr) });
      resolve({ ok:true, stdout });
    });
  });
}

function flushDns(){
  return new Promise(async (resolve) => {
    // Try systemd-resolve first, then nscd
    const cmd = 'systemd-resolve --flush-caches 2>/dev/null || resolvectl flush-caches 2>/dev/null || nscd -i hosts 2>/dev/null || true';
    sudo.exec(cmd, { name: 'Gaming DNS Optimizer' }, (error, stdout, stderr)=>{
      // DNS flush might not need sudo or might not be available, so we accept success even with errors
      resolve({ ok:true, stdout: stdout || 'DNS cache flush attempted' });
    });
  });
}

module.exports = { listInterfaces, readCurrentDns, applyDns, flushDns };
