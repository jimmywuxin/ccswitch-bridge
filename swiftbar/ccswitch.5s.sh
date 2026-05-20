#!/bin/bash
# <xbar.title>CCSwitch Bridge</xbar.title>
# <xbar.version>v1.1.0</xbar.version>
# <xbar.author>Jimmy Wu Xin</xbar.author>
# <xbar.desc>Menu bar toggle for DeepSeek / MiniMax protocol proxy</xbar.desc>
# <xbar.dependencies>bash,node,lsof</xbar.dependencies>
# <xbar.abouturl>https://github.com/jimmywuxin/ccswitch-bridge</xbar.abouturl>

PROJECT_DIR="$HOME/ccswitch-bridge"
PORT_DEEPSEEK=11435
PORT_MINIMAX=11436

running_on_port() {
    lsof -iTCP:"$1" -sTCP:LISTEN -P -n -t 2>/dev/null
}

human_status() {
    [ -n "$(running_on_port "$1")" ] && echo "✅" || echo "❌"
}

current_model() {
    local d=$(running_on_port "$PORT_DEEPSEEK") m=$(running_on_port "$PORT_MINIMAX")
    if   [ -n "$d" ] && [ -n "$m" ]; then echo "both"
    elif [ -n "$d" ]; then echo "deepseek"
    elif [ -n "$m" ]; then echo "minimax"
    else echo "none"
    fi
}

start_model() {
    local name="$1" script="$2" port="$3"
    if [ -n "$(running_on_port "$port")" ]; then
        osascript -e "display notification \"${name} is already running on port ${port}\" with title \"CCSwitch\"" &
        return
    fi
    cd "$PROJECT_DIR" || exit 1
    nohup node "$script" > /tmp/ccswitch-${name}.log 2>&1 &
    osascript -e "display notification \"${name} started on port ${port}\" with title \"CCSwitch\"" &
}

stop_model() {
    local name="$1" port="$2"
    local pid
    pid=$(running_on_port "$port")
    if [ -z "$pid" ]; then
        osascript -e "display notification \"${name} is not running\" with title \"CCSwitch\"" &
        return
    fi
    kill "$pid" 2>/dev/null
    sleep 0.5
    if [ -n "$(running_on_port "$port")" ]; then
        kill -9 "$pid" 2>/dev/null
    fi
    osascript -e "display notification \"${name} stopped\" with title \"CCSwitch\"" &
}

restart_model() {
    local name="$1" script="$2" port="$3"
    if [ -n "$(running_on_port "$port")" ]; then
        stop_model "$name" "$port"
        sleep 1
    fi
    start_model "$name" "$script" "$port"
}

# --- menu ---
echo "🧠"
echo "---"
echo "DeepSeek :11435  $(human_status "$PORT_DEEPSEEK") | font=menlo size=11"
echo "MiniMax  :11436  $(human_status "$PORT_MINIMAX")  | font=menlo size=11"
echo "---"
echo "🌊 DeepSeek | bash='$0' param1=start param2=deepseek refresh=true terminal=false"
echo "🔶 MiniMax  | bash='$0' param1=start param2=minimax refresh=true terminal=false"
echo "---"
echo "🔄 Restart DeepSeek | bash='$0' param1=restart param2=deepseek refresh=true terminal=false"
echo "🔄 Restart MiniMax  | bash='$0' param1=restart param2=minimax refresh=true terminal=false"
echo "---"
echo "🛑 Stop DeepSeek | bash='$0' param1=stop param2=deepseek refresh=true terminal=false"
echo "🛑 Stop MiniMax  | bash='$0' param1=stop param2=minimax refresh=true terminal=false"
echo "---"
echo "📋 View DeepSeek Log | bash='$0' param1=log param2=deepseek terminal=true"
echo "📋 View MiniMax Log  | bash='$0' param1=log param2=minimax terminal=true"
echo "---"
echo "🔗 GitHub | href=https://github.com/jimmywuxin/ccswitch-bridge"

# --- actions ---
case "$1" in
    start)
        case "$2" in
            deepseek) start_model "deepseek" "index.deepseek.js" "$PORT_DEEPSEEK" ;;
            minimax)  start_model "minimax"  "index.minimax.js"  "$PORT_MINIMAX" ;;
        esac ;;
    stop)
        case "$2" in
            deepseek) stop_model "deepseek" "$PORT_DEEPSEEK" ;;
            minimax)  stop_model "minimax"  "$PORT_MINIMAX" ;;
        esac ;;
    restart)
        case "$2" in
            deepseek) restart_model "deepseek" "index.deepseek.js" "$PORT_DEEPSEEK" ;;
            minimax)  restart_model "minimax"  "index.minimax.js"  "$PORT_MINIMAX" ;;
        esac ;;
    log)
        case "$2" in
            deepseek) cat /tmp/ccswitch-deepseek.log 2>/dev/null || echo "(empty)"; echo; echo "=== following ==="; tail -f /tmp/ccswitch-deepseek.log ;;
            minimax)  cat /tmp/ccswitch-minimax.log 2>/dev/null  || echo "(empty)"; echo; echo "=== following ==="; tail -f /tmp/ccswitch-minimax.log ;;
        esac ;;
esac
