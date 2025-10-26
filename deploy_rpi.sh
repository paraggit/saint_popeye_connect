#!/bin/bash

# ================================================
# Raspberry Pi Deployment Script
# ================================================
# This script builds and deploys the app to a Raspberry Pi
# 
# USAGE:
#   ./deploy_rpi.sh [pi_user@pi_host] [port] [ollama_host]
#
# EXAMPLES:
#   # Basic deployment (Ollama on Pi's localhost)
#   ./deploy_rpi.sh pi5@pi5
#
#   # Custom port
#   ./deploy_rpi.sh pi5@192.168.1.50 8080
#
#   # Remote Ollama (on different machine)
#   ./deploy_rpi.sh pi5@pi5 3000 http://192.168.1.100:11434
#
#   # With HTTPS (self-signed certificate)
#   ./deploy_rpi.sh pi5@pi5 3000 http://192.168.1.100:11434 true
#
#   # Ollama on your main PC with SSL
#   ./deploy_rpi.sh pi5@raspberrypi.local 3000 http://192.168.1.5:11434 true
#
# PARAMETERS:
#   [1] pi_user@pi_host  SSH connection to Pi (default: pi@raspberrypi.local)
#   [2] port             App port (default: 3000)
#   [3] ollama_host      Ollama URL (default: http://localhost:11434)
#   [4] use_ssl          Enable HTTPS with self-signed cert (default: false)
#
# PREREQUISITES:
#   - SSH key authentication set up (ssh-copy-id user@host)
#   - Ollama running and accessible from the Pi
#   - Ollama CORS configured: OLLAMA_ORIGINS='*'
#   - Ollama network binding: OLLAMA_HOST=0.0.0.0:11434
# ================================================

set -e  # Exit on error

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
PI_USER_HOST="${1:-pi@raspberrypi.local}"
APP_PORT="${2:-3000}"
OLLAMA_HOST="${3:-http://localhost:11434}"
USE_SSL="${4:-false}"
REMOTE_DIR="/home/$(echo $PI_USER_HOST | cut -d'@' -f1)/saint_popeye_connect"
APP_NAME="saintpopeye-connect"
CERT_DIR="${REMOTE_DIR}/certs"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  SaintPopeye Connect - Raspberry Pi Deployer${NC}"
echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}Target: ${PI_USER_HOST}${NC}"
echo -e "${GREEN}Remote Directory: ${REMOTE_DIR}${NC}"
echo -e "${GREEN}App Port: ${APP_PORT}${NC}"
echo -e "${GREEN}Ollama Host: ${OLLAMA_HOST}${NC}"
echo -e "${GREEN}SSL Enabled: ${USE_SSL}${NC}"
echo ""

# Check if SSH connection is available
echo -e "${YELLOW}Testing SSH connection...${NC}"
if ! ssh -o ConnectTimeout=5 -o BatchMode=yes "$PI_USER_HOST" exit 2>/dev/null; then
    echo -e "${RED}Error: Cannot connect to ${PI_USER_HOST}${NC}"
    echo -e "${YELLOW}Make sure:${NC}"
    echo -e "  1. Raspberry Pi is powered on and connected to network"
    echo -e "  2. SSH is enabled on the Pi"
    echo -e "  3. SSH keys are set up (run: ssh-copy-id ${PI_USER_HOST})"
    exit 1
fi
echo -e "${GREEN}✓ SSH connection successful${NC}"
echo ""

# Build the application locally
echo -e "${YELLOW}Building application locally...${NC}"
npm install
npm run build
echo -e "${GREEN}✓ Build complete${NC}"
echo ""

# Create remote directory if it doesn't exist
echo -e "${YELLOW}Setting up remote directory...${NC}"
ssh "$PI_USER_HOST" "mkdir -p ${REMOTE_DIR}"
echo -e "${GREEN}✓ Remote directory ready${NC}"
echo ""

# Copy files to Raspberry Pi
echo -e "${YELLOW}Transferring files to Raspberry Pi...${NC}"
rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '.gitignore' \
    --exclude 'deploy_rpi.sh' \
    --exclude 'test_ollama.sh' \
    --exclude 'README.md' \
    ./ "$PI_USER_HOST:${REMOTE_DIR}/"

# Copy test script separately
scp test_ollama.sh "$PI_USER_HOST:${REMOTE_DIR}/"
ssh "$PI_USER_HOST" "chmod +x ${REMOTE_DIR}/test_ollama.sh"

