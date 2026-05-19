#!/bin/bash
cd "$(dirname "$0")"
pkill -f "node index.deepseek.js" 2>/dev/null
pkill -f "node index.minimax.js" 2>/dev/null
echo "All ccswitch-bridge processes stopped"
