# MockForge UI Design Skill

## For AI Agents Building the MockForge Dashboard

**Version:** 1.0.0  
**Stack:** React 18 + Vite + CSS Modules (or plain CSS variables — no Tailwind required)  
**Served at:** `http://localhost:5000/dashboard`  
**Audience:** AI agents and developers implementing the MockForge React dashboard

> Read this entire document before writing a single line of UI code.  
> Every value here is intentional. Deviation produces inconsistency.

---

## 1. Design Identity

### 1.1 Concept

MockForge's dashboard is a **terminal-born developer tool that learned to live in a browser.** It should feel like someone took a beautiful CLI and gave it a window — dark, dense, precise, alive with real-time data. Think VS Code meets Raycast meets a network traffic monitor.

**The one feeling to chase:** Watching a server breathe in real time. Every request that comes in should feel like a heartbeat — visible, timestamped, immediate.

**What to avoid:**
- Generic SaaS dashboards (white backgrounds, rounded everything, pastel cards)
- "Dark mode Tailwind" defaults (gray-800 / gray-900 soup with no personality)
- Decorative animations that don't carry information

### 1.2 Aesthetic Direction

| Property | Decision | Reasoning |
|---|---|---|
| Theme | **Dark only** | Developers run this next to their code editor. Match that environment. |
| Density | **Medium-high** | A lot of information must be visible at once without scrolling. |
| Motion | **Functional only** | New log entries slide in. Toasts fade. Nothing spins for decoration. |
| Typography | **Monospace accents** | Route paths, IDs, status codes, and timestamps always use monospace. |
| Personality | **Amber accent on dark** | Warm amber on near-black reads as "live system" — think terminal prompts and network monitors. |

---

## 2. Design Tokens

Define these as CSS custom properties on `:root`. Every component reads from these — **never hardcode a color hex anywhere else.**

```css
:root {
  /* ── Backgrounds ───────────────────────────────────────── */
  --bg-base:       #0c0c0e;   /* outermost shell — almost black */
  --bg-surface:    #131316;   /* panels, sidebar */
  --bg-elevated:   #1c1c21;   /* cards, inputs, dropdowns */
  --bg-highlight:  #252530;   /* hover states, selected rows */

  /* ── Borders ───────────────────────────────────────────── */
  --border-dim:    rgba(255,255,255,0.06);   /* subtle dividers */
  --border-mid:    rgba(255,255,255,0.11);   /* component edges */
  --border-strong: rgba(255,255,255,0.18);   /* focused inputs */

  /* ── Text ──────────────────────────────────────────────── */
  --text-primary:   #e8e8ee;   /* headings, active labels */
  --text-secondary: #9898a8;   /* descriptions, subtitles */
  --text-muted:     #55555f;   /* disabled, placeholder */

  /* ── Accent (Amber) ────────────────────────────────────── */
  --accent:         #f59e0b;   /* primary accent — cursor, active nav, badges */
  --accent-dim:     rgba(245, 158, 11, 0.12);  /* accent backgrounds (subtle) */
  --accent-border:  rgba(245, 158, 11, 0.30);  /* accent borders */

  /* ── Status Colors ─────────────────────────────────────── */
  --status-2xx:     #34d399;   /* green — success */
  --status-2xx-bg:  rgba(52, 211, 153, 0.10);
  --status-3xx:     #60a5fa;   /* blue — redirect */
  --status-3xx-bg:  rgba(96, 165, 250, 0.10);
  --status-4xx:     #f87171;   /* red — client error */
  --status-4xx-bg:  rgba(248, 113, 113, 0.10);
  --status-5xx:     #c084fc;   /* purple — server error */
  --status-5xx-bg:  rgba(192, 132, 252, 0.10);

  /* ── HTTP Method Colors ────────────────────────────────── */
  --method-get:     #34d399;   /* green */
  --method-post:    #60a5fa;   /* blue */
  --method-put:     #fbbf24;   /* amber */
  --method-patch:   #a78bfa;   /* violet */
  --method-delete:  #f87171;   /* red */

  /* ── Typography ────────────────────────────────────────── */
  --font-ui:    'DM Sans', system-ui, sans-serif;
  --font-mono:  'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;

  /* ── Spacing ───────────────────────────────────────────── */
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;

  /* ── Radius ────────────────────────────────────────────── */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 10px;

  /* ── Transitions ───────────────────────────────────────── */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --duration-fast: 120ms;
  --duration-mid:  200ms;
}
```

