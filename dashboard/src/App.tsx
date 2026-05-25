import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LogEvent, MutationHistoryEntry, RequestSnapshot, ResetResponse, RouteDefinition, RuntimeConfig, StatsResponse } from '../../shared/types'
import './App.css'

type Panel = 'routes' | 'logs' | 'schema' | 'explorer' | 'control'
type Toast = { id: number; kind: 'success' | 'error' | 'info'; title: string; message: string }

const methods = ['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const statuses = ['ALL', '2xx', '3xx', '4xx', '5xx']

function statusClass(status: number) {
  if (status < 300) return 'status-2xx'
  if (status < 400) return 'status-3xx'
  if (status < 500) return 'status-4xx'
  return 'status-5xx'
}

function formatUptime(seconds: number) {
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h ${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')}m`
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`
}

function formatTime(iso: string) {
  const date = new Date(iso)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}.${String(date.getMilliseconds()).padStart(3, '0')}`
}

function buildCurl(method: string, path: string, port: number) {
  const body = ['POST', 'PUT', 'PATCH'].includes(method) ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '{}'` : ''
  return `curl -X ${method} http://localhost:${port}${path}${body}`
}

function timeAgo(value: unknown) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return String(value)
  const seconds = Math.max(Math.floor((Date.now() - new Date(value).getTime()) / 1000), 0)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

function App() {
  const [panel, setPanel] = useState<Panel>('routes')
  const [routes, setRoutes] = useState<RouteDefinition[]>([])
  const [stats, setStats] = useState<StatsResponse>({ models: {}, totalRecords: 0, totalRequests: 0, uptime: 0, port: 5000 })
  const [schemaText, setSchemaText] = useState('')
  const [logs, setLogs] = useState<LogEvent[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])
  const [refreshKey, setRefreshKey] = useState(0)

  const addToast = useCallback((kind: Toast['kind'], title: string, message: string) => {
    const id = Date.now() + Math.random()
    setToasts((items) => [{ id, kind, title, message }, ...items].slice(0, 3))
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 4000)
  }, [])

  const refresh = useCallback(async () => {
    const [routeResponse, statsResponse, schemaResponse] = await Promise.all([
      fetch('/api/_routes'),
      fetch('/api/_stats'),
      fetch('/api/_schema'),
    ])
    setRoutes(await routeResponse.json())
    setStats(await statsResponse.json())
    setSchemaText(JSON.stringify(await schemaResponse.json(), null, 2))
  }, [])

  useEffect(() => {
    refresh().catch(() => addToast('error', 'Dashboard offline', 'Could not reach the MockForge API'))
    const timer = window.setInterval(() => {
      fetch('/api/_stats').then((response) => response.json()).then(setStats).catch(() => undefined)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [addToast, refresh, refreshKey])

  useEffect(() => {
    const source = new EventSource('/api/_logs/stream')
    source.addEventListener('request', (event) => {
      const entry = JSON.parse((event as MessageEvent).data) as LogEvent
      setLogs((items) => [...items.slice(-199), entry])
    })
    source.onerror = () => addToast('error', 'Log stream paused', 'Waiting for the server to reconnect')
    return () => source.close()
  }, [addToast])

  async function resetData() {
    const response = await fetch('/api/reset', { method: 'POST' })
    if (!response.ok) throw new Error('Reset failed')
    const data = (await response.json()) as ResetResponse
    setRefreshKey((key) => key + 1)
    addToast('success', 'Data reset', `${data.totalRecords} records restored`)
  }

  async function reloadSchema() {
    const parsed = JSON.parse(schemaText)
    const response = await fetch('/api/_schema/reload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.detail ?? data.error ?? 'Schema reload failed')
    setRefreshKey((key) => key + 1)
    addToast('success', 'Schema applied', `${data.models.length} models mounted`)
  }

  return (
    <div className="app-shell">
      <Topbar stats={stats} onReset={resetData} addToast={addToast} />
      <Sidebar panel={panel} setPanel={setPanel} stats={stats} />
      <main className="main">
        {panel === 'routes' && <RoutesPanel routes={routes} stats={stats} addToast={addToast} />}
        {panel === 'logs' && <LiveLogPanel logs={logs} setLogs={setLogs} stats={stats} />}
        {panel === 'schema' && <SchemaPanel schemaText={schemaText} setSchemaText={setSchemaText} onReload={reloadSchema} addToast={addToast} />}
        {panel === 'explorer' && <ExplorerPanel stats={stats} refreshKey={refreshKey} addToast={addToast} />}
        {panel === 'control' && <ControlPanel stats={stats} schemaText={schemaText} addToast={addToast} />}
      </main>
      <div className="toast-container" aria-live="polite">
        {toasts.map((toast) => (
          <div className={`toast ${toast.kind}`} key={toast.id}>
            <span className="toast-icon">{toast.kind === 'success' ? 'OK' : toast.kind === 'error' ? 'ERR' : 'INFO'}</span>
            <span>
              <strong>{toast.title}</strong>
              <small>{toast.message}</small>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Topbar({ stats, onReset, addToast }: { stats: StatsResponse; onReset: () => Promise<void>; addToast: (kind: Toast['kind'], title: string, message: string) => void }) {
  const [state, setState] = useState<'idle' | 'confirm' | 'loading' | 'success'>('idle')

  async function handleReset() {
    if (state === 'idle') {
      setState('confirm')
      window.setTimeout(() => setState((current) => (current === 'confirm' ? 'idle' : current)), 2000)
      return
    }
    if (state !== 'confirm') return
    setState('loading')
    try {
      await onReset()
      setState('success')
      window.setTimeout(() => setState('idle'), 1800)
    } catch (error) {
      setState('idle')
      addToast('error', 'Reset failed', error instanceof Error ? error.message : 'Server returned an error')
    }
  }

  return (
    <header className="topbar">
      <div className="brand"><span className="brand-mark">MF</span><strong>MockForge</strong></div>
      <span className="divider" />
      <span className="status-pill">Server online</span>
      <span className="topbar-spacer" />
      <span className="port-badge">:{stats.port}</span>
      <span className="uptime">{formatUptime(stats.uptime)}</span>
      <button className={`btn-reset ${state}`} type="button" onClick={handleReset}>
        {state === 'confirm' ? 'Confirm reset' : state === 'loading' ? 'Resetting' : state === 'success' ? 'Data restored' : 'Reset Data'}
      </button>
    </header>
  )
}

function Sidebar({ panel, setPanel, stats }: { panel: Panel; setPanel: (panel: Panel) => void; stats: StatsResponse }) {
  const nav: Array<[Panel, string, string]> = [['routes', 'Routes', 'GRID'], ['logs', 'Live Log', 'LOG'], ['schema', 'Schema', '{}'], ['explorer', 'Explorer', 'TABLE'], ['control', 'Control', 'CTRL']]
  return (
    <aside className="sidebar">
      <nav className="nav-list">
        {nav.map(([id, label, icon]) => (
          <button className={`nav-item ${panel === id ? 'active' : ''}`} key={id} type="button" onClick={() => setPanel(id)}>
            <span className="nav-icon">{icon}</span><span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="stats-footer">
        <StatChip label="Models" value={Object.keys(stats.models).length} />
        <StatChip label="Records" value={stats.totalRecords} />
        <StatChip label="Requests" value={stats.totalRequests} />
      </div>
    </aside>
  )
}

function StatChip({ label, value }: { label: string; value: number }) {
  return <div className="stat-chip"><span>{label}</span><strong>{value}</strong></div>
}

function RoutesPanel({ routes, stats, addToast }: { routes: RouteDefinition[]; stats: StatsResponse; addToast: (kind: Toast['kind'], title: string, message: string) => void }) {
  const models = useMemo(() => Object.keys(stats.models), [stats.models])
  const [selected, setSelected] = useState('')
  const active = selected || models[0] || ''
  const visibleRoutes = routes.filter((route) => route.model === active)

  useEffect(() => {
    if (!models.includes(active)) setSelected(models[0] ?? '')
  }, [active, models])

  async function copyCurl(route: RouteDefinition) {
    await navigator.clipboard.writeText(buildCurl(route.method, route.path, stats.port))
    addToast('info', 'Copied curl', `${route.method} ${route.path}`)
  }

  return (
    <section className="panel routes-panel">
      <PanelHeader title="Routes" subtitle="Active mock endpoints grouped by model" />
      {models.length === 0 ? <EmptyState title="No models parsed" text="Paste a schema in the Schema panel to mount routes." /> : (
        <div className="routes-grid">
          <div className="model-index">
            {models.map((model) => (
              <button className={`model-item ${active === model ? 'selected' : ''}`} key={model} type="button" onClick={() => setSelected(model)}>
                <span className="model-name">{model}</span><span className="model-count">{stats.models[model]} rec</span>
              </button>
            ))}
          </div>
          <div className="route-list">
            {visibleRoutes.map((route) => (
              <article className="route-card" key={`${route.method}-${route.path}`}>
                <div className="route-header">
                  <span className={`method-badge method-${route.method}`}>{route.method}</span>
                  <code className="route-path">{route.path}</code>
                  <button className="btn-copy-curl" type="button" onClick={() => copyCurl(route)}>Copy curl</button>
                </div>
                <p className="route-desc">{describeRoute(route)}</p>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function describeRoute(route: RouteDefinition) {
  if (route.method === 'GET' && !route.path.includes(':id')) return 'Returns all records. Supports _limit, _page, and field filters.'
  if (route.method === 'GET') return 'Returns one record by id.'
  if (route.method === 'POST') return 'Creates a new record and assigns an id when needed.'
  if (route.method === 'PUT') return 'Replaces an existing record.'
  if (route.method === 'PATCH') return 'Applies a partial update.'
  return 'Deletes a record by id.'
}

function LiveLogPanel({ logs, setLogs, stats }: { logs: LogEvent[]; setLogs: React.Dispatch<React.SetStateAction<LogEvent[]>>; stats: StatsResponse }) {
  const [query, setQuery] = useState('')
  const [method, setMethod] = useState('ALL')
  const [status, setStatus] = useState('ALL')
  const bottomRef = useRef<HTMLDivElement>(null)
  const visible = logs.filter((log) =>
    log.path.toLowerCase().includes(query.toLowerCase()) &&
    (method === 'ALL' || log.method === method) &&
    (status === 'ALL' || String(log.status).startsWith(status[0])),
  )

  useEffect(() => bottomRef.current?.scrollIntoView({ block: 'nearest' }), [visible.length])

  return (
    <section className="panel log-panel">
      <PanelHeader title="Live Log" subtitle="Request traffic from the mock API" action={<button className="ghost-button" type="button" onClick={() => setLogs([])}>Clear</button>} />
      <div className="filter-bar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter path" />
        <select value={method} onChange={(event) => setMethod(event.target.value)}>{methods.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((item) => <option key={item}>{item}</option>)}</select>
      </div>
      <div className="log-list">
        {visible.length === 0 ? <EmptyState title={logs.length ? 'No requests match' : 'Waiting for requests'} text={`Try curl http://localhost:${stats.port}/api/${Object.keys(stats.models)[0] ?? 'users'}`} /> : visible.map((log, index) => (
          <div className="log-row" key={`${log.timestamp}-${index}`}>
            <span className="log-time">{formatTime(log.timestamp)}</span>
            <span className={`method-badge method-${log.method}`}>{log.method}</span>
            <span className={`status-badge ${statusClass(log.status)}`}>{log.status}</span>
            <span className="log-path">{log.path}</span>
            <span className={`log-latency ${log.ms < 10 ? 'fast' : log.ms < 50 ? 'medium' : 'slow'}`}>{log.ms}ms</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </section>
  )
}

function SchemaPanel({ schemaText, setSchemaText, onReload, addToast }: { schemaText: string; setSchemaText: (value: string) => void; onReload: () => Promise<void>; addToast: (kind: Toast['kind'], title: string, message: string) => void }) {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const valid = useMemo(() => {
    try {
      const parsed = JSON.parse(schemaText)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length > 0
    } catch {
      return false
    }
  }, [schemaText])

  function formatJson() {
    try {
      setSchemaText(JSON.stringify(JSON.parse(schemaText), null, 2))
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Invalid JSON')
    }
  }

  async function submit() {
    setLoading(true)
    setError('')
    try {
      await onReload()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Schema reload failed'
      setError(message)
      addToast('error', 'Parse failed', message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="panel schema-panel">
      <PanelHeader title="Schema Editor" subtitle="Edit JSON schema and reload routes without restarting the server" />
      <textarea className={`schema-editor ${error ? 'error' : ''}`} value={schemaText} onChange={(event) => setSchemaText(event.target.value)} spellCheck={false} />
      {error && <p className="validation-error">{error}</p>}
      <div className="editor-actions">
        <button className="ghost-button" type="button" disabled={!valid} onClick={formatJson}>Format JSON</button>
        <button className="btn-reload" type="button" disabled={!valid || loading} onClick={submit}>{loading ? 'Reloading' : 'Reload Schema'}</button>
      </div>
    </section>
  )
}

function ExplorerPanel({ stats, refreshKey, addToast }: { stats: StatsResponse; refreshKey: number; addToast: (kind: Toast['kind'], title: string, message: string) => void }) {
  const models = useMemo(() => Object.keys(stats.models), [stats.models])
  const [model, setModel] = useState(models[0] ?? '')
  const [page, setPage] = useState(1)
  const [records, setRecords] = useState<Array<Record<string, unknown>>>([])
  const fields = useMemo(() => Array.from(new Set(records.flatMap((record) => Object.keys(record)))).slice(0, 8), [records])

  const loadRecords = useCallback(async () => {
    if (!model) return
    const response = await fetch(`/api/${model}?_limit=10&_page=${page}`)
    if (!response.ok) throw new Error(`Could not load ${model}`)
    setRecords(await response.json())
  }, [model, page])

  useEffect(() => {
    if (models.length && !models.includes(model)) setModel(models[0])
  }, [model, models])

  useEffect(() => {
    loadRecords().catch((error) => addToast('error', 'Explorer failed', error instanceof Error ? error.message : 'Could not load records'))
  }, [addToast, loadRecords, refreshKey])

  return (
    <section className="panel explorer-panel">
      <PanelHeader title="Explorer" subtitle="Browse the current in-memory records" />
      <div className="explorer-controls">
        <select value={model} onChange={(event) => { setModel(event.target.value); setPage(1) }}>{models.map((item) => <option key={item}>{item}</option>)}</select>
        <span>Page {page}</span>
        <button className="ghost-button" type="button" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Prev</button>
        <button className="ghost-button" type="button" disabled={records.length < 10} onClick={() => setPage((value) => value + 1)}>Next</button>
        <button className="ghost-button" type="button" onClick={loadRecords}>Refresh</button>
      </div>
      {records.length === 0 ? <EmptyState title="No records found" text={`Try POST /api/${model || 'model'} to create a record.`} /> : (
        <div className="table-wrap">
          <table className="explorer-table">
            <thead><tr>{fields.map((field) => <th key={field}>{field}</th>)}</tr></thead>
            <tbody>
              {records.map((record, row) => (
                <tr key={String(record.id ?? row)}>
                  {fields.map((field) => <td className={field.toLowerCase().includes('id') ? 'cell-id' : ''} title={String(record[field] ?? '')} key={field}>{field.toLowerCase().includes('at') ? timeAgo(record[field]) : String(record[field] ?? '')}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function ControlPanel({ stats, schemaText, addToast }: { stats: StatsResponse; schemaText: string; addToast: (kind: Toast['kind'], title: string, message: string) => void }) {
  const [config, setConfig] = useState<RuntimeConfig | null>(null)
  const [snapshotName, setSnapshotName] = useState('baseline')
  const [snapshots, setSnapshots] = useState<Array<{ name: string; models: Record<string, number> }>>([])
  const [history, setHistory] = useState<MutationHistoryEntry[]>([])
  const [requests, setRequests] = useState<RequestSnapshot[]>([])
  const [exportText, setExportText] = useState('')
  const [diff, setDiff] = useState('')

  const schema = useMemo(() => {
    try {
      return JSON.parse(schemaText) as Record<string, Record<string, { type: string; isRelation?: boolean; relationModel?: string }>>
    } catch {
      return {}
    }
  }, [schemaText])

  const relationships = useMemo(() => Object.entries(schema).flatMap(([model, fields]) =>
    Object.entries(fields)
      .filter(([, field]) => field.isRelation || field.relationModel)
      .map(([fieldName, field]) => ({ from: model, to: field.relationModel || fieldName.replace(/(?:Id|_id)$/, ''), field: fieldName })),
  ), [schema])

  const loadControlData = useCallback(async () => {
    const [configResponse, snapshotResponse, historyResponse, requestResponse] = await Promise.all([
      fetch('/api/_config'),
      fetch('/api/_snapshots'),
      fetch('/api/_history'),
      fetch('/api/_requests'),
    ])
    setConfig(await configResponse.json())
    setSnapshots(await snapshotResponse.json())
    setHistory(await historyResponse.json())
    setRequests(await requestResponse.json())
  }, [])

  useEffect(() => {
    loadControlData().catch(() => addToast('error', 'Control data failed', 'Could not load advanced tooling data'))
  }, [addToast, loadControlData])

  async function saveConfig(next: Partial<RuntimeConfig>) {
    const response = await fetch('/api/_config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    })
    setConfig(await response.json())
    addToast('success', 'Config updated', 'Simulation settings are active')
  }

  async function saveSnapshot() {
    const response = await fetch(`/api/_snapshots/${encodeURIComponent(snapshotName)}`, { method: 'POST' })
    if (!response.ok) throw new Error('Snapshot failed')
    await loadControlData()
    addToast('success', 'Snapshot saved', snapshotName)
  }

  async function restoreSnapshot(name: string) {
    const response = await fetch(`/api/_snapshots/${encodeURIComponent(name)}/restore`, { method: 'POST' })
    if (!response.ok) throw new Error('Restore failed')
    await loadControlData()
    addToast('success', 'Snapshot restored', name)
  }

  async function resetModel(model: string) {
    const response = await fetch(`/api/reset/${model}`, { method: 'POST' })
    if (!response.ok) throw new Error('Model reset failed')
    addToast('success', 'Model reset', model)
  }

  async function loadExport(kind: 'types' | 'postman' | 'msw') {
    const endpoint = kind === 'types' ? '/api/_types' : kind === 'postman' ? '/api/_export/postman' : '/api/_export/msw'
    const response = await fetch(endpoint)
    const text = kind === 'postman' ? JSON.stringify(await response.json(), null, 2) : await response.text()
    setExportText(text)
  }

  async function copyExport() {
    await navigator.clipboard.writeText(exportText)
    addToast('info', 'Export copied', 'Ready for your project')
  }

  function compareEditorToServer() {
    const fieldSummary = Object.entries(schema).map(([model, fields]) => `${model}: ${Object.keys(fields).join(', ')}`).join('\n')
    setDiff(fieldSummary || 'No valid schema in editor')
  }

  return (
    <section className="panel control-panel">
      <PanelHeader title="Control" subtitle="Simulation, snapshots, exports, and debugging tools" action={<button className="ghost-button" type="button" onClick={loadControlData}>Refresh</button>} />
      <div className="control-grid">
        <article className="tool-panel">
          <h2>Realism</h2>
          <label>Global delay <input type="number" value={config?.globalDelayMs ?? 0} onChange={(event) => setConfig((current) => current && { ...current, globalDelayMs: Number(event.target.value) })} /></label>
          <label>Chaos rate <input type="number" min="0" max="1" step="0.01" value={config?.chaosRate ?? 0} onChange={(event) => setConfig((current) => current && { ...current, chaosRate: Number(event.target.value) })} /></label>
          <label>Rate limit/min <input type="number" value={config?.rateLimitPerMinute ?? ''} onChange={(event) => setConfig((current) => current && { ...current, rateLimitPerMinute: event.target.value ? Number(event.target.value) : null })} /></label>
          <label className="check-row"><input type="checkbox" checked={config?.authRequired ?? false} onChange={(event) => setConfig((current) => current && { ...current, authRequired: event.target.checked })} /> Require bearer auth</label>
          <code className="token-line">Bearer {config?.authToken}</code>
          <button className="btn-reload" type="button" disabled={!config} onClick={() => config && saveConfig(config)}>Apply Config</button>
        </article>

        <article className="tool-panel">
          <h2>Snapshots</h2>
          <div className="inline-controls">
            <input value={snapshotName} onChange={(event) => setSnapshotName(event.target.value)} />
            <button className="ghost-button" type="button" onClick={saveSnapshot}>Save</button>
          </div>
          <div className="mini-list">
            {snapshots.length === 0 ? <span className="muted">No snapshots saved</span> : snapshots.map((snapshot) => (
              <button key={snapshot.name} type="button" onClick={() => restoreSnapshot(snapshot.name)}>
                <strong>{snapshot.name}</strong><span>{Object.values(snapshot.models).reduce((sum, count) => sum + count, 0)} records</span>
              </button>
            ))}
          </div>
          <h3>Per-model reset</h3>
          <div className="chip-row">{Object.keys(stats.models).map((model) => <button className="ghost-button" key={model} type="button" onClick={() => resetModel(model)}>{model}</button>)}</div>
        </article>

        <article className="tool-panel wide">
          <h2>Exports</h2>
          <div className="chip-row">
            <button className="ghost-button" type="button" onClick={() => loadExport('types')}>TypeScript</button>
            <button className="ghost-button" type="button" onClick={() => loadExport('postman')}>Postman</button>
            <button className="ghost-button" type="button" onClick={() => loadExport('msw')}>MSW</button>
            <button className="ghost-button" type="button" disabled={!exportText} onClick={copyExport}>Copy</button>
          </div>
          <pre className="export-box">{exportText || 'Choose an export to preview it here.'}</pre>
        </article>

        <article className="tool-panel">
          <h2>Relationship Graph</h2>
          <div className="graph-list">
            {relationships.length === 0 ? <span className="muted">No relations detected</span> : relationships.map((edge) => (
              <div key={`${edge.from}-${edge.field}`}><strong>{edge.from}</strong><span>{edge.field}</span><strong>{edge.to}</strong></div>
            ))}
          </div>
          <button className="ghost-button" type="button" onClick={compareEditorToServer}>Summarize Schema</button>
          <pre className="diff-box">{diff || 'Schema summary appears here.'}</pre>
        </article>

        <article className="tool-panel">
          <h2>Mutation History</h2>
          <div className="timeline">
            {history.length === 0 ? <span className="muted">No mutations yet</span> : history.slice(0, 12).map((entry) => (
              <div key={entry.id}><span className={`method-badge method-${entry.method}`}>{entry.method}</span><code>{entry.model}/{entry.recordId.slice(0, 8)}</code></div>
            ))}
          </div>
        </article>

        <article className="tool-panel">
          <h2>Request Inspector</h2>
          <div className="timeline">
            {requests.length === 0 ? <span className="muted">No requests captured</span> : requests.slice(0, 12).map((request) => (
              <div key={`${request.timestamp}-${request.path}`}><span className="method-badge method-GET">{request.method}</span><code>{request.path}</code></div>
            ))}
          </div>
        </article>
      </div>
    </section>
  )
}

function PanelHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return <div className="panel-header"><div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><div className="empty-icon">GRID</div><strong>{title}</strong><span>{text}</span></div>
}

export default App
