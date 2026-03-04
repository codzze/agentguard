#!/usr/bin/env bash
# ============================================================================
# AgentGuard — MCP Server Deployment Script
# Builds and starts the HaaS Core MCP server for integration with
# Claude Desktop, Cursor, or any MCP-compatible client.
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_DIR="$SCRIPT_DIR/packages/haas-core"
DASHBOARD_DIR="$SCRIPT_DIR/packages/haas-dashboard"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛡️  AgentGuard — MCP Deployment Script${NC}"
echo "============================================"

# ── Pre-flight checks ────────────────────────────────────────────────────
echo -e "\n${YELLOW}📋 Pre-flight checks...${NC}"

if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Node.js is not installed. Please install Node.js 20+.${NC}"
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo -e "${RED}❌ Node.js 20+ required. Current: $(node -v)${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Node.js $(node -v)${NC}"

if ! command -v npm &> /dev/null; then
  echo -e "${RED}❌ npm is not installed.${NC}"
  exit 1
fi
echo -e "${GREEN}✅ npm $(npm -v)${NC}"

# ── Install dependencies ─────────────────────────────────────────────────
echo -e "\n${YELLOW}📦 Installing dependencies...${NC}"
cd "$SCRIPT_DIR"
npm install --silent

# ── Build shared-proto ────────────────────────────────────────────────────
echo -e "\n${YELLOW}🔨 Building shared-proto...${NC}"
cd "$SCRIPT_DIR/packages/shared-proto"
npx tsc 2>/dev/null || echo -e "${YELLOW}⚠️  shared-proto build had warnings${NC}"

# ── Build haas-core ──────────────────────────────────────────────────────
echo -e "\n${YELLOW}🔨 Building haas-core...${NC}"
cd "$CORE_DIR"
npx tsc 2>/dev/null || echo -e "${YELLOW}⚠️  haas-core build had warnings${NC}"

echo -e "\n${GREEN}✅ Build complete!${NC}"

# ── Choose mode ──────────────────────────────────────────────────────────
MODE="${1:-dashboard}"

case "$MODE" in
  "mcp")
    echo -e "\n${BLUE}🚀 Starting AgentGuard as MCP Server (stdio)...${NC}"
    echo -e "${YELLOW}Connect this to your MCP client using the config in mcp-config.json${NC}"
    echo ""
    cd "$CORE_DIR"
    exec npx tsx src/mcp/mcp-server.ts
    ;;

  "http")
    echo -e "\n${BLUE}🚀 Starting AgentGuard HTTP Server (port 3100)...${NC}"
    echo ""
    cd "$CORE_DIR"
    exec npx tsx src/start-server.ts
    ;;

  "dashboard")
    echo -e "\n${BLUE}🚀 Starting AgentGuard HTTP Server + Dashboard...${NC}"
    echo ""
    # Start core in background
    cd "$CORE_DIR"
    npx tsx src/start-server.ts &
    CORE_PID=$!
    
    # Wait for core to be ready
    sleep 2
    
    # Start dashboard
    cd "$DASHBOARD_DIR"
    echo -e "${BLUE}📊 Starting Dashboard on port 5173...${NC}"
    npx vite &
    DASHBOARD_PID=$!
    
    echo -e "\n${GREEN}✅ Both services running:${NC}"
    echo -e "  🛡️  HaaS Core:    http://localhost:3100"
    echo -e "  📊 Dashboard:    http://localhost:5173"
    echo -e "\nPress Ctrl+C to stop both services."
    
    # Wait for either to exit
    trap "kill $CORE_PID $DASHBOARD_PID 2>/dev/null; exit 0" INT TERM
    wait
    ;;

  "demo")
    echo -e "\n${BLUE}🎮 Running AgentGuard Demo...${NC}"
    echo ""
    
    # Start core in background
    cd "$CORE_DIR"
    npx tsx src/start-server.ts &
    CORE_PID=$!
    sleep 2
    
    echo -e "${YELLOW}📡 Triggering demo scenarios...${NC}"
    
    # Trigger demo
    curl -s -X POST http://localhost:3100/demo/trigger \
      -H "Content-Type: application/json" \
      -d '{"scenario":"all"}' | python3 -m json.tool 2>/dev/null || \
    curl -s -X POST http://localhost:3100/demo/trigger \
      -H "Content-Type: application/json" \
      -d '{"scenario":"all"}'
    
    echo -e "\n${YELLOW}📋 Pending tasks:${NC}"
    curl -s http://localhost:3100/pending | python3 -m json.tool 2>/dev/null || \
    curl -s http://localhost:3100/pending
    
    echo -e "\n${GREEN}✅ Demo complete! Core still running on port 3100.${NC}"
    echo "Press Ctrl+C to stop."
    
    trap "kill $CORE_PID 2>/dev/null; exit 0" INT TERM
    wait
    ;;

  *)
    echo -e "\n${YELLOW}Usage: $0 [mode]${NC}"
    echo ""
    echo "Modes:"
    echo "  http       Start HTTP proxy server (default, port 3100)"
    echo "  mcp        Start as MCP stdio server (for Claude Desktop/Cursor)"
    echo "  dashboard  Start HTTP server + React dashboard"
    echo "  demo       Start server and trigger demo scenarios"
    echo ""
    echo "Examples:"
    echo "  $0 http         # Start the governance HTTP API"
    echo "  $0 mcp          # Start as MCP server for Claude Desktop"
    echo "  $0 dashboard    # Start everything"
    echo "  $0 demo         # Quick demo with sample tool calls"
    ;;
esac
