.PHONY: dev clean install help status stop kill-all tunnel-url

# Colors
GREEN = \033[0;32m
YELLOW = \033[1;33m
BLUE = \033[0;34m
RED = \033[0;31m
NC = \033[0m

# Process patterns
NPM_PATTERNS = "pnpm.*start" "npm.*start" "nest.*start" "node.*dist/main" "node.*knowledge-ai"
LT_PATTERNS = "npx.*localtunnel" "localtunnel.*--port" "lt.*--port"
PID_FILES = .npm.pid .lt.pid
LOG_FILES = tunnel.log npm.log

# Helper function to kill processes
define kill_processes
	@for pattern in $(1); do \
		if pkill $(2) -f $$pattern 2>/dev/null; then \
			echo "  ✓ Killed $$pattern processes"; \
		else \
			echo "  - No $$pattern processes found"; \
		fi; \
	done
endef

# Helper function to clean files
define clean_files
	@rm -f $(1) 2>/dev/null || true
endef

help:
	@echo "$(GREEN)Available commands:$(NC)"
	@echo "  $(BLUE)make dev$(NC)      - Start development server with localtunnel"
	@echo "  $(BLUE)make install$(NC)  - Install dependencies"
	@echo "  $(BLUE)make stop$(NC)     - Stop background services"
	@echo "  $(BLUE)make clean$(NC)    - Force kill all processes"
	@echo "  $(BLUE)make kill-all$(NC) - Nuclear option: kill ALL related processes"
	@echo "  $(BLUE)make status$(NC)   - Check service status"
	@echo "  $(BLUE)make tunnel-url$(NC) - Show current tunnel URL"

install:
	@echo "$(YELLOW)Installing dependencies...$(NC)"
	@pnpm install
	@echo "$(GREEN)✅ Dependencies installed!$(NC)"

dev:
	@echo "$(GREEN)🚀 Starting development environment...$(NC)"
	@echo "$(YELLOW)Starting localtunnel...$(NC)"
	@nohup npx localtunnel --port 3000 > tunnel.log 2>&1 & echo $$! > .lt.pid
	@echo "$(BLUE)⏳ Waiting for tunnel URL...$(NC)"
	@for i in 1 2 3 4 5 6 7 8 9 10; do \
		TUNNEL_URL=$$(grep -o 'https://[^[:space:]]*\.loca\.lt' tunnel.log 2>/dev/null); \
		if [ -n "$$TUNNEL_URL" ]; then \
			echo "$(GREEN)✅ Tunnel ready!$(NC)"; \
			break; \
		fi; \
		echo "  Getting tunnel URL... ($$i/10)"; \
		sleep 2; \
	done
	@echo "$(BLUE)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(NC)"
	@echo "$(YELLOW)📋 SLACK CONFIGURATION$(NC)"
	@echo "$(BLUE)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(NC)"
	@TUNNEL_URL=$$(grep -o 'https://[^[:space:]]*\.loca\.lt' tunnel.log 2>/dev/null); \
	if [ -n "$$TUNNEL_URL" ]; then \
		echo "$(GREEN)🌐 Tunnel URL: $$TUNNEL_URL$(NC)"; \
		echo "$(YELLOW)📝 Event Subscription URL: $(BLUE)$$TUNNEL_URL/slack/events$(NC)"; \
		echo "$(YELLOW)🔗 Slack API: $(BLUE)https://api.slack.com/apps$(NC)"; \
	else \
		echo "$(RED)🌐 Tunnel URL: Not available yet$(NC)"; \
		echo "$(YELLOW)📝 Use 'make tunnel-url' to check later$(NC)"; \
		echo "$(YELLOW)🔗 Slack API: $(BLUE)https://api.slack.com/apps$(NC)"; \
	fi
	@echo "$(BLUE)━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$(NC)"
	@echo "$(YELLOW)Starting NestJS server... (Ctrl+C to stop all services)$(NC)"
	@echo ""
	@cleanup() { \
		echo ""; \
		echo "$(YELLOW)🧹 Stopping services...$(NC)"; \
		[ -f .lt.pid ] && kill $$(cat .lt.pid) 2>/dev/null; \
		$(call clean_files,$(PID_FILES) $(LOG_FILES)); \
		echo "$(GREEN)✅ Services stopped!$(NC)"; \
		exit 0; \
	}; \
	trap cleanup INT TERM; \
	pnpm start || cleanup

stop:
	@echo "$(YELLOW)🛑 Stopping services...$(NC)"
	@[ -f .npm.pid ] && kill $$(cat .npm.pid) 2>/dev/null || $(call kill_processes,$(NPM_PATTERNS),-TERM)
	@[ -f .lt.pid ] && kill $$(cat .lt.pid) 2>/dev/null || $(call kill_processes,$(LT_PATTERNS),-TERM)
	@$(call clean_files,$(PID_FILES) $(LOG_FILES))
	@echo "$(GREEN)✅ Services stopped!$(NC)"

clean:
	@echo "$(YELLOW)🧹 Force killing processes...$(NC)"
	@$(call kill_processes,$(NPM_PATTERNS),-9)
	@$(call kill_processes,$(LT_PATTERNS),-9)
	@$(call clean_files,$(PID_FILES) $(LOG_FILES))
	@echo "$(GREEN)✅ Force cleanup completed!$(NC)"

kill-all:
	@echo "$(RED)💀 NUCLEAR OPTION: Killing ALL related processes...$(NC)"
	@$(call kill_processes,$(NPM_PATTERNS),-9)
	@$(call kill_processes,$(LT_PATTERNS),-9)
	@lsof -ti:3000 | xargs kill -9 2>/dev/null && echo "  ✓ Killed port 3000 processes" || echo "  - No port 3000 processes"
	@$(call clean_files,$(PID_FILES) $(LOG_FILES))
	@echo "$(GREEN)💀 Nuclear cleanup completed!$(NC)"

status:
	@echo "$(YELLOW)📊 Service Status:$(NC)"
	@for file in $(PID_FILES); do \
		if [ -f $$file ]; then \
			pid=$$(cat $$file); \
			if ps -p $$pid > /dev/null 2>&1; then \
				echo "  $(GREEN)✅ $$file: Running (PID: $$pid)$(NC)"; \
			else \
				echo "  $(RED)❌ $$file: Dead (PID: $$pid)$(NC)"; \
			fi; \
		else \
			echo "  $(YELLOW)- $$file: Not found$(NC)"; \
		fi; \
	done
	@for pattern in $(NPM_PATTERNS) $(LT_PATTERNS); do \
		if pgrep -f $$pattern > /dev/null 2>&1; then \
			echo "  $(GREEN)✅ Found $$pattern process$(NC)"; \
		fi; \
	done

tunnel-url:
	@if [ -f tunnel.log ]; then \
		TUNNEL_URL=$$(grep -o 'https://[^[:space:]]*\.loca\.lt' tunnel.log 2>/dev/null); \
		if [ -n "$$TUNNEL_URL" ]; then \
			echo "$(GREEN)🌐 Current Tunnel URL: $$TUNNEL_URL$(NC)"; \
			echo "$(YELLOW)📝 Event Subscription URL: $(BLUE)$$TUNNEL_URL/slack/events$(NC)"; \
			echo "$(YELLOW)🔗 Slack API: $(BLUE)https://api.slack.com/apps$(NC)"; \
		else \
			echo "$(RED)❌ No tunnel URL found in log file$(NC)"; \
			echo "$(YELLOW)💡 Try running 'make dev' first$(NC)"; \
		fi; \
	else \
		echo "$(RED)❌ No tunnel log file found$(NC)"; \
		echo "$(YELLOW)💡 Try running 'make dev' first$(NC)"; \
	fi 