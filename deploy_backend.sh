#!/usr/bin/env bash
# ==============================================================================
#  OptiCore Backend 1-Line Deployment Script
#  Usage:
#    curl -sSL https://raw.githubusercontent.com/Dharshankumar8197/OptiCore/main/deploy_backend.sh | bash -s -- --authtoken YOUR_TOKEN
# ==============================================================================

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}"
echo "==========================================================="
echo "   🚀 OptiCore AI Vision Backend — Remote Docker Deploy     "
echo "==========================================================="
echo -e "${NC}"

NGROK_TOKEN=""
PORT=8000
CONTAINER_NAME="opticore-backend"
IMAGE_NAME="ghcr.io/dharshankumar8197/opticore-backend:latest"

# Parse arguments
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --authtoken|-t) NGROK_TOKEN="$2"; shift ;;
        --port|-p) PORT="$2"; shift ;;
        --help|-h)
            echo "Usage: curl -sSL ... | bash -s -- [OPTIONS]"
            echo "Options:"
            echo "  --authtoken, -t <token>   Your Ngrok Authtoken"
            echo "  --port, -p <port>         Local port (default: 8000)"
            exit 0
            ;;
        *) echo "Unknown option: $1" ;;
    esac
    shift
done

# Check saved token cache files if not provided
TOKEN_CACHE="$HOME/.opticore_ngrok_token"
if [ -z "$NGROK_TOKEN" ]; then
    if [ -n "$NGROK_AUTHTOKEN" ]; then
        NGROK_TOKEN="$NGROK_AUTHTOKEN"
    elif [ -f "$TOKEN_CACHE" ]; then
        NGROK_TOKEN=$(cat "$TOKEN_CACHE" | tr -d ' \r\n')
        echo -e "${GREEN}[+] Loaded saved Ngrok Authtoken from cache.${NC}"
    elif [ -f ".ngrok_token" ]; then
        NGROK_TOKEN=$(cat ".ngrok_token" | tr -d ' \r\n')
        echo -e "${GREEN}[+] Loaded saved Ngrok Authtoken from local .ngrok_token.${NC}"
    elif [ -f "backend/.env" ] && grep -q '^NGROK_AUTHTOKEN=' "backend/.env"; then
        NGROK_TOKEN=$(grep '^NGROK_AUTHTOKEN=' "backend/.env" | cut -d'=' -f2- | tr -d ' \r\n')
        echo -e "${GREEN}[+] Loaded saved Ngrok Authtoken from backend/.env.${NC}"
    else
        echo -e "${YELLOW}[?] Enter your Ngrok Authtoken (get one free at https://dashboard.ngrok.com/get-started/your-authtoken):${NC}"
        read -r -p "Authtoken (press Enter to skip public tunnel): " NGROK_TOKEN
        if [ -n "$NGROK_TOKEN" ]; then
            echo "$NGROK_TOKEN" > "$TOKEN_CACHE" 2>/dev/null || true
            echo -e "${GREEN}[+] Saved Authtoken — you will never be asked again on this system!${NC}"
        fi
    fi
else
    echo "$NGROK_TOKEN" > "$TOKEN_CACHE" 2>/dev/null || true
fi

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}[!] Docker is not installed on this system.${NC}"
    echo "    Please install Docker first:"
    echo "    curl -fsSL https://get.docker.com | sh"
    exit 1
fi

echo -e "${CYAN}[*] Stopping any existing OptiCore backend container...${NC}"
docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
docker rm "$CONTAINER_NAME" >/dev/null 2>&1 || true

# Try pulling prebuilt image from GHCR; if not available, build from local repo
echo -e "${CYAN}[*] Pulling OptiCore backend image (${IMAGE_NAME})...${NC}"
if ! docker pull "$IMAGE_NAME" 2>/dev/null; then
    echo -e "${YELLOW}[*] Pre-built image not yet published to GHCR. Building locally from source...${NC}"
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [ -d "$SCRIPT_DIR/backend" ]; then
        docker build --progress=plain -f "$SCRIPT_DIR/backend/Dockerfile.standalone" -t "$IMAGE_NAME" "$SCRIPT_DIR/backend"
    else
        # Clone minimal repo if curling standalone
        TEMP_DIR=$(mktemp -d)
        git clone --depth 1 https://github.com/Dharshankumar8197/OptiCore.git "$TEMP_DIR"
        docker build --progress=plain -f "$TEMP_DIR/backend/Dockerfile.standalone" -t "$IMAGE_NAME" "$TEMP_DIR/backend"
        rm -rf "$TEMP_DIR"
    fi
fi

echo -e "${CYAN}[*] Starting OptiCore Backend container...${NC}"
docker run -d \
    --name "$CONTAINER_NAME" \
    --restart unless-stopped \
    -p "$PORT:8000" \
    -p 4040:4040 \
    -e NGROK_AUTHTOKEN="$NGROK_TOKEN" \
    -v opticore_data:/app/data \
    "$IMAGE_NAME"

echo -e "${GREEN}[+] Container started successfully!${NC}"
echo -e "${CYAN}[*] Resolving Ngrok public HTTPS tunnel...${NC}"

PUBLIC_URL=""
for i in {1..30}; do
    sleep 1
    PUBLIC_URL=$(docker exec "$CONTAINER_NAME" cat /app/data/ngrok_url.txt 2>/dev/null || true)
    if [ -n "$PUBLIC_URL" ]; then
        break
    fi
    # Fallback to host curl on 4040
    PUBLIC_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -o 'https://[^"]*\.ngrok[^"]*' | head -n 1 || true)
    if [ -n "$PUBLIC_URL" ]; then
        break
    fi
done

echo ""
echo -e "${GREEN}==========================================================="
echo "   🎉 OPTICORE BACKEND SERVER IS LIVE AND ACCESSIBLE!     "
echo "===========================================================${NC}"
echo -e "   📡 Local API:     ${CYAN}http://localhost:$PORT${NC}"
if [ -n "$PUBLIC_URL" ]; then
    echo -e "   🌍 Public HTTPS:  ${GREEN}$PUBLIC_URL${NC}"
    echo -e "   📖 Swagger Docs:  ${CYAN}$PUBLIC_URL/docs${NC}"
    echo -e "${GREEN}===========================================================${NC}"
    echo -e "${YELLOW}👉 Set this in your Web App (.env.local) or Mobile App:${NC}"
    echo -e "   NEXT_PUBLIC_API_URL=${GREEN}$PUBLIC_URL${NC}"
    echo -e "   NEXT_PUBLIC_WS_URL=${GREEN}${PUBLIC_URL/https/wss}${NC}"
else
    echo -e "   📖 Swagger Docs:  ${CYAN}http://localhost:$PORT/docs${NC}"
    echo -e "${YELLOW}ℹ️  Ngrok token was not provided. Running in local-only mode.${NC}"
fi
echo -e "${GREEN}===========================================================${NC}"
echo -e "View container logs anytime with: ${CYAN}docker logs -f $CONTAINER_NAME${NC}\n"
