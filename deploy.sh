#!/bin/bash

# ==============================================================================
# Deploy Script for English Active Recall Application
# ==============================================================================
# This script deploys the application to the remote server by:
# 1. Connecting to the server via SSH
# 2. Navigating to the project directory
# 3. Stopping existing containers
# 4. Rebuilding images without cache
# 5. Starting containers in detached mode
# ==============================================================================

set -e  # Exit immediately if a command exits with a non-zero status

# Configuration
SERVER="root@srv904418.hstgr.cloud"
PROJECT_DIR="english_active_recall"

echo "=========================================="
echo "  Deploying English Active Recall App"
echo "=========================================="
echo ""

echo "[1/4] Connecting to server and navigating to project directory..."
echo "     Server: $SERVER"
echo "     Directory: $PROJECT_DIR"
echo ""

ssh $SERVER << 'ENDSSH'
    set -e  # Exit on error within SSH session
    
    cd english_active_recall
    
    echo "[2/5] Pulling latest changes from git..."
    git pull
    echo "     ✓ Git pull completed successfully"
    echo ""
    
    echo "[3/5] Stopping existing containers..."
    docker compose down
    echo "     ✓ Containers stopped successfully"
    echo ""
    
    echo "[4/5] Rebuilding Docker images (no cache)..."
    docker compose build --no-cache
    echo "     ✓ Images rebuilt successfully"
    echo ""
    
    echo "[5/5] Starting containers in detached mode..."
    docker compose up -d
    echo "     ✓ Containers started successfully"
    echo ""
    
    echo "=========================================="
    echo "  Deployment Complete!"
    echo "=========================================="
    echo ""
    echo "Running containers:"
    docker compose ps
ENDSSH

echo ""
echo "=========================================="
echo "  Deployment finished successfully!"
echo "=========================================="
