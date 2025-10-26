#!/bin/bash

# ================================================
# Ollama Connection Test Script
# ================================================
# Use this script to test connectivity to Ollama
# from your Raspberry Pi
#
# Usage: ./test_ollama.sh [ollama_host]
# Example: ./test_ollama.sh http://192.168.1.100:11434
# ================================================

OLLAMA_HOST="${1:-http://localhost:11434}"

echo "Testing connection to Ollama at: $OLLAMA_HOST"
echo ""

# Test 1: Basic connectivity
echo "Test 1: Checking if host is reachable..."
if curl -s -o /dev/null -w "%{http_code}" "$OLLAMA_HOST" > /dev/null 2>&1; then
    echo "✓ Host is reachable"
else
    echo "✗ Cannot reach host"
    echo "  Make sure Ollama is running and the host is correct"
    exit 1
fi
echo ""

# Test 2: List models (tests CORS)
echo "Test 2: Testing CORS and API access..."
RESPONSE=$(curl -s -w "\n%{http_code}" "$OLLAMA_HOST/api/tags")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✓ Successfully connected to Ollama API"
    echo "✓ CORS is properly configured"
    
    # Parse and display models
    MODEL_COUNT=$(echo "$BODY" | grep -o '"name"' | wc -l)
    echo ""
    echo "Found $MODEL_COUNT model(s):"
    echo "$BODY" | grep '"name"' | sed 's/.*"name": *"\([^"]*\)".*/  - \1/'
    echo ""
    echo "✓ All tests passed! Ollama is ready to use."
else
    echo "✗ Failed to connect to Ollama API (HTTP $HTTP_CODE)"
    echo ""
    echo "Possible issues:"
    echo "  1. Ollama is not running"
    echo "  2. CORS is not configured (set OLLAMA_ORIGINS='*')"
    echo "  3. Ollama is not bound to network interface (set OLLAMA_HOST=0.0.0.0:11434)"
    echo "  4. Firewall is blocking the connection"
    exit 1
fi

