#!/bin/bash
set -e

echo "==========================================================="
echo "   🚀 Starting OptiCore Standalone Backend Server         "
echo "==========================================================="

mkdir -p /app/data /app/models

# Start FastAPI/Uvicorn in the background
echo "[*] Launching FastAPI backend server on 0.0.0.0:8000..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
UVICORN_PID=$!

# Wait for backend to be ready
echo "[*] Waiting for backend health check..."
for i in {1..30}; do
    if curl -s http://127.0.0.1:8000/health >/dev/null 2>&1; then
        echo "[+] OptiCore Backend is ready and responding on :8000"
        break
    fi
    sleep 1
done

# If NGROK_AUTHTOKEN is set, start Ngrok
if [ -n "$NGROK_AUTHTOKEN" ]; then
    echo "[*] Configuring Ngrok authentication..."
    ngrok config add-authtoken "$NGROK_AUTHTOKEN" >/dev/null 2>&1 || true

    echo "[*] Starting Ngrok HTTPS tunnel on port 8000..."
    ngrok http 8000 --log=stdout > /app/data/ngrok.log 2>&1 &
    NGROK_PID=$!

    # Wait for tunnel URL
    PUBLIC_URL=""
    for i in {1..25}; do
        sleep 1
        PUBLIC_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -o 'https://[^"]*\.ngrok[^"]*' | head -n 1 || true)
        if [ -n "$PUBLIC_URL" ]; then
            break
        fi
    done

    if [ -n "$PUBLIC_URL" ]; then
        echo "$PUBLIC_URL" > /app/data/ngrok_url.txt
        echo ""
        echo "==========================================================="
        echo "   🌐 OPTICORE BACKEND PUBLIC HTTPS TUNNEL ESTABLISHED!    "
        echo "==========================================================="
        echo "   📡 Local URL:      http://localhost:8000               "
        echo "   🌍 Public URL:     $PUBLIC_URL                         "
        echo "   📖 Swagger Docs:   $PUBLIC_URL/docs                    "
        echo "==========================================================="
        echo "   👉 Configure your Web or Mobile App with:              "
        echo "      NEXT_PUBLIC_API_URL=$PUBLIC_URL                     "
        echo "      NEXT_PUBLIC_WS_URL=${PUBLIC_URL/https/wss}          "
        echo "==========================================================="
        echo ""
    else
        echo "[!] Warning: Ngrok tunnel started, check http://localhost:4040"
    fi
else
    echo "[!] No NGROK_AUTHTOKEN provided."
    echo "    Backend running in local mode on http://localhost:8000."
    echo "    To enable public remote access, pass -e NGROK_AUTHTOKEN=\"your_token\""
fi

trap 'kill -TERM $UVICORN_PID 2>/dev/null; kill -TERM $NGROK_PID 2>/dev/null; exit 0' SIGTERM SIGINT

wait $UVICORN_PID
