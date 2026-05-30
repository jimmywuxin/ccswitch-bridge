#!/bin/bash
# <xbar.title>CCSwitch Bridge</xbar.title>
# <xbar.version>v1.4.0</xbar.version>
# <xbar.author>Jimmy Wu Xin</xbar.author>
# <xbar.desc>Menu bar toggle for DeepSeek / MiniMax / MiMo protocol proxy (config-driven)</xbar.desc>
# <xbar.dependencies>bash,node,lsof</xbar.dependencies>
# <xbar.abouturl>https://github.com/jimmywuxin/ccswitch-bridge</xbar.abouturl>

# Auto-detect project directory relative to this script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/package.json" ] && [ -f "$SCRIPT_DIR/providers.json" ]; then
    PROJECT_DIR="$SCRIPT_DIR"
elif [ -f "$(dirname "$SCRIPT_DIR")/package.json" ] && [ -f "$(dirname "$SCRIPT_DIR")/providers.json" ]; then
    PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
else
    PROJECT_DIR="$HOME/dev/ccswitch-bridge"
fi

PORT_DEEPSEEK=11435
PORT_MINIMAX=11436
PORT_MIMO=11437

running_on_port() {
    lsof -iTCP:"$1" -sTCP:LISTEN -P -n -t 2>/dev/null
}

human_status() {
    [ -n "$(running_on_port "$1")" ] && echo "✅" || echo "❌"
}

start_all() {
    for port in $PORT_DEEPSEEK $PORT_MINIMAX $PORT_MIMO; do
        if [ -n "$(running_on_port "$port")" ]; then
            osascript -e "display notification \"Port ${port} already in use — stop existing services first\" with title \"CCSwitch\"" &
            return
        fi
    done
    cd "$PROJECT_DIR" || exit 1
    nohup node index.js > /tmp/ccswitch-all.log 2>&1 &
    echo $! > "/tmp/ccswitch-all.pid"
    osascript -e "display notification \"All providers started (single process)\" with title \"CCSwitch\"" &
}

stop_all() {
    for port in $PORT_DEEPSEEK $PORT_MINIMAX $PORT_MIMO; do
        local pid
        pid=$(running_on_port "$port")
        if [ -n "$pid" ]; then
            kill "$pid" 2>/dev/null
            sleep 0.3
            if [ -n "$(running_on_port "$port")" ]; then
                kill -9 "$pid" 2>/dev/null
            fi
        fi
    done
    rm -f /tmp/ccswitch-all.pid /tmp/ccswitch-deepseek.pid /tmp/ccswitch-minimax.pid /tmp/ccswitch-mimo.pid
    osascript -e "display notification \"All services stopped\" with title \"CCSwitch\"" &
}

restart_all() {
    stop_all
    sleep 1
    start_all
}

health_check_all() {
    if [ -f "/tmp/ccswitch-all.pid" ]; then
        local any_down=false
        for port in $PORT_DEEPSEEK $PORT_MINIMAX $PORT_MIMO; do
            if ! running_on_port "$port" > /dev/null 2>&1; then
                any_down=true
                break
            fi
        done
        if [ "$any_down" = true ]; then
            stop_all
            sleep 1
            start_all
        fi
    fi
}

# --- menu ---
echo "🧠"
echo "---"
echo "DeepSeek :11435  $(human_status "$PORT_DEEPSEEK") | font=menlo size=11"
echo "MiniMax  :11436  $(human_status "$PORT_MINIMAX")  | font=menlo size=11"
echo "MiMo     :11437  $(human_status "$PORT_MIMO")   | font=menlo size=11"
echo "---"
echo "🚀 Start All (single process) | bash='$0' param1=start-all refresh=true terminal=false"
echo "🛑 Stop All  | bash='$0' param1=stop-all refresh=true terminal=false"
echo "🔄 Restart All | bash='$0' param1=restart-all refresh=true terminal=false"
echo "---"
echo "📋 View All Log | bash='$0' param1=log terminal=true"
echo "---"
echo "🔗 GitHub | href=https://github.com/jimmywuxin/ccswitch-bridge"

# --- actions ---
case "$1" in
    start-all)
        start_all ;;
    stop-all)
        stop_all ;;
    restart-all)
        restart_all ;;
    log)
        cat /tmp/ccswitch-all.log 2>/dev/null || echo "(empty)"
        echo
        echo "=== following ==="
        tail -f /tmp/ccswitch-all.log ;;
    *)
        health_check_all &
        ;;
esac