**Font loading** — add to your `index.html` `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

---

## 3. Layout Architecture

### 3.1 Shell Structure

```
┌──────────────────────────────────────────────────────────────┐
│  TOPBAR  (56px fixed)                                        │
│  Logo · Server status · Port · Uptime · Reset button        │
├──────────┬───────────────────────────────────────────────────┤
│          │                                                   │
│ SIDEBAR  │  MAIN CONTENT AREA                               │
│ (220px   │  (flex-1, scrollable)                            │
│  fixed)  │                                                   │
│          │  Active panel renders here based on sidebar nav   │
│  Nav     │                                                   │
│  items   │                                                   │
│          │                                                   │
│  Stats   │                                                   │
│  at      │                                                   │
│  bottom  │                                                   │
│          │                                                   │
└──────────┴───────────────────────────────────────────────────┘
```

### 3.2 CSS Layout Implementation

```css
/* App shell */
.app-shell {
  display: grid;
  grid-template-rows: 56px 1fr;
  grid-template-columns: 220px 1fr;
  grid-template-areas:
    "topbar topbar"
    "sidebar main";
  height: 100vh;
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-ui);
  overflow: hidden;
}

.topbar  { grid-area: topbar;  }
.sidebar { grid-area: sidebar; }
.main    { grid-area: main; overflow-y: auto; }
```

### 3.3 Responsive Behaviour

At viewport width < 768px (mobile / narrow window):
- Sidebar collapses to a bottom tab bar (4 icon-only tabs)
- Topbar hides the uptime and port indicators, retains logo + reset button
- This is secondary priority — build desktop first

---

## 4. Component Specifications

Each component specification defines: visual anatomy, exact CSS values, and the data it consumes from the MockForge API.

---

### 4.1 Topbar

**Height:** 56px fixed  
**Background:** `var(--bg-surface)`  
**Border-bottom:** `1px solid var(--border-dim)`

**Layout (left → right):**
```
[Logo + Wordmark]  [·]  [Server Status Pill]  [Spacer →]  [Port Badge]  [Uptime]  [Reset Button]
```

**Logo:** A small forge/anvil-inspired SVG mark (or simply `⬡` unicode in amber) + the word "MockForge" in `var(--font-ui)` weight 600, `var(--text-primary)`. Size: 18px.

**Server Status Pill:**
```css
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  background: rgba(52, 211, 153, 0.10);
  color: var(--status-2xx);
  border: 1px solid rgba(52, 211, 153, 0.20);
}

.status-pill::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--status-2xx);
  box-shadow: 0 0 0 2px rgba(52, 211, 153, 0.25);
  animation: pulse-dot 2s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
```

**Port Badge:**
```css
.port-badge {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-elevated);
  border: 1px solid var(--border-dim);
  border-radius: var(--radius-sm);
  padding: 2px 8px;
}
/* Renders: :5000 */
```

**Uptime Counter:** Plain text, `var(--font-mono)`, 12px, `var(--text-muted)`. Format: `12m 34s` or `2h 04m`. Update every second with `setInterval`.

**Reset Button:**
```css
.btn-reset {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-mid);
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-family: var(--font-ui);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.btn-reset:hover {
  border-color: var(--status-4xx);
  color: var(--status-4xx);
  background: rgba(248, 113, 113, 0.08);
}
```

Show a confirmation state (2s) before calling `POST /api/reset`:
```
Normal:    [↺ Reset Data]
Confirm:   [Are you sure? →]   ← red border, 2s to click or cancel
Loading:   [Resetting…]        ← spinner icon
Success:   [✓ 30 records]      ← green, fades after 2s
```

---

### 4.2 Sidebar Navigation

**Width:** 220px  
**Background:** `var(--bg-surface)`  
**Border-right:** `1px solid var(--border-dim)`  
**Padding:** `var(--space-4)`

**Nav Items:**

| Icon | Label | Panel |
|---|---|---|
| `⊞` (grid) | Routes | Route list grouped by model |
| `≋` (lines) | Live Log | Real-time SSE request stream |
| `{ }` | Schema | Schema editor + reload |
| `⊡` (table) | Explorer | Data browser |

**Active nav item style:**
```css
.nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 8px var(--space-3);
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--duration-fast);
  border: 1px solid transparent;
}