echo -e "${GREEN}✓ Files transferred${NC}"
echo ""

# Create config file with Ollama host
echo -e "${YELLOW}Creating configuration file with Ollama host...${NC}"
ssh "$PI_USER_HOST" << CONFIGEOF
    cd ${REMOTE_DIR}
    
    # Create public directory if it doesn't exist
    mkdir -p public
    
    # Create a config.js file that will be served by Vite
    cat > public/config.js << 'CONFIGJS'
window.APP_CONFIG = {
  ollamaHost: '${OLLAMA_HOST}'
};
CONFIGJS
    
    echo "✓ Configuration file created with Ollama host: ${OLLAMA_HOST}"
CONFIGEOF
echo -e "${GREEN}✓ Configuration set${NC}"
echo ""

# Generate SSL certificate if requested
if [ "$USE_SSL" = "true" ]; then
    echo -e "${YELLOW}Generating self-signed SSL certificate...${NC}"
    ssh "$PI_USER_HOST" << SSLEOF
        mkdir -p ${CERT_DIR}
        
        # Check if certificate already exists
        if [ -f "${CERT_DIR}/cert.pem" ] && [ -f "${CERT_DIR}/key.pem" ]; then
            echo "SSL certificate already exists, skipping generation..."
        else
            # Generate self-signed certificate valid for 365 days
            openssl req -x509 -newkey rsa:4096 -nodes \
                -keyout ${CERT_DIR}/key.pem \
                -out ${CERT_DIR}/cert.pem \
                -days 365 \
                -subj "/C=US/ST=State/L=City/O=Organization/CN=\$(hostname -I | awk '{print \$1}')" \
                -addext "subjectAltName=IP:\$(hostname -I | awk '{print \$1}'),DNS:localhost,DNS:\$(hostname)"
            
            chmod 600 ${CERT_DIR}/key.pem
            chmod 644 ${CERT_DIR}/cert.pem
            
            echo "✓ SSL certificate generated"
        fi
SSLEOF
    echo -e "${GREEN}✓ SSL certificate ready${NC}"
    echo ""
fi

# Install dependencies and setup on Raspberry Pi
echo -e "${YELLOW}Installing dependencies on Raspberry Pi...${NC}"
ssh "$PI_USER_HOST" "cd ${REMOTE_DIR} && bash -s" << 'EOF'
# Color codes for remote output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to compare version numbers
version_ge() {
    [ "$(printf '%s\n' "$1" "$2" | sort -V | head -n1)" = "$2" ]
}

# Check Node.js version
NODE_REQUIRED="20.19.0"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2)
    echo -e "${YELLOW}Current Node.js version: ${NODE_VERSION}${NC}"
    
    if ! version_ge "$NODE_VERSION" "$NODE_REQUIRED"; then
        echo -e "${YELLOW}Node.js version is too old (required: ${NODE_REQUIRED}+)${NC}"
        echo -e "${YELLOW}Upgrading Node.js...${NC}"
        
        # Remove old Node.js
        sudo apt-get remove -y nodejs npm
        sudo apt-get autoremove -y
        
        # Install Node.js 20 LTS
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
        
        # Verify installation
        NEW_NODE_VERSION=$(node -v | cut -d'v' -f2)
        echo -e "${GREEN}✓ Node.js upgraded to ${NEW_NODE_VERSION}${NC}"
    else
        echo -e "${GREEN}✓ Node.js version is sufficient${NC}"
    fi
else
    echo -e "${RED}Node.js is not installed${NC}"
    echo -e "${YELLOW}Installing Node.js 20 LTS...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    echo -e "${GREEN}✓ Node.js installed $(node -v)${NC}"
fi

# Install npm dependencies (including dev dependencies for vite)
echo -e "${YELLOW}Installing npm dependencies...${NC}"
npm install

# Stop any existing instance
echo -e "${YELLOW}Stopping existing instances...${NC}"
pkill -f "vite preview" || true
pkill -f "saintpopeye-connect" || true

echo -e "${GREEN}✓ Dependencies installed${NC}"
EOF
echo ""

# Create systemd service file
echo -e "${YELLOW}Setting up systemd service...${NC}"
ssh "$PI_USER_HOST" << EOF
    sudo tee /etc/systemd/system/${APP_NAME}.service > /dev/null << SERVICE
[Unit]
Description=SaintPopeye Connect Web Application
After=network.target

