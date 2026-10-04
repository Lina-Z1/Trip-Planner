import { useState } from "react";
import { SheetSvg } from "./SheetSvg.jsx";
import { downloadPng, downloadPdf } from "./exportSheet.js";

const hhmm = (h) => `${String(Math.floor(h)).padStart(2, "0")}:${String(Math.round((h % 1) * 60) % 60).padStart(2, "0")}`;


export default function LogSheet({ log, day, header, onClose, onShowMap }) {
  const [busy, setBusy] = useState("");

  async function run(kind) {
    setBusy(kind);
    try {
      if (kind === "png") await downloadPng(log, day, header);
      else await downloadPdf([log], header, `eld-log-day-${day}-${log.date}.pdf`);
    } finally { setBusy(""); }
  }

  return (
    <article className="sheet">
      <div className="sheet-bar">
        <div><h3>Day {day}</h3><small>{log.date}</small></div>
        <div className="bar-actions">
          <button className="outline" disabled={!!busy} onClick={() => run("png")}>{busy === "png" ? "Preparing…" : "Download PNG"}</button>
          <button className="outline" disabled={!!busy} onClick={() => run("pdf")}>{busy === "pdf" ? "Preparing…" : "Download PDF"}</button>
          <button className="outline only-mobile" onClick={onShowMap}>Show map</button>
          <button className="solid" onClick={onClose}>Close</button>
        </div>
      </div>

      <p className="hint">Swipe sideways to read the full sheet, or download it.</p>
      <div className="paper-scroll"><SheetSvg log={log} day={day} header={header} /></div>

      <h4>Remarks</h4>
      <ol className="remarks">
        {log.remarks.map((r, i) => (
          <li key={i}><time>{hhmm(r.time)}</time><em>{r.place}</em><span>{r.label}</span></li>
        ))}
      </ol>
    </article>
  );
}
