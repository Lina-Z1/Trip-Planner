import { useState } from "react";
import MapView from "./MapView.jsx";
import LogSheet from "./LogSheet.jsx";
import { downloadPng, downloadPdf } from "./exportSheet.js";


const API = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");
const today = () => new Date().toISOString().slice(0, 10);
// const EXAMPLE = { current: "Chicago, IL", pickup: "Des Moines, IA", dropoff: "Denver, CO", cycle_used: 20 };
const EXAMPLE = { current: "Atlanta, GA", pickup: "Nashville, TN", dropoff: "Denver, CO", cycle_used: 25 };


const HEADER_FIELDS = [
  ["carrier", "Carrier name"], ["main_office", "Main office address"], ["home_terminal", "Home terminal address"],
  ["vehicles", "Truck / trailer numbers"], ["driver", "Driver (signature)"], ["co_driver", "Co-driver"],
  ["shipper", "Shipper"], ["commodity", "Commodity"], ["load_number", "Load / manifest no."],
];
const fmtDay = (iso) => new Date(iso + "T00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const fmtTime = (iso) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export default function App() {
  const [form, setForm] = useState({
    current: "", pickup: "", dropoff: "", cycle_used: 0, start_date: today(),
    ...Object.fromEntries(HEADER_FIELDS.map(([k]) => [k, ""])),
  });
  const [result, setResult] = useState(null);
  const [tab, setTab] = useState("plan");
  const [day, setDay] = useState(null);
  const [panel, setPanel] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");

  const openLog = (i) => { setDay(i); setLogOpen(true); };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/api/plan/`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, cycle_used: Number(form.cycle_used) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setResult(data); setDay(null); setLogOpen(false); setPanel(true); setTab("days");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }


  async function download(kind, i) {
    setBusy(`${kind}-${i}`); setError("");
    try {
      const { logs, header } = result;
      if (kind === "png") await downloadPng(logs[i], i + 1, header);
      else if (kind === "pdf") await downloadPdf([logs[i]], header, `eld-log-day-${i + 1}-${logs[i].date}.pdf`);
      else await downloadPdf(logs.map((l, n) => ({ ...l, dayNumber: n + 1 })), header, "eld-logs-all-days.pdf");
    } catch (err) {
      setError(err.message || "Download failed.");
    } finally {
      setBusy("");
    }
  }

  const s = result?.summary;
  return (
    <div className="app">
      <MapView data={result} day={day} drawer={logOpen} panel={panel} />


      <button className="fab fab-menu" aria-label={panel ? "Hide panel" : "Show panel"} aria-expanded={panel} onClick={() => setPanel(!panel)}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          {panel ? <path d="M6 9l6 6 6-6" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {result && day !== null && !logOpen && !panel && (
        <button className="fab fab-log" onClick={() => setLogOpen(true)}>View Day {day + 1} log</button>
      )}

      <aside className={`side ${panel ? "" : "hidden"}`}>
        <button className="handle" aria-label="Hide panel" onClick={() => setPanel(false)} />
        <header className="side-head">
          <h1>Trip planner</h1>
          <p>Route, stops and ELD logs under 70-hour / 8-day rules.</p>
        </header>

        <div className="seg" role="tablist">
          <button role="tab" aria-selected={tab === "plan"} onClick={() => setTab("plan")}>Plan</button>
          <button role="tab" aria-selected={tab === "days"} disabled={!result} onClick={() => setTab("days")}>Log days</button>
        </div>
        {error && <p className="error" role="alert">{error}</p>}

        {tab === "plan" ? (
          <form className="form" onSubmit={submit}>
            <label className="f"><span>Current location</span><input required value={form.current} onChange={set("current")} placeholder="Atlanta, GA" autoComplete="off" /></label>
            <label className="f"><span>Pickup location</span><input required value={form.pickup} onChange={set("pickup")} placeholder="Nashville, TN" autoComplete="off" /></label>
            <label className="f"><span>Drop-off location</span><input required value={form.dropoff} onChange={set("dropoff")} placeholder="Denver, CO" autoComplete="off" /></label>
            <div className="two">
              <label className="f"><span>Cycle used (hrs)</span><input required type="number" inputMode="decimal" min="0" max="70" step="0.5" value={form.cycle_used} onChange={set("cycle_used")} /></label>
              <label className="f"><span>Start date</span><input required type="date" value={form.start_date} onChange={set("start_date")} /></label>
            </div>
            <details>
              <summary>Log header details (optional)</summary>
              {HEADER_FIELDS.map(([k, label]) => (
                <label className="f" key={k}><span>{label}</span><input value={form[k]} onChange={set(k)} placeholder="N/A" /></label>
              ))}
            </details>
            <button className="primary" disabled={loading}>{loading ? "Planning route…" : "Plan trip"}</button>
            <button type="button" className="ghost" onClick={() => setForm({ ...form, ...EXAMPLE })}>Fill an example</button>
            {loading && <p className="note">Looking up places and building your logs. This can take up to 40 seconds.</p>}
          </form>
        ) : (
          <div className="days">

            <dl className="m-summary">
              <div><dt>Distance</dt><dd>{s.miles.toLocaleString()} mi</dd></div>
              <div><dt>Driving</dt><dd>{s.drive_hours} h</dd></div>
              <div><dt>Arrival</dt><dd>{fmtTime(s.arrival)}</dd></div>
            </dl>
            <button className="outline wide" disabled={!!busy} onClick={() => download("all")}>
              {busy === "all-0" || busy === "all-undefined" ? "Preparing…" : `Download all ${result.logs.length} logs (PDF)`}
            </button>
            {result.logs.map((l, i) => (
              <div key={l.date} className={`card ${day === i ? "sel" : ""}`}>
                <button className="card-main" onClick={() => openLog(i)}>
                  <span className="row"><b>Day {i + 1}</b><span className="pill">{l.miles} mi</span></span>
                  <small>{fmtDay(l.date)}</small>
                  <small className="route">{l.from_place} to {l.to_place}</small>
                  <span className="bar" title="Driving hours of the 11-hour limit"><i style={{ width: `${(l.totals.D / 11) * 100}%` }} /></span>
                  <span className="grid4">
                    <span><small>Driving</small><b>{l.totals.D.toFixed(1)} h</b></span>
                    <span><small>On duty</small><b>{l.totals.ON.toFixed(1)} h</b></span>
                    <span><small>Sleeper</small><b>{l.totals.SB.toFixed(1)} h</b></span>
                    <span><small>Off duty</small><b>{l.totals.OFF.toFixed(1)} h</b></span>
                  </span>
                </button>
                <div className="card-actions">
                  <button className="view" onClick={() => openLog(i)}>View log</button>
                  <button disabled={!!busy} onClick={() => download("png", i)}>{busy === `png-${i}` ? "Preparing…" : "PNG"}</button>
                  <button disabled={!!busy} onClick={() => download("pdf", i)}>{busy === `pdf-${i}` ? "Preparing…" : "PDF"}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </aside>


      {result && day === null && (
        <section className="summary">
          <div className="summary-top">
            <b>Trip summary</b><span className="pill dark">{s.days} log {s.days === 1 ? "sheet" : "sheets"}</span>
            <button className="outline" onClick={() => { setTab("days"); openLog(0); }}>Open Day 1 log</button>
          </div>
          <dl className="grid5">
            <div><dt>From</dt><dd>{s.from}</dd></div>
            <div><dt>Pickup</dt><dd>{s.pickup}</dd></div>
            <div><dt>To</dt><dd>{s.to}</dd></div>
            <div><dt>Distance</dt><dd>{s.miles.toLocaleString()} mi</dd></div>
            <div><dt>Arrival</dt><dd>{fmtTime(s.arrival)}</dd></div>
          </dl>
        </section>
      )}


      {result && logOpen && day !== null && (
        <section className="drawer">
          <LogSheet log={result.logs[day]} day={day + 1} header={result.header} onClose={() => { setLogOpen(false); setDay(null); }} onShowMap={() => { setLogOpen(false); setPanel(false); }} />
        </section>
      )}
    </div>
  );
}
