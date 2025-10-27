#!/bin/bash

# ================================================
# Ollama HTTPS Nginx Reverse Proxy Setup
# ================================================
# This script sets up nginx as an HTTPS reverse proxy for Ollama
# Run this on the machine where Ollama is running (192.168.1.6)
#
# USAGE:
#   ./setup_ollama_proxy.sh [port]
#
# EXAMPLE:
#   ./setup_ollama_proxy.sh 11435
#
# This will:
#   - Install nginx
#   - Generate self-signed SSL certificate
#   - Configure nginx to proxy HTTPS:11435 -> HTTP:11434
#   - Start nginx service
#
# After setup, use: https://192.168.1.6:11435
# ================================================

set -e  # Exit on error

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
HTTPS_PORT="${1:-11435}"
OLLAMA_PORT="11434"
CERT_DIR="/etc/nginx/ssl/ollama"
NGINX_CONF="/etc/nginx/sites-available/ollama-proxy"
NGINX_ENABLED="/etc/nginx/sites-enabled/ollama-proxy"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Ollama HTTPS Reverse Proxy Setup${NC}"
echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}HTTPS Port: ${HTTPS_PORT}${NC}"
echo -e "${GREEN}Ollama Port: ${OLLAMA_PORT}${NC}"
echo -e "${GREEN}Certificate Dir: ${CERT_DIR}${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Error: This script must be run as root (use sudo)${NC}"
    exit 1
fi

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
    echo -e "${YELLOW}Detected: macOS${NC}"
elif [[ -f /etc/debian_version ]]; then
    OS="debian"
    echo -e "${YELLOW}Detected: Debian/Ubuntu Linux${NC}"
elif [[ -f /etc/redhat-release ]]; then
    OS="redhat"
    echo -e "${YELLOW}Detected: RedHat/CentOS Linux${NC}"
else
    OS="unknown"
    echo -e "${YELLOW}Warning: Unknown OS, assuming Linux${NC}"
fi
echo ""

# Install nginx
echo -e "${YELLOW}Installing nginx...${NC}"
if [ "$OS" = "macos" ]; then
    if ! command -v brew &> /dev/null; then
        echo -e "${RED}Error: Homebrew not found. Please install Homebrew first.${NC}"
        exit 1
    fi
    brew install nginx || echo "nginx might already be installed"
elif [ "$OS" = "debian" ]; then
    apt-get update
    apt-get install -y nginx
elif [ "$OS" = "redhat" ]; then
    yum install -y nginx
fi
echo -e "${GREEN}✓ nginx installed${NC}"
echo ""

# Create SSL certificate directory
echo -e "${YELLOW}Creating SSL certificate directory...${NC}"
mkdir -p "$CERT_DIR"
echo -e "${GREEN}✓ Directory created${NC}"
echo ""

# Generate self-signed SSL certificate
if [ -f "$CERT_DIR/cert.pem" ] && [ -f "$CERT_DIR/key.pem" ]; then
    echo -e "${YELLOW}SSL certificate already exists, skipping generation...${NC}"
else
    echo -e "${YELLOW}Generating self-signed SSL certificate...${NC}"
    
    # Get server IP address
    if [ "$OS" = "macos" ]; then
        SERVER_IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1 || echo "localhost")
    else
        SERVER_IP=$(hostname -I | awk '{print $1}')
    fi
    
    openssl req -x509 -newkey rsa:4096 -nodes \
        -keyout "$CERT_DIR/key.pem" \
        -out "$CERT_DIR/cert.pem" \
        -days 365 \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=${SERVER_IP}" \
        -addext "subjectAltName=IP:${SERVER_IP},DNS:localhost"
    
    chmod 600 "$CERT_DIR/key.pem"
    chmod 644 "$CERT_DIR/cert.pem"
    
    echo -e "${GREEN}✓ SSL certificate generated for IP: ${SERVER_IP}${NC}"
fi
echo ""

# Configure nginx
echo -e "${YELLOW}Configuring nginx reverse proxy...${NC}"

if [ "$OS" = "macos" ]; then
    NGINX_CONF="/usr/local/etc/nginx/servers/ollama-proxy.conf"
    mkdir -p /usr/local/etc/nginx/servers
fi

