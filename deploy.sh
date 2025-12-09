#!/bin/bash
# Zero-Downtime Deployment Script for Konfi Quest

cd /opt/Konfi-Quest

echo "[1/4] Pulling latest code..."
git pull

echo "[2/4] Building containers (without stopping)..."
docker-compose build

echo "[3/4] Updating backend (zero-downtime)..."
docker-compose up -d --no-deps backend

echo "[4/4] Updating frontend (zero-downtime)..."
docker-compose up -d --no-deps frontend

echo ""
echo "Deployment complete!"
docker-compose ps
