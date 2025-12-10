const sudo = require('sudo-prompt');

function powershellEsc(str) {
  return str.replace(/`/g, '``').replace(/"/g, '\"');
}

function buildApplyCommand(servers) {
  const list = servers.map(s => `'${s}'`).join(',');
  // Filter out obvious virtual adapters; apply to all Up adapters
  const ps = `
$servers = @(${list});
$adapters = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -and $_.InterfaceDescription -notmatch 'Virtual|Loopback|Hyper-V|VPN|TAP|VirtualBox' };
foreach ($a in $adapters) {
  try {
    Set-DnsClientServerAddress -InterfaceIndex $a.ifIndex -ServerAddresses $servers -ErrorAction Stop;
    Write-Output "Applied to: $($a.Name)";
  } catch { Write-Output "Failed: $($a.Name) - $($_.Exception.Message)" }
}
`;
  const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "${powershellEsc(ps)}"`;
  return cmd;
}

function applyDns(servers) {
  return new Promise((resolve) => {
    if (!Array.isArray(servers) || servers.length === 0) return resolve({ success: false, error: 'No servers' });
    const cmd = buildApplyCommand(servers);
    const options = { name: 'Gaming DNS Optimizer' };
    sudo.exec(cmd, options, (error, stdout, stderr) => {
      if (error) return resolve({ success: false, error: String(error) });
      if (stderr && String(stderr).trim()) return resolve({ success: false, error: String(stderr) });
      resolve({ success: true, output: stdout });
    });
  });
}

module.exports = { applyDns };
