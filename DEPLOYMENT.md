# Deployment Guide - Remote Ollama Setup

## Overview
This deployment setup allows you to:
- Deploy the SaintPopeye Connect app on a Raspberry Pi
- Connect to an Ollama instance running on ANY machine (not just the Pi)
- Automatically configure the app with the correct Ollama host

## Quick Start

### 1. Prepare Your Ollama Host
On the machine running Ollama (could be your PC, server, or another Pi):

```bash
# Allow CORS from any origin
export OLLAMA_ORIGINS='*'

# Allow network connections (not just localhost)
export OLLAMA_HOST=0.0.0.0:11434

# Start Ollama
ollama serve
```

For permanent setup with systemd:
```bash
sudo systemctl edit ollama.service
```

Add:
```ini
[Service]
Environment="OLLAMA_ORIGINS=*"
Environment="OLLAMA_HOST=0.0.0.0:11434"
```

Save and restart:
```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

### 2. Set Up SSH Keys (One-time)
```bash
ssh-copy-id pi5@pi5  # Replace with your Pi's username and hostname
```

### 3. Deploy to Raspberry Pi
From your development machine:

```bash
# Example: Ollama on your main PC at 192.168.1.100
./deploy_rpi.sh pi5@pi5 3000 http://192.168.1.100:11434

# Example: Ollama on localhost of the Pi
./deploy_rpi.sh pi5@pi5 3000 http://localhost:11434

# Example: Using hostname instead of IP
./deploy_rpi.sh pi5@raspberrypi.local 3000 http://mypc.local:11434
```

### 4. Access Your App
After deployment completes, access the app at:
- `http://[PI_IP]:3000`
- Works from any device on your network!

## Troubleshooting

### Test Ollama Connectivity
```bash
# From your Pi
./test_ollama.sh http://192.168.1.100:11434

# Or remotely
ssh pi5@pi5 'cd ~/saint_popeye_connect && ./test_ollama.sh http://192.168.1.100:11434'
```

### Check App Logs
```bash
ssh pi5@pi5 'sudo journalctl -u saintpopeye-connect -f'
```

### Restart the App
```bash
ssh pi5@pi5 'sudo systemctl restart saintpopeye-connect'
```

## Common Scenarios

### Scenario 1: Development PC → Pi (Display/Kiosk)
You have a powerful PC running Ollama and want the Pi to act as a dedicated display/kiosk:
```bash
./deploy_rpi.sh pi5@kiosk-pi 3000 http://192.168.1.5:11434
```

### Scenario 2: Ollama on Pi
Ollama running directly on the Raspberry Pi:
```bash
./deploy_rpi.sh pi5@pi5 3000 http://localhost:11434
```

### Scenario 3: Cloud/Remote Server
Ollama on a cloud server or remote machine:
```bash
./deploy_rpi.sh pi5@pi5 3000 http://server.example.com:11434
```

## Network Requirements

1. **Raspberry Pi** must be able to reach the Ollama host
2. **Your devices** (phone, tablet, etc.) must be able to reach the Pi
3. **Firewall** on Ollama host should allow port 11434
4. **CORS** must be configured on Ollama (`OLLAMA_ORIGINS='*'`)

## Files Overview

- `deploy_rpi.sh` - Main deployment script
- `test_ollama.sh` - Connectivity test utility
- `public/config.js` - Runtime configuration (auto-generated)
- `src/App.tsx` - Reads Ollama host from config

## How It Works

1. **Build Phase**: App is built on your development machine
2. **Transfer Phase**: Files are copied to Pi via rsync
3. **Configuration Phase**: `config.js` is created with your Ollama host
4. **Setup Phase**: Node.js is installed/upgraded, dependencies installed
5. **Service Phase**: Systemd service is created and started
6. **Verification Phase**: Ollama connectivity is tested

The app reads the Ollama host from `window.APP_CONFIG.ollamaHost` at runtime, which is set during deployment.

## Re-deployment

To update or change the Ollama host:
```bash
# Just run the deploy script again with new parameters
./deploy_rpi.sh pi5@pi5 3000 http://new-host:11434
```

The script will:
- Update all files
- Update the configuration
- Restart the service
- Re-test connectivity

## Security Notes

⚠️ **Important**: Setting `OLLAMA_ORIGINS='*'` allows any web app to connect to your Ollama instance. This is fine for local networks but shouldn't be exposed to the internet.

For production, replace `'*'` with specific URLs:
```bash
export OLLAMA_ORIGINS='http://192.168.1.50:3000,http://pi5.local:3000'
```