.nav-item:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

.nav-item.active {
  color: var(--accent);
  background: var(--accent-dim);
  border-color: var(--accent-border);
}

.nav-item .nav-icon {
  width: 16px;
  height: 16px;
  opacity: 0.7;
}

.nav-item.active .nav-icon {
  opacity: 1;
}
```

**Bottom section (below a `margin-top: auto` spacer):**
Show three small stat chips stacked vertically:
```
Models    4
Records   40
Requests  127
```
Each is a single row:  `font-size: 11px`, label in `var(--text-muted)`, value in `var(--font-mono)` `var(--text-secondary)`. Update via polling `GET /api/_stats` every 5 seconds.

---

### 4.3 Routes Panel

**This is the default panel shown on load.**

**Layout:** Two-column grid at large widths; single column on narrow screens.  
Left column: model list (index). Right column: route list for selected model.

**Model Index (left column):**
```
┌────────────────────────┐
│  users         10 rec  │  ← active
│  posts         10 rec  │
│  comments      10 rec  │
│  products      10 rec  │
└────────────────────────┘
```

```css
.model-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px var(--space-3);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 13px;
}

.model-item .model-name {
  font-family: var(--font-mono);
  color: var(--text-secondary);
  font-size: 13px;
}

.model-item .model-count {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}

.model-item:hover     { background: var(--bg-elevated); }
.model-item.selected  { background: var(--bg-elevated); }
.model-item.selected .model-name { color: var(--accent); }
```

**Route List (right column):**

For the selected model, show all six routes as cards:

```
┌─────────────────────────────────────────────────────┐
│  GET    /api/users                                  │
│         Returns all records. Supports ?_limit=N     │
│                                         [Copy curl] │
└─────────────────────────────────────────────────────┘
```

```css
.route-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border-dim);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
  transition: border-color var(--duration-fast);
}

.route-card:hover {
  border-color: var(--border-mid);
}

.route-card .route-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.route-card .route-path {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text-primary);
}

.route-card .route-desc {
  font-size: 12px;
  color: var(--text-muted);
}
```

**HTTP Method Badges — critical, use these exact styles:**

```css
.method-badge {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  min-width: 52px;
  text-align: center;
  letter-spacing: 0.04em;
}

.method-GET    { color: var(--method-get);    background: rgba(52,  211, 153, 0.10); }
.method-POST   { color: var(--method-post);   background: rgba(96,  165, 250, 0.10); }
.method-PUT    { color: var(--method-put);    background: rgba(251, 191,  36, 0.10); }
.method-PATCH  { color: var(--method-patch);  background: rgba(167, 139, 250, 0.10); }
.method-DELETE { color: var(--method-delete); background: rgba(248, 113, 113, 0.10); }
```

**Copy curl button:**
```css
.btn-copy-curl {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-muted);
  background: transparent;
  border: 1px solid var(--border-dim);
  border-radius: var(--radius-sm);
  padding: 3px 8px;
  cursor: pointer;
  font-family: var(--font-ui);
  transition: all var(--duration-fast);
}
.btn-copy-curl:hover { color: var(--text-secondary); border-color: var(--border-mid); }