[Service]
Type=simple
User=$(echo $PI_USER_HOST | cut -d'@' -f1)
WorkingDirectory=${REMOTE_DIR}
ExecStart=/usr/bin/npm run preview -- --host 0.0.0.0 --port ${APP_PORT}
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SERVICE

    # Reload systemd and enable service
    sudo systemctl daemon-reload
    sudo systemctl enable ${APP_NAME}.service
    sudo systemctl restart ${APP_NAME}.service
EOF
echo -e "${GREEN}✓ Service configured and started${NC}"
echo ""

# Wait a moment for the service to start
sleep 2

# Check service status
echo -e "${YELLOW}Checking service status...${NC}"
ssh "$PI_USER_HOST" "sudo systemctl status ${APP_NAME}.service --no-pager" || true
echo ""

# Test Ollama connectivity from the Pi
echo -e "${YELLOW}Testing Ollama connectivity from Pi...${NC}"
OLLAMA_TEST_RESULT=$(ssh "$PI_USER_HOST" "cd ${REMOTE_DIR} && ./test_ollama.sh ${OLLAMA_HOST}" 2>&1)
OLLAMA_TEST_EXIT=$?

if [ $OLLAMA_TEST_EXIT -eq 0 ]; then
    echo -e "${GREEN}✓ Ollama is accessible and properly configured!${NC}"
    echo "$OLLAMA_TEST_RESULT" | grep -E "Found|model" || true
else
    echo -e "${RED}⚠ Warning: Could not connect to Ollama${NC}"
    echo -e "${YELLOW}The app is deployed but may not work until Ollama is accessible.${NC}"
    echo "$OLLAMA_TEST_RESULT"
fi
echo ""

# Get Pi's IP address
PI_IP=$(ssh "$PI_USER_HOST" "hostname -I | awk '{print \$1}'")

# Set protocol based on SSL
if [ "$USE_SSL" = "true" ]; then
    PROTOCOL="https"
else
    PROTOCOL="http"
fi

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  Deployment Complete! 🚀${NC}"
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}Application is running at:${NC}"
echo -e "${BLUE}  ${PROTOCOL}://${PI_IP}:${APP_PORT}${NC}"
echo -e "${BLUE}  ${PROTOCOL}://$(echo $PI_USER_HOST | cut -d'@' -f2):${APP_PORT}${NC}"
if [ "$USE_SSL" = "true" ]; then
    echo -e ""
    echo -e "${YELLOW}⚠️  SSL Certificate Warning:${NC}"
    echo -e "  This is a self-signed certificate. Your browser will show a security warning."
    echo -e "  Click 'Advanced' or 'Details' and proceed anyway (safe for local network)."
fi
echo ""
echo -e "${YELLOW}📡 Ollama Configuration:${NC}"
echo -e "  The app is configured to connect to: ${BLUE}${OLLAMA_HOST}${NC}"
if [ $OLLAMA_TEST_EXIT -eq 0 ]; then
    echo -e "  ${GREEN}✓ Connection verified!${NC}"
else
    echo -e "  ${RED}⚠ Connection test failed!${NC}"
    echo -e "  ${YELLOW}IMPORTANT:${NC} Make sure Ollama is running and accessible from the Pi!"
fi
echo ""
echo -e "${YELLOW}🔧 Ollama Server Setup (if not working):${NC}"
echo -e "  On your Ollama host machine, ensure CORS is enabled:"
echo -e "  ${BLUE}export OLLAMA_ORIGINS='*'${NC}"
echo -e "  ${BLUE}export OLLAMA_HOST=0.0.0.0:11434${NC}  # Allow network access"
echo -e "  Then restart your Ollama service."
echo ""
echo -e "${YELLOW}🧪 Test Ollama connection manually:${NC}"
echo -e "  ssh ${PI_USER_HOST} 'cd ${REMOTE_DIR} && ./test_ollama.sh ${OLLAMA_HOST}'"
echo ""
echo -e "${YELLOW}Useful commands:${NC}"
echo -e "  Check status:  ssh ${PI_USER_HOST} 'sudo systemctl status ${APP_NAME}'"
echo -e "  View logs:     ssh ${PI_USER_HOST} 'sudo journalctl -u ${APP_NAME} -f'"
echo -e "  Restart:       ssh ${PI_USER_HOST} 'sudo systemctl restart ${APP_NAME}'"
echo -e "  Stop:          ssh ${PI_USER_HOST} 'sudo systemctl stop ${APP_NAME}'"
echo -e "${GREEN}================================================${NC}"