cat > "$NGINX_CONF" << 'NGINXCONF'
server {
    listen HTTPS_PORT ssl;
    listen [::]:HTTPS_PORT ssl;

    server_name _;

    # SSL Configuration
    ssl_certificate CERT_DIR/cert.pem;
    ssl_certificate_key CERT_DIR/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Logging
    access_log /var/log/nginx/ollama-proxy-access.log;
    error_log /var/log/nginx/ollama-proxy-error.log;

    # Proxy settings
    location / {
        proxy_pass http://127.0.0.1:OLLAMA_PORT;
        proxy_http_version 1.1;
        
        # WebSocket support (for streaming)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts for long-running requests (model generation)
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        
        # CORS headers (if needed)
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
        
        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }
}
NGINXCONF

# Replace placeholders
sed -i.bak "s|HTTPS_PORT|$HTTPS_PORT|g" "$NGINX_CONF"
sed -i.bak "s|OLLAMA_PORT|$OLLAMA_PORT|g" "$NGINX_CONF"
sed -i.bak "s|CERT_DIR|$CERT_DIR|g" "$NGINX_CONF"
rm -f "$NGINX_CONF.bak"

# Enable site (Linux)
if [ "$OS" != "macos" ]; then
    ln -sf "$NGINX_CONF" "$NGINX_ENABLED" 2>/dev/null || true
fi

echo -e "${GREEN}✓ nginx configured${NC}"
echo ""

# Test nginx configuration
echo -e "${YELLOW}Testing nginx configuration...${NC}"
if nginx -t; then
    echo -e "${GREEN}✓ nginx configuration is valid${NC}"
else
    echo -e "${RED}✗ nginx configuration has errors${NC}"
    exit 1
fi
echo ""

# Start/restart nginx
echo -e "${YELLOW}Starting nginx...${NC}"
if [ "$OS" = "macos" ]; then
    brew services restart nginx
elif command -v systemctl &> /dev/null; then
    systemctl enable nginx
    systemctl restart nginx
else
    service nginx restart
fi
echo -e "${GREEN}✓ nginx started${NC}"
echo ""

# Get server IP
if [ "$OS" = "macos" ]; then
    SERVER_IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1 || echo "localhost")
else
    SERVER_IP=$(hostname -I | awk '{print $1}')
fi

# Final status check
sleep 2
echo -e "${YELLOW}Checking nginx status...${NC}"
if [ "$OS" = "macos" ]; then
    brew services list | grep nginx || true
elif command -v systemctl &> /dev/null; then
    systemctl status nginx --no-pager || true
else
    service nginx status || true
fi
echo ""

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  Setup Complete! 🚀${NC}"
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}Ollama HTTPS Proxy is now running!${NC}"
echo ""
echo -e "${BLUE}Access Ollama via HTTPS at:${NC}"
echo -e "${YELLOW}  https://${SERVER_IP}:${HTTPS_PORT}${NC}"
echo ""
echo -e "${BLUE}Test the connection:${NC}"
echo -e "  ${YELLOW}curl -k https://${SERVER_IP}:${HTTPS_PORT}/api/tags${NC}"
echo ""
echo -e "${BLUE}Use in your app:${NC}"
echo -e "  ${YELLOW}./deploy_rpi.sh pi5@localhost 3000 https://${SERVER_IP}:${HTTPS_PORT} true${NC}"
echo ""
echo -e "${YELLOW}⚠️  Note: This uses a self-signed certificate${NC}"
echo -e "   Clients will need to accept the security warning."
echo ""
echo -e "${BLUE}Useful commands:${NC}"
if [ "$OS" = "macos" ]; then
    echo -e "  View logs:       tail -f /usr/local/var/log/nginx/ollama-proxy-*.log"
    echo -e "  Restart nginx:   brew services restart nginx"
    echo -e "  Stop nginx:      brew services stop nginx"
    echo -e "  Nginx config:    /usr/local/etc/nginx/servers/ollama-proxy.conf"
else
    echo -e "  View logs:       sudo tail -f /var/log/nginx/ollama-proxy-*.log"
    echo -e "  Restart nginx:   sudo systemctl restart nginx"
    echo -e "  Stop nginx:      sudo systemctl stop nginx"
    echo -e "  Nginx config:    /etc/nginx/sites-available/ollama-proxy"
fi
echo -e "${GREEN}================================================${NC}"

