# 🎮 Gaming DNS Optimizer

<div align="center">

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-31.0.0-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)](#-platform-support)

**Benchmark, optimize, and apply the best DNS servers for gaming with one click**

*A beautiful, cross-platform DNS optimizer with glassmorphism UI, dark mode, and advanced benchmarking*

[Download](#-download) • [Features](#-features) • [Quick Start](#-quick-start) • [Documentation](#-configuration)

</div>

---

## ✨ Features

### 🚀 Advanced DNS Benchmarking
- **Multi-Metric Testing**: Measures ping, jitter, packet loss, DNS resolution speed, and throughput
- **Concurrent Testing**: Worker-based parallel testing (3 concurrent) for faster results
- **Smart Scoring**: Configurable weighted algorithm to rank DNS providers
- **Dual Scan Modes**: 
  - **Quick Scan** (5 pings) - Results in ~30-60 seconds
  - **Full Scan** (10 pings) - Comprehensive analysis for accuracy

### 🎯 One-Click DNS Management
- **Cross-Platform Support**: Automatic DNS application on Windows, macOS, and Linux
- **Automatic Backup**: Saves current DNS configuration before changes
- **Easy Revert**: Restore previous DNS with a single click
- **DNS Cache Flush**: Clear DNS cache for immediate effect
- **Privilege Elevation**: Automatic UAC/sudo prompts when needed

### 🌐 Website Accessibility Testing
- **Pre-Apply Testing**: Test website access with specific DNS before applying system-wide
- **Restriction Detection**: Check which sites are affected by DNS filtering
- **Real-Time Results**: Instant feedback on DNS resolution and HTTP connectivity
- **Custom Site Testing**: Enter any DNS server and website to test accessibility

### 🎨 Modern UI Design
- **iOS 26 Glassmorphism**: Beautiful frosted glass effects with backdrop blur
- **Smooth Dark Mode**: Animated theme switching with 0.6s transitions
- **Persistent Preferences**: Theme and settings saved automatically
- **Custom Scrollbars**: Themed purple gradient scrollbars
- **Responsive Layout**: Clean interface that works on any screen size
- **No Menu Bar**: Distraction-free full window experience

---

## 📸 Screenshots

<div align="center">
<img width="1904" height="1005" alt="image" src="https://github.com/user-attachments/assets/b1ca6d7a-808c-406a-b71c-8517c6dfad77" />


### Light Mode - DNS Benchmarking
*Beautiful gradient background with frosted glass panels*

### Dark Mode - Testing Results
*Darker theme perfect for low-light environments*

### Website Testing
*Test accessibility before applying DNS changes*

</div>

---

## 🚀 Quick Start

### 📥 Download

#### Windows
- **Portable (Recommended)**: Run directly without installation
  - `Gaming DNS Optimizer 0.1.0.exe` (~78 MB)
- **Installer**: Full installation with shortcuts
  - `Gaming DNS Optimizer Setup 0.1.0.exe` (~78 MB)

#### macOS
- `Gaming DNS Optimizer.dmg`

#### Linux
- `Gaming DNS Optimizer.AppImage`

### 💻 Build from Source

```bash
# Clone the repository
git clone https://github.com/PunisherCCC/gaming-dns-optimizer.git
cd gaming-dns-optimizer

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production (both installer and portable)
npm run build

# Build portable version only
npm run build:portable
```

---

## 🎮 DNS Providers Included

### International Gaming DNS
- **Cloudflare** (1.1.1.1) - Ultra-low latency, privacy-focused
- **Google Public DNS** (8.8.8.8) - Reliable and fast worldwide
- **Quad9** (9.9.9.9) - Security-focused with malware blocking
- **OpenDNS** (208.67.222.222) - Gaming-optimized
- **Cisco Umbrella** - Enterprise-grade performance
- **AdGuard DNS** - Ad-blocking with low latency
- **Level3**, **Verisign**, **Comodo**, **NextDNS**, and more...

### Iranian Gaming DNS
- **Shatel**, **403.online**, **Electro**, **Radar Game**
- **Begzar**, **Pishgaman**, **Shecan**

*Total: 20+ DNS providers optimized for gaming*

---

## 📊 How It Works

### Benchmark Process

1. **Ping Testing** - Measures latency using native OS ping command
2. **Jitter Analysis** - Calculates ping variance for connection stability
3. **Packet Loss Detection** - Tests for dropped packets causing lag
4. **DNS Resolution** - Times how fast domains are resolved
5. **Throughput Testing** - Measures download/upload speeds via Cloudflare
6. **Smart Scoring** - Combines metrics with weights to rank providers

### Scoring Algorithm

```javascript
Score = (0.5 × latency) + (1.0 × loss) + (0.3 × jitter) 
        - (0.5 × download_speed) - (0.2 × upload_speed)
```

**Lower score = Better DNS** | Download/upload speeds reduce score (negative weight)

---

## ⚙️ Configuration

### Custom DNS Providers

Edit `data/dns_providers.json`:

```json
{
  "name": "My Custom DNS",
  "servers": ["1.2.3.4", "5.6.7.8"],
  "country": "Custom",
  "type": "gaming"
}
```

### Scoring Weights

Edit `src/config.json`:

```json
{
  "weights": {
    "latency": 0.5,
    "loss": 1.0,
    "jitter": 0.3,
    "throughputDown": 0.5,
    "throughputUp": 0.2
  }
}
```

### Restricted Sites

Add sites to check in `data/restricted_sites.json`:

```json
["nvidia.com", "epicgames.com", "steampowered.com"]
```

---

## 🖥️ Platform Support

### Windows
- Uses PowerShell `Set-DnsClientServerAddress`
- Requires UAC elevation for DNS changes
- Flush DNS: `ipconfig /flushdns`
- Tested on Windows 10/11

### macOS
- Uses `networksetup` command
- Requires sudo privileges
- Flush DNS: `dscacheutil -flushcache`
- Tested on macOS 10.15+

### Linux
- Supports NetworkManager (`nmcli`) or `/etc/resolv.conf`
- Requires sudo privileges
- Flush DNS: `systemd-resolve --flush-caches`
- Tested on Ubuntu, Fedora, Arch

---

## 🛠️ Technology Stack

- **Electron 31.0.0** - Cross-platform desktop framework
- **Node.js** - Backend runtime
- **Native OS Commands** - Ping, DNS, network configuration
- **Worker Processes** - Concurrent DNS testing
- **LocalStorage** - Settings persistence

### Dependencies
```json
{
  "electron": "^31.0.0",
  "sudo-prompt": "^9.2.1",
  "electron-builder": "^24.13.3"
}
```

---

## 📁 Project Structure

```
gaming-dns-optimizer/
├── src/
│   ├── main.js              # Electron main process
│   ├── preload.js           # IPC context bridge
│   ├── renderer/
│   │   ├── index.html       # UI structure
│   │   ├── renderer.js      # UI logic & event handlers
│   │   └── styles.css       # Glassmorphism design
│   ├── workers/
│   │   └── probe.js         # DNS testing worker
│   └── services/
│       ├── storage.js       # History & settings
│       └── dnsSpecificTest.js
├── lib/
│   └── platform/
│       ├── windows.js       # Windows DNS management
│       ├── macos.js         # macOS DNS management
│       └── linux.js         # Linux DNS management
├── data/
│   ├── dns_providers.json   # 20+ DNS servers
│   └── restricted_sites.json
└── build/
    └── icon.png             # App icon
```

---

## 🔒 Security & Privacy

### Why Administrator Access?
Required to:
- Modify system DNS settings
- Execute native ping commands
- Flush DNS cache

### Privacy Guarantee
- ✅ **100% Local** - All testing happens on your machine
- ✅ **No Telemetry** - Zero tracking or analytics
- ✅ **No Data Collection** - Your data stays on your device
- ✅ **Open Source** - Full code transparency

---

## 🐛 Troubleshooting

### DNS Not Applying
**Solution**: Ensure the app has administrator/root privileges. The app will prompt for elevation automatically.

### Throughput Test Fails
**Solution**: Check internet connection and ensure `speed.cloudflare.com` is accessible.

### App Won't Start
**Solution**: Delete app data folder:
- Windows: `%APPDATA%\gaming-dns-optimizer`
- macOS: `~/Library/Application Support/gaming-dns-optimizer`
- Linux: `~/.config/gaming-dns-optimizer`

### UAC Prompt Keeps Appearing
**Solution**: Normal behavior - DNS changes require elevation each time for security.

---

## 🤝 Contributing

Contributions are welcome! Here's how:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 Notes & Limitations

- DNS changes **cannot bypass IP/TLS blocks** - Consider encrypted DNS (DoH/DoT) or VPN for additional privacy
- Throughput tests use Cloudflare's speed endpoints - Results vary by network conditions
- ISP-local DNS servers (10.x.x.x) may be unreachable and score poorly
- Some DNS changes may take 10-30 seconds to propagate system-wide

---

## 📜 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- DNS providers for public DNS services
- Cloudflare for speed testing infrastructure
- Electron team for the framework
- Open source community

---

## 📧 Support

- **Issues**: [Report bugs](../../issues)
- **Discussions**: [Ask questions](../../discussions)
- **Pull Requests**: Contributions welcome!

---

<div align="center">

**Made with ❤️ for gamers seeking the ultimate connection**

⭐ **Star this repo** if you find it useful!

[⬆ Back to Top](#-gaming-dns-optimizer)

</div>



