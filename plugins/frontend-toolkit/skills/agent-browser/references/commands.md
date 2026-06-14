# agent-browser Command Reference (v0.22.x)

150+ commands, 100% Native Rust. All commands run as `agent-browser <command>`.

## Table of Contents

- [Navigation](#navigation)
- [Snapshot](#snapshot)
- [Interaction](#interaction)
- [Keyboard](#keyboard)
- [Extraction](#extraction)
- [Check State](#check-state)
- [Wait](#wait)
- [Scroll](#scroll)
- [Mouse](#mouse)
- [Semantic Find](#semantic-find)
- [Screenshot](#screenshot)
- [Recording](#recording)
- [Clipboard](#clipboard)
- [Diff](#diff)
- [Batch](#batch)
- [Session and State](#session-and-state)
- [Auth Vault](#auth-vault)
- [Cookies and Storage](#cookies-and-storage)
- [Network](#network)
- [Console](#console)
- [Dialog Handling](#dialog-handling)
- [Tab Management](#tab-management)
- [Frame Management](#frame-management)
- [Browser Emulation](#browser-emulation)
- [Stream (Live Preview)](#stream-live-preview)
- [Profiler](#profiler)
- [JavaScript Execution](#javascript-execution)
- [Debugging](#debugging)
- [Browser Control](#browser-control)
- [Global Flags](#global-flags)
- [Environment Variables](#environment-variables)

## Navigation

| Command | Description |
|---------|-------------|
| `navigate <url>` | Navigate to URL (starts browser if needed) |
| `back` | Go back in history |
| `forward` | Go forward in history |
| `reload` | Reload current page |
| `close` | Close browser |

## Snapshot

| Command | Description |
|---------|-------------|
| `snapshot` | Get page snapshot (compact element list) |
| `snapshot -i` | Interactive snapshot with clickable refs (@e1, @e2...) |
| `snapshot -c` | Cursor-focused snapshot |
| `snapshot -s` | Structure-only snapshot (DOM tree) |
| `snapshot -d` | Detailed snapshot with full attributes |

Output format: `@e1 [button] "Submit"`, `@e2 [input type="email"]`

## Interaction

| Command | Description |
|---------|-------------|
| `click @ref` | Click element |
| `dblclick @ref` | Double-click element |
| `fill @ref "text"` | Clear field then type text (for inputs) |
| `type @ref "text"` | Append text without clearing |
| `press @ref "key"` | Press key on focused element |
| `select @ref "value"` | Select dropdown option |
| `check @ref` | Check checkbox |
| `uncheck @ref` | Uncheck checkbox |
| `hover @ref` | Hover over element |
| `drag @from @to` | Drag element to target |
| `clear @ref` | Clear input field |
| `focus @ref` | Focus element |
| `blur @ref` | Remove focus from element |

## Keyboard

| Command | Description |
|---------|-------------|
| `keyboard type "text"` | Type text with key events |
| `keyboard inserttext "text"` | Insert text directly (no key events) |
| `keyboard press "key"` | Press key (e.g. Enter, Tab, ArrowDown, Control+a) |

## Extraction

| Command | Description |
|---------|-------------|
| `get text @ref` | Get element text content |
| `get html @ref` | Get element outer HTML |
| `get value @ref` | Get input/select value |
| `get attribute @ref "name"` | Get element attribute by name |
| `get count @ref` | Count matching elements |
| `get box @ref` | Get bounding box (x, y, width, height) |
| `get styles @ref` | Get computed styles |
| `get title` | Get page title |
| `get url` | Get current URL |

## Check State

| Command | Description |
|---------|-------------|
| `is visible @ref` | Check if element is visible |
| `is enabled @ref` | Check if element is enabled |
| `is checked @ref` | Check if checkbox/radio is checked |
| `is editable @ref` | Check if element is editable |

## Wait

| Command | Description |
|---------|-------------|
| `wait @ref` | Wait for element to appear |
| `wait --load <state>` | Wait for load state (e.g. networkidle) |
| `wait --text "text"` | Wait for text to appear on page |
| `wait --url "pattern"` | Wait for URL to match pattern |
| `wait --function "js"` | Wait for JS expression to return truthy |
| `wait <ms>` | Wait specified milliseconds |

## Scroll

| Command | Description |
|---------|-------------|
| `scroll @ref` | Scroll element into view |
| `scroll up` | Scroll up |
| `scroll down` | Scroll down |
| `scroll left` | Scroll left |
| `scroll right` | Scroll right |
| `scroll --to top` | Scroll to top of page |
| `scroll --to bottom` | Scroll to bottom of page |

## Mouse

| Command | Description |
|---------|-------------|
| `mouse move <x> <y>` | Move mouse to coordinates |
| `mouse down` | Press mouse button |
| `mouse up` | Release mouse button |
| `mouse click <x> <y>` | Click at coordinates |
| `mouse dblclick <x> <y>` | Double-click at coordinates |
| `mouse wheel <deltaX> <deltaY>` | Scroll wheel (positive = down/right) |

## Semantic Find

| Command | Description |
|---------|-------------|
| `find role "button"` | Find element by ARIA role |
| `find text "Submit"` | Find element by visible text |
| `find label "Email"` | Find input by associated label |
| `find placeholder "Search"` | Find input by placeholder text |
| `find nth 2` | Select nth matching element (0-indexed) |

## Screenshot

| Command | Description |
|---------|-------------|
| `screenshot [path]` | Take viewport screenshot |
| `screenshot --full [path]` | Full page screenshot |
| `screenshot --annotate [path]` | Screenshot with element annotations |
| `pdf [path]` | Save page as PDF |

Flags: `--screenshot-format png|jpeg`, `--screenshot-quality 0-100`, `--screenshot-dir <path>`

## Recording

| Command | Description |
|---------|-------------|
| `record start [path]` | Start video recording |
| `record stop` | Stop recording |
| `record restart` | Stop current and start new recording |

Output: WebM (VP9), no audio. Use for bug documentation, test evidence, and flow documentation.

## Clipboard

| Command | Description |
|---------|-------------|
| `clipboard read` | Read clipboard contents |
| `clipboard write "text"` | Write text to clipboard |
| `clipboard copy @ref` | Copy element content to clipboard |
| `clipboard paste @ref` | Paste clipboard content into element |

## Diff

| Command | Description |
|---------|-------------|
| `diff snapshot <file1> <file2>` | Compare two snapshots |
| `diff screenshot <file1> <file2>` | Compare two screenshots visually |
| `diff url <url1> <url2>` | Compare two URLs side by side |

## Batch

Reads a JSON array of commands from stdin:

```bash
echo '[{"command":"navigate","args":["https://example.com"]},{"command":"snapshot","args":["-i"]}]' | agent-browser batch
```

## Session and State

| Command | Description |
|---------|-------------|
| `--session-name <name>` | Use named session (auto-save/restore) |
| `state save <name>` | Save current session state |
| `state load <name>` | Load saved session state |
| `state list` | List all saved states |
| `state show <name>` | Show details of saved state |
| `state rename <old> <new>` | Rename a saved state |
| `state clear <name>` | Delete a saved state |
| `state clean` | Remove all expired states |

## Auth Vault

| Command | Description |
|---------|-------------|
| `auth save <name>` | Save current auth state (encrypted) |
| `auth login <name>` | Restore saved auth state |

Encrypted storage uses AES-256-GCM. Set `AGENT_BROWSER_ENCRYPTION_KEY` for the encryption key.

## Cookies and Storage

| Command | Description |
|---------|-------------|
| `cookies` | Get all cookies |
| `cookies set <name> <value> [--domain <d>]` | Set a cookie |
| `cookies clear` | Clear all cookies |
| `storage local` | Get all localStorage entries |
| `storage local get <key>` | Get localStorage value |
| `storage local set <key> <value>` | Set localStorage value |
| `storage session` | Get all sessionStorage entries |
| `storage session get <key>` | Get sessionStorage value |
| `storage session set <key> <value>` | Set sessionStorage value |

## Network

| Command | Description |
|---------|-------------|
| `network requests [--type <type>] [--method <method>] [--status <code>]` | List tracked requests with optional filters |
| `network request <id>` | Get details of specific request |
| `network route <pattern> --body <response>` | Mock response for matching requests |
| `network route <pattern> --abort` | Block matching requests |
| `network har start [path]` | Start HAR recording |
| `network har stop` | Stop HAR recording |

## Console

| Command | Description |
|---------|-------------|
| `console` | Get all console messages |
| `console --type error\|warning\|log` | Filter by message type |
| `errors` | Get page errors (shortcut for `console --type error`) |

## Dialog Handling

| Command | Description |
|---------|-------------|
| `dialog accept ["text"]` | Accept alert/confirm/prompt (optional input text) |
| `dialog dismiss` | Dismiss/cancel dialog |
| `dialog status` | Check current dialog state |

## Tab Management

| Command | Description |
|---------|-------------|
| `tab new [url]` | Create new tab (optionally navigate to URL) |
| `tab list` | List open tabs |
| `tab switch <id>` | Switch to tab by ID |
| `tab close [id]` | Close tab (current if no ID) |

## Frame Management

| Command | Description |
|---------|-------------|
| `frame list` | List all frames |
| `frame select <id>` | Switch to frame by ID |
| `frame main` | Switch back to main frame |

## Browser Emulation

| Command | Description |
|---------|-------------|
| `set viewport <width> <height>` | Set viewport dimensions |
| `set device "iPhone 15"` | Emulate device (viewport, UA, touch) |
| `set geo <lat> <lon>` | Set geolocation |
| `set offline true\|false` | Toggle offline mode |
| `set media <feature> <value>` | Set media feature (e.g. prefers-reduced-motion) |
| `set color-scheme dark\|light` | Set preferred color scheme |

## Stream (Live Preview)

| Command | Description |
|---------|-------------|
| `stream enable [--port <port>]` | Enable live preview WebSocket stream |
| `stream status` | Check stream status |
| `stream disable` | Disable live preview stream |

WebSocket at `ws://localhost:9223` for live headless session preview. Configure port with `AGENT_BROWSER_STREAM_PORT`.

## Profiler

| Command | Description |
|---------|-------------|
| `profiler start [path]` | Start performance profiling |
| `profiler stop` | Stop profiling and save results |

## JavaScript Execution

| Command | Description |
|---------|-------------|
| `eval "expression"` | Execute JavaScript expression |
| `eval --stdin <<'EOF' ... EOF` | Execute multi-line JavaScript from stdin |

## Debugging

| Command | Description |
|---------|-------------|
| `--headed` | Show browser window (visible mode) |
| `highlight @ref` | Highlight element visually |
| `inspect` | Open DevTools |
| `trace start` | Start recording trace |
| `trace stop` | Stop and save trace |
| `get cdp-url` | Get Chrome DevTools Protocol URL |

## Browser Control

| Flag | Description |
|------|-------------|
| `--executable-path <path>` | Path to browser executable |
| `--engine chrome\|lightpanda` | Browser engine selection |
| `--extension <path>` | Load browser extension |
| `--args <browser-args>` | Additional browser arguments |
| `--auto-connect` | Auto-connect to running browser |
| `--download-path <path>` | Default download directory |
| `--idle-timeout <ms>` | Idle timeout before auto-close |

## Global Flags

| Flag | Description |
|------|-------------|
| `--session-name <name>` | Named session (isolated browser context) |
| `--headed` | Show browser window |
| `--json` | Machine-readable JSON output |
| `--timeout <ms>` | Command timeout in milliseconds |
| `--proxy <url>` | Proxy server URL |
| `--proxy-bypass <list>` | Comma-separated proxy bypass list |
| `--user-agent <ua>` | Custom user agent string |
| `--profile <path>` | Browser profile directory |
| `--state <path>` | State storage directory |
| `--config <path>` | Config file path |
| `--provider <name>` | Browser provider |
| `--content-boundaries` | Include content boundary markers |
| `--allowed-domains <list>` | Restrict navigation to listed domains |
| `--action-policy <path>` | Action policy file path |
| `--annotate` | Annotate screenshots with element refs |
| `--max-output <chars>` | Maximum output character count |
| `--color-scheme dark\|light` | Preferred color scheme |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `AGENT_BROWSER_SESSION_NAME` | Default session name |
| `AGENT_BROWSER_PROFILE` | Browser profile directory |
| `AGENT_BROWSER_STATE` | State storage directory |
| `AGENT_BROWSER_EXECUTABLE_PATH` | Path to browser executable |
| `AGENT_BROWSER_EXTENSIONS` | Browser extensions to load |
| `AGENT_BROWSER_ARGS` | Additional browser arguments |
| `AGENT_BROWSER_USER_AGENT` | Default user agent string |
| `AGENT_BROWSER_PROXY` | Proxy server URL |
| `AGENT_BROWSER_PROXY_BYPASS` | Proxy bypass list |
| `AGENT_BROWSER_CONTENT_BOUNDARIES` | Enable content boundary markers |
| `AGENT_BROWSER_MAX_OUTPUT` | Maximum output character count |
| `AGENT_BROWSER_ALLOWED_DOMAINS` | Restrict navigation to listed domains |
| `AGENT_BROWSER_ACTION_POLICY` | Action policy file path |
| `AGENT_BROWSER_ANNOTATE` | Enable screenshot annotations |
| `AGENT_BROWSER_SCREENSHOT_DIR` | Default screenshot directory |
| `AGENT_BROWSER_SCREENSHOT_FORMAT` | Screenshot format (png or jpeg) |
| `AGENT_BROWSER_SCREENSHOT_QUALITY` | Screenshot quality (0-100) |
| `AGENT_BROWSER_AUTO_CONNECT` | Auto-connect to running browser |
| `AGENT_BROWSER_PROVIDER` | Browser provider |
| `AGENT_BROWSER_CONFIG` | Config file path |
| `AGENT_BROWSER_ENGINE` | Browser engine (chrome or lightpanda) |
| `AGENT_BROWSER_DOWNLOAD_PATH` | Default download directory |
| `AGENT_BROWSER_IDLE_TIMEOUT_MS` | Idle timeout before auto-close |
| `AGENT_BROWSER_DEFAULT_TIMEOUT` | Default command timeout (ms) |
| `AGENT_BROWSER_ENCRYPTION_KEY` | Encryption key for auth vault (AES-256-GCM) |
| `AGENT_BROWSER_STATE_EXPIRE_DAYS` | Days before saved states expire |
| `AGENT_BROWSER_STREAM_PORT` | WebSocket stream port (default: 9223) |
| `HTTP_PROXY` | HTTP proxy (standard) |
| `HTTPS_PROXY` | HTTPS proxy (standard) |
| `ALL_PROXY` | Universal proxy (standard) |
| `NO_PROXY` | Proxy bypass list (standard) |
