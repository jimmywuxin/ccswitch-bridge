#!/bin/bash
cd "$(dirname "$0")"
node index.deepseek.js &
node index.minimax.js &
wait