/* After copying: change text to "Copied!" for 1.5s */
```

**Generated curl example** (client-side, no API call needed):
```javascript
function buildCurl(method, path, baseUrl = 'http://localhost:5000') {
  const bodyFlag = ['POST','PUT','PATCH'].includes(method)
    ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '{}'`
    : '';
  return `curl -X ${method} ${baseUrl}${path}${bodyFlag}`;
}
```

---

### 4.4 Live Log Panel

**This is the signature panel of MockForge. Get this right.**

**Data source:** `GET /api/_logs/stream` (Server-Sent Events)  
**Max entries displayed:** 200 (drop oldest on overflow)  
**New entry animation:** slide in from top, 150ms ease-out

**Panel layout:**
```
┌──────────────────────────────────────────────────────────────┐
│  Live Log             [▶ Running]  [⏸ Pause]  [🗑 Clear]     │
├──────────────────────────────────────────────────────────────┤
│  Filter: [____________] [GET ▾] [2xx ▾]                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  14:23:01.482  GET    200  /api/users           12ms        │
│  14:23:02.011  POST   201  /api/posts            8ms        │
│  14:23:02.394  GET    404  /api/users/abc-xyz    3ms        │
│  14:23:04.891  DELETE 200  /api/posts/xyz-123    5ms        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Log entry structure:**
```jsx
function LogEntry({ entry }) {
  return (
    <div className={`log-entry ${isNew ? 'log-entry--entering' : ''}`}>
      <span className="log-time">{formatTime(entry.timestamp)}</span>
      <MethodBadge method={entry.method} />
      <StatusBadge status={entry.status} />
      <span className="log-path">{entry.path}</span>
      <span className="log-latency">{entry.ms}ms</span>
    </div>
  );
}
```

```css
.log-entry {
  display: grid;
  grid-template-columns: 96px 60px 44px 1fr 56px;
  align-items: center;
  gap: var(--space-3);
  padding: 6px var(--space-4);
  border-bottom: 1px solid var(--border-dim);
  font-size: 12px;
  transition: background var(--duration-fast);
}

.log-entry:hover { background: var(--bg-highlight); }

/* Slide-in animation for new entries */
.log-entry--entering {
  animation: log-slide-in 150ms var(--ease-out) both;
}

@keyframes log-slide-in {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
}

/* Timestamp */
.log-time {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  letter-spacing: 0.02em;
}

/* Path */
.log-path {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Highlight the :id segment in paths */
/* e.g. /api/users/:id → /api/users/<amber>:id</amber> */
.log-path-segment-param { color: var(--accent); }

/* Latency */
.log-latency {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  text-align: right;
}

/* Latency color thresholds */
.log-latency.fast   { color: var(--status-2xx); }  /* < 10ms */
.log-latency.medium { color: var(--accent); }       /* 10-50ms */
.log-latency.slow   { color: var(--status-4xx); }  /* > 50ms */
```

**Status badge (in log rows):**
```css
.status-badge {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  text-align: center;
}
/* Apply status color vars based on first digit of status code */
```

**Timestamp format:**
```javascript
function formatTime(isoString) {
  const d = new Date(isoString);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}
```

**Filter bar:**
- Text input: filters by path substring (case-insensitive, client-side, no API call)
- Method dropdown: ALL / GET / POST / PUT / PATCH / DELETE
- Status dropdown: ALL / 2xx / 3xx / 4xx / 5xx
- All filtering is purely client-side against the in-memory log array

**Pause / Resume:**
```javascript
// When paused: stop prepending new entries to the visible list.
// Buffer them. On resume: flush buffer to the top of the list.
// Show "N new" badge on the pause button while buffering.
```

**Empty state** (before first request comes in):
```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   Waiting for requests…                             │
│   Send a request to your mock API to see it here.  │
│                                                     │
│   curl http://localhost:5000/api/users              │
│                                                     │
└─────────────────────────────────────────────────────┘
```
The curl example uses `var(--font-mono)`, dim border, `var(--bg-elevated)` background. It's copyable.

---

### 4.5 Schema Editor Panel

**Purpose:** Paste a new schema JSON → click Reload → server re-parses, re-seeds, re-mounts routes without restart.

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  Schema Editor                                              │
│  Edit the JSON schema and click Reload to apply changes.   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  {                                                          │
│    "User": {                                               │
│      "id": "uuid",                                         │
│      "name": "string",                                     │
│      "email": "email"                                      │
│    }                                                        │
│  }                                                          │
│                                                             │
│  [Format JSON]                      [Reload Schema →]       │
└─────────────────────────────────────────────────────────────┘
```

**Textarea:**
```css
.schema-editor {
  width: 100%;
  min-height: 320px;
  background: var(--bg-base);
  border: 1px solid var(--border-mid);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-primary);
  resize: vertical;
  outline: none;
  transition: border-color var(--duration-fast);
  tab-size: 2;
}

.schema-editor:focus {
  border-color: var(--border-strong);
}

.schema-editor.error {
  border-color: var(--status-4xx);
}
```

**Validation** (client-side, before sending to server):
```javascript
function validateSchema(text) {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed !== 'object' || Array.isArray(parsed))
      return { valid: false, error: 'Schema must be a JSON object at the top level.' };
    if (Object.keys(parsed).length === 0)
      return { valid: false, error: 'Schema is empty — add at least one model.' };
    return { valid: true };
  } catch (e) {
    return { valid: false, error: `Invalid JSON: ${e.message}` };
  }
}
```

**Error display:** Red text, 12px, `var(--status-4xx)`, appears directly below the textarea. Never a modal. Never blocks the editor.

**Format JSON button:** Calls `JSON.stringify(JSON.parse(text), null, 2)` in-place. Only appears when JSON is valid.

**Reload button states:**
```
Idle:     [Reload Schema →]      — border: var(--accent-border), color: var(--accent)
Loading:  [Reloading…]           — disabled, spinner
Success:  [✓ Schema applied]     — green, 2s then back to idle
Error:    [✗ Parse failed]       — red, shows server error below
```

```css
.btn-reload {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 8px 20px;
  border-radius: var(--radius-md);
  border: 1px solid var(--accent-border);
  background: var(--accent-dim);
  color: var(--accent);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.btn-reload:hover:not(:disabled) {
  background: rgba(245, 158, 11, 0.20);
}

.btn-reload:disabled { opacity: 0.5; cursor: not-allowed; }
```

**After a successful reload**, the Routes panel (if open) must refresh its data automatically. Use a shared React context or event emitter for this.

---

### 4.6 Data Explorer Panel

**Purpose:** Browse the current in-memory records for any model. Useful for verifying seed data and watching mutations from external API calls.

**Layout:**
```
Model [users ▾]    Page 1 of 4    [← Prev]  [Next →]    [↻ Refresh]
───────────────────────────────────────────────────────────────────
id                 name              email                createdAt
────────────────────────────────────────────────────────────────────
uuid-a1b2c3...     Jane Doe          jane@faker.dev       2 min ago
uuid-d4e5f6...     John Smith        john@faker.dev       2 min ago
...
```

**Data source:** `GET /api/[model]?_limit=10&_page=N`

**Table:**
```css
.explorer-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.explorer-table th {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  text-align: left;
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--border-dim);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.explorer-table td {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-dim);
  color: var(--text-secondary);
  font-size: 12px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ID columns get monospace */
.explorer-table td.cell-id {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}

.explorer-table tr:hover td { background: var(--bg-highlight); }
```

**Long text cells:** truncate with `text-overflow: ellipsis` and show a tooltip with full text on hover.

**Relative timestamps:** use a simple `timeAgo()` function. No external library required.
```javascript
function timeAgo(isoString) {
  const seconds = Math.floor((Date.now() - new Date(isoString)) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}
```

---

## 5. Toast Notification System

Toasts appear in the bottom-right corner. Maximum 3 visible at once. Each auto-dismisses after 4 seconds.

```css
.toast-container {
  position: fixed;
  bottom: var(--space-5);
  right: var(--space-5);
  display: flex;
  flex-direction: column-reverse;
  gap: var(--space-2);
  z-index: 1000;
  pointer-events: none;
}

.toast {
  pointer-events: all;
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  background: var(--bg-elevated);
  border: 1px solid var(--border-mid);
  min-width: 260px;
  max-width: 380px;
  font-size: 13px;

  animation: toast-in 200ms var(--ease-out) both;
}

@keyframes toast-in {
  from { opacity: 0; transform: translateX(16px) scale(0.96); }
}

.toast.dismissing {
  animation: toast-out 180ms ease-in forwards;
}

@keyframes toast-out {
  to { opacity: 0; transform: translateX(16px) scale(0.96); }
}

/* Variants */
.toast.success { border-left: 3px solid var(--status-2xx); }
.toast.error   { border-left: 3px solid var(--status-4xx); }
.toast.info    { border-left: 3px solid var(--status-3xx); }

.toast .toast-icon { margin-top: 1px; flex-shrink: 0; }
.toast .toast-title   { font-weight: 500; color: var(--text-primary); }
.toast .toast-message { color: var(--text-secondary); margin-top: 2px; font-size: 12px; }
```

**Usage:**
```javascript
toast.success('Schema reloaded', 'Mounted 6 models · 60 records seeded');
toast.error('Reset failed', 'Server returned 500');
toast.info('Listening', 'Connected to log stream');
```

---

## 6. Empty States

Every panel needs a thoughtful empty state. These are the messages that appear before data loads or when nothing matches a filter.

| Panel | Trigger | Message | Visual |
|---|---|---|---|
| Live Log | No requests yet | "Waiting for requests…" + curl example | Dimmed terminal icon |
| Data Explorer | Model has 0 records | "No records found. Try calling POST /api/[model]" | Dimmed grid icon |
| Routes | No models parsed | "No models in schema. Paste a schema in the Schema Editor." | Dimmed schema icon |
| Schema Editor | First load | Pre-populate with the current active schema JSON | — |
| Log filter | Filter returns nothing | "No requests match your filter." + clear button | — |

**Empty state pattern:**
```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  padding: var(--space-10) var(--space-6);
  text-align: center;
}

.empty-state .empty-icon {
  opacity: 0.2;
  width: 40px;
  height: 40px;
}

.empty-state .empty-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

.empty-state .empty-desc {
  font-size: 13px;
  color: var(--text-muted);
  max-width: 300px;
  line-height: 1.6;
}

.empty-state .empty-code {
  font-family: var(--font-mono);
  font-size: 12px;
  padding: var(--space-3) var(--space-4);
  background: var(--bg-elevated);
  border: 1px solid var(--border-dim);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
}
```

---

## 7. Loading States

**Skeleton loaders** — not spinners — for panel content that hasn't loaded yet.

```css
.skeleton {
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
  position: relative;
  overflow: hidden;
}

.skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255,255,255,0.04) 50%,
    transparent 100%
  );
  animation: shimmer 1.6s ease-in-out infinite;
}

@keyframes shimmer {
  from { transform: translateX(-100%); }
  to   { transform: translateX(100%); }
}

/* Size variants */
.skeleton-row    { height: 36px; margin-bottom: var(--space-2); }
.skeleton-short  { width: 40%; }
.skeleton-medium { width: 65%; }
.skeleton-long   { width: 90%; }
```

Use 3–5 skeleton rows on first panel load. Replace with real content when API responds.

---

## 8. Scrollbar Styling

Style scrollbars in all scrollable panels to match the dark theme:

```css
* {
  scrollbar-width: thin;
  scrollbar-color: var(--bg-highlight) transparent;
}

*::-webkit-scrollbar       { width: 6px; height: 6px; }
*::-webkit-scrollbar-track { background: transparent; }
*::-webkit-scrollbar-thumb {
  background: var(--bg-highlight);
  border-radius: 999px;
}
*::-webkit-scrollbar-thumb:hover { background: var(--border-mid); }
```

---

## 9. Global Base Reset

```css
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body, #root {
  height: 100%;
  overflow: hidden;
}

body {
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: var(--font-ui);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

button {
  font-family: inherit;
  cursor: pointer;
}

input, textarea, select {
  font-family: inherit;
  font-size: inherit;
  color: inherit;
  background: var(--bg-elevated);
  border: 1px solid var(--border-mid);
  border-radius: var(--radius-md);
  padding: 6px var(--space-3);
  outline: none;
  transition: border-color var(--duration-fast);
}

input:focus, textarea:focus, select:focus {
  border-color: var(--border-strong);
}
```

---

## 10. React Component Map

```
App.jsx
├── AppShell.jsx                   ← grid layout wrapper
│   ├── Topbar.jsx
│   │   ├── Logo.jsx
│   │   ├── StatusPill.jsx
│   │   ├── PortBadge.jsx
│   │   ├── UptimeCounter.jsx
│   │   └── ResetButton.jsx
│   ├── Sidebar.jsx
│   │   ├── NavItem.jsx
│   │   └── StatsFooter.jsx
│   └── MainContent.jsx            ← renders active panel
│       ├── RoutesPanel.jsx
│       │   ├── ModelIndex.jsx
│       │   └── RouteCard.jsx
│       ├── LiveLogPanel.jsx
│       │   ├── LogEntry.jsx
│       │   ├── LogFilter.jsx
│       │   └── EmptyLogState.jsx
│       ├── SchemaPanel.jsx
│       │   ├── SchemaEditor.jsx
│       │   └── ValidationMessage.jsx
│       └── ExplorerPanel.jsx
│           ├── ExplorerTable.jsx
│           └── Pagination.jsx
├── ToastContainer.jsx
│   └── Toast.jsx
└── hooks/
    ├── useSSELog.js               ← manages EventSource connection + log array
    ├── useStats.js                ← polls GET /api/_stats every 5s
    ├── useRoutes.js               ← fetches GET /api/_routes
    ├── useUptime.js               ← counts up from server start time
    └── useToast.js                ← toast queue manager
```

---

## 11. API Calls Reference

All fetches go to the same origin. In development (Vite), the `vite.config.js` proxy forwards `/api/*` to Express `:5000`. In production, they hit the same Express server directly.

```javascript
// dashboard/src/api/client.js

const BASE = '';  // same-origin always

export async function getRoutes()           { return fetch(`${BASE}/api/_routes`).then(r => r.json()); }
export async function getStats()            { return fetch(`${BASE}/api/_stats`).then(r => r.json()); }
export async function resetData()           { return fetch(`${BASE}/api/reset`, { method: 'POST' }).then(r => r.json()); }
export async function reloadSchema(schema)  {
  return fetch(`${BASE}/api/_schema/reload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(schema)
  }).then(r => r.json());
}
export async function getModelData(model, page = 1, limit = 10) {
  return fetch(`${BASE}/api/${model}?_limit=${limit}&_page=${page}`).then(r => r.json());
}

