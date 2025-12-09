#!/bin/bash
# Zero-Downtime Deployment Script for Konfi Quest

cd /opt/Konfi-Quest

START_TIME=$(date +%s)
echo "========================================"
echo "Deployment gestartet: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"

echo ""
echo "[1/5] Pulling latest code..."
git pull

echo ""
echo "[2/5] Building containers (without stopping)..."
docker-compose build --quiet

echo ""
echo "[3/5] Updating backend (zero-downtime)..."
docker-compose up -d --no-deps backend

echo ""
echo "[4/5] Updating frontend (zero-downtime)..."
docker-compose up -d --no-deps frontend

echo ""
echo "[5/5] Health Check..."
sleep 3

# Health Check Backend
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8623/api/health 2>/dev/null || echo "000")
if [ "$BACKEND_STATUS" = "200" ]; then
    echo "  Backend: OK"
else
    echo "  Backend: FEHLER (Status: $BACKEND_STATUS)"
fi

# Health Check Frontend
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8624/ 2>/dev/null || echo "000")
if [ "$FRONTEND_STATUS" = "200" ]; then
    echo "  Frontend: OK"
else
    echo "  Frontend: FEHLER (Status: $FRONTEND_STATUS)"
fi

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "========================================"
echo "Deployment abgeschlossen!"
echo "Dauer: ${DURATION} Sekunden"
echo "Zeit: $(date '+%Y-%m-%d %H:%M:%S')"
echo "========================================"

# Container Status
echo ""
docker-compose ps