// SSE — use EventSource directly in useSSELog hook
// new EventSource('/api/_logs/stream')
```

---

## 12. Do-Not Rules

These are the most common mistakes when building developer-tool dashboards. Avoid all of these:

| ❌ Don't | ✅ Do instead |
|---|---|
| Use white or light gray as the base background | `var(--bg-base)` — near-black |
| Put route paths in non-monospace font | Always `var(--font-mono)` for paths, IDs, status codes, timestamps |
| Use the same color for all HTTP method badges | Each method has a distinct color (see token table) |
| Show loading spinners for panel data | Use skeleton loaders |
| Use `alert()` or `confirm()` for the reset confirmation | Inline two-step button state |
| Auto-scroll the log while the user is scrolling up | Detect scroll position — only auto-scroll if user is at bottom |
| Make the log panel full-page height with outer scroll | Log panel has its own `overflow-y: auto` container |
| Use Tailwind color names as the source of truth | All colors defined in CSS custom properties only |
| Fetch `GET /api/_stats` on every render | Poll every 5 seconds with `setInterval` in a hook |
| Let the schema textarea resize horizontally | `resize: vertical` only |
| Show toast notifications in the center of the screen | Bottom-right corner, stacked |
| Use `position: fixed` for the topbar on mobile | It works on desktop; adjust for mobile only if needed |
| Add decorative animations (rotating icons, bouncing elements) | Animations must carry information |

---

## 13. Accessibility Minimums

- All interactive elements reachable by keyboard (`Tab`, `Enter`, `Space`)
- Focus rings visible: `outline: 2px solid var(--accent); outline-offset: 2px`
- Color is never the only indicator of status — always pair with text (e.g. `✓ Success`, not just a green dot)
- `aria-live="polite"` on the toast container so screen readers announce new notifications
- `aria-label` on icon-only buttons (Reset, Copy, Pause)
- Minimum touch target size: 44×44px on any interactive element

---

*End of Document — MockForge UI Design Skill v1.0.0*
