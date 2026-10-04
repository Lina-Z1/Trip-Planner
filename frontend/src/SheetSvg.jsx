export const SHEET_W = 1000, SHEET_H = 920, PAPER = "#f5f5ef";
const BLUE = "#3d52b4", INK = "#111";
const SANS = "Arial, Helvetica, sans-serif";
const SCRIPT = "'Segoe Script','Brush Script MT','Snell Roundhand','Apple Chancery',cursive";


const X0 = 150, HOUR = 30, Y0 = 290, ROW = 44, X1 = X0 + 24 * HOUR, Y1 = Y0 + 4 * ROW;
const ROWS = [["OFF", ["1: OFF DUTY"]], ["SB", ["2: SLEEPER", "BERTH"]], ["D", ["3: DRIVING"]], ["ON", ["4: ON DUTY", "(NOT DRIVING)"]]];
const x = (h) => X0 + h * HOUR;
const rowCenter = (status) => Y0 + ROWS.findIndex((r) => r[0] === status) * ROW + ROW / 2;
const clip = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + "…" : String(s));


const SHORT = {
  "Pre-trip inspection / TIV": "Pre-trip/TIV", "Post-trip inspection": "Post-trip/TIV",
  "Driving to pickup": "Driving", "Driving to drop-off": "Driving",
  "Pickup - loading": "Pickup", "Drop-off - unloading": "Drop-off",
  "10-hr rest": "10 hour break", "34-hr restart": "34 hour restart", "30-min break": "30 min break",
  Fueling: "Fuel", "Off duty": "Off duty",
};


function fit(value, w, size) {
  let s = String(value ?? "N/A"), fs = size;
  while (s.length * fs * 0.6 > w - 4 && fs > 10) fs -= 0.5;
  const max = Math.floor((w - 4) / (fs * 0.6));
  return [s.length > max ? s.slice(0, Math.max(1, max - 1)) + "…" : s, fs];
}


function Field({ x: fx, y, w, value, caption, size = 15, script = false }) {
  const [text, fs] = script ? [clip(value, Math.floor(w / 11)), 24] : fit(value, w, size);
  return (
    <g>
      <text x={fx + 2} y={y - 5} fontFamily={script ? SCRIPT : SANS} fontStyle={script ? "italic" : "normal"} fontWeight={script ? 400 : 700} fontSize={fs} fill={INK}>{text}</text>
      <line x1={fx} x2={fx + w} y1={y} y2={y} stroke={BLUE} strokeWidth="1.2" />
      <text x={fx} y={y + 12} fontFamily={SANS} fontSize="9.5" fill={BLUE}>{caption}</text>
    </g>
  );
}


function Digits({ x: dx, y, n, value, caption }) {
  const s = String(Math.round(value)).slice(-n).padStart(n, " ");
  return (
    <g>
      {[...s].map((ch, i) => (
        <g key={i}>
          <rect x={dx + i * 26} y={y} width="26" height="34" fill="#fff" stroke={BLUE} strokeWidth="1.4" />
          <text x={dx + i * 26 + 13} y={y + 25} textAnchor="middle" fontFamily={SANS} fontWeight="700" fontSize="22" fill={INK}>{ch.trim()}</text>
        </g>
      ))}
      {caption.map((c, i) => <text key={i} x={dx} y={y + 47 + i * 11} fontFamily={SANS} fontSize="9.5" fill={BLUE}>{c}</text>)}
    </g>
  );
}

export function SheetSvg({ log, day, header, exportSize = false }) {
  const [yy, mm, dd] = log.date.split("-");
  const line = log.segments.flatMap((s) => [[x(s.start), rowCenter(s.status)], [x(s.end), rowCenter(s.status)]]);
  const hourLabel = (h) => (h === 0 || h === 24 ? "Mid" : h === 12 ? "noon" : h % 12);
  const total = Object.values(log.totals).reduce((a, b) => a + b, 0);


  let prev = -1e9;
  const marks = log.remarks.map((r) => {
    const px = x(r.time), ox = Math.max(px, prev + 17);
    prev = ox;
    const place = clip(r.place, 18), what = clip(SHORT[r.label] || r.label, 18);
    return { px, ox, place, what, len: (place.length + what.length + 2) * 6.4 + 8 };
  });
  const A = (58 * Math.PI) / 180;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${SHEET_W} ${SHEET_H}`} role="img"
      aria-label={`Driver's daily log for ${log.date}`} {...(exportSize ? { width: SHEET_W, height: SHEET_H } : {})}>
      <rect width={SHEET_W} height={SHEET_H} fill={PAPER} />


      <text x="24" y="34" fontFamily={SANS} fontWeight="800" fontSize="24" fill={BLUE}>DRIVER'S DAILY LOG</text>
      <text x="24" y="50" fontFamily={SANS} fontSize="9.5" fill={BLUE}>(24 hours)  Original: file at home terminal. Duplicate: driver retains in his/her possession for 8 days.</text>
      <Field x={640} y={40} w={70} value={mm} caption="(MONTH)" size={18} />
      <text x="715" y="36" fontFamily={SANS} fontSize="20" fill={BLUE}>/</text>
      <Field x={730} y={40} w={70} value={dd} caption="(DAY)" size={18} />
      <text x="805" y="36" fontFamily={SANS} fontSize="20" fill={BLUE}>/</text>
      <Field x={820} y={40} w={100} value={yy} caption="(YEAR)" size={18} />


      <Field x={24} y={100} w={240} value={log.from_place} caption="FROM" />
      <Field x={284} y={100} w={236} value={log.to_place} caption="TO" />
      <Digits x={560} y={62} n={4} value={log.miles} caption={["TOTAL DRIVING", "MILES TODAY"]} />
      <Digits x={720} y={62} n={4} value={log.miles} caption={["TOTAL TRUCK", "MILEAGE TODAY"]} />
      <Field x={24} y={150} w={496} value={header.carrier} caption="NAME OF CARRIER" />
      <Field x={550} y={150} w={426} value={header.vehicles} caption="VEHICLE NUMBERS (SHOW EACH UNIT)" />
      <Field x={24} y={198} w={496} value={header.main_office} caption="MAIN OFFICE ADDRESS" />
      <Field x={550} y={198} w={426} value={header.home_terminal} caption="HOME OPERATING CENTER AND ADDRESS" />
      <Field x={24} y={246} w={300} value={header.driver} caption="DRIVER'S SIGNATURE IN FULL" script />
      <Field x={344} y={246} w={176} value={header.co_driver} caption="NAME OF CO-DRIVER" />
      <Field x={550} y={246} w={426} value={header.load_number} caption="DVL OR MANIFEST NO." />


      {ROWS.map(([code, label], i) => (
        <g key={code}>
          <rect x={X0} y={Y0 + i * ROW} width={X1 - X0} height={ROW} fill={i % 2 ? "#eceef6" : "#fff"} stroke={BLUE} strokeWidth="1.3" />
          {label.map((t, k) => (
            <text key={k} x={X0 - 8} y={Y0 + i * ROW + ROW / 2 + 4 + (k - (label.length - 1) / 2) * 12} textAnchor="end" fontFamily={SANS} fontWeight="700" fontSize={k ? 9 : 11} fill={BLUE}>{t}</text>
          ))}
          {Array.from({ length: 96 }, (_, q) => (
            <line key={q} x1={x(q / 4)} x2={x(q / 4)} y1={Y0 + (i + 1) * ROW} y2={Y0 + (i + 1) * ROW - (q % 4 === 0 ? ROW : q % 2 === 0 ? 24 : 13)} stroke={BLUE} strokeWidth={q % 4 === 0 ? 1.3 : 0.9} />
          ))}

          <rect x="886" y={Y0 + i * ROW + 6} width="90" height={ROW - 12} fill="#fff" stroke={BLUE} strokeWidth="1.3" />
          <text x="931" y={Y0 + i * ROW + ROW / 2 + 6} textAnchor="middle" fontFamily={SANS} fontWeight="700" fontSize="16" fill={INK}>{log.totals[code].toFixed(2)}</text>
        </g>
      ))}
      <line x1={X1} x2={X1} y1={Y0} y2={Y1} stroke={BLUE} strokeWidth="1.3" />
      {Array.from({ length: 25 }, (_, h) => (
        <g key={h}>
          <text x={x(h)} y={Y0 - 6} textAnchor="middle" fontFamily={SANS} fontSize="11" fill={BLUE}>{hourLabel(h)}</text>
          <text x={x(h)} y={Y1 + 22} textAnchor="middle" fontFamily={SANS} fontSize="11" fill={BLUE}>{hourLabel(h)}</text>
        </g>
      ))}

      {Array.from({ length: 97 }, (_, q) => (
        <line key={q} x1={x(q / 4)} x2={x(q / 4)} y1={Y1} y2={Y1 + (q % 4 === 0 ? 10 : q % 2 === 0 ? 7 : 4)} stroke={BLUE} strokeWidth="1" />
      ))}
      <text x="886" y={Y0 - 6} fontFamily={SANS} fontSize="9.5" fill={BLUE}>TOTAL HOURS</text>
      <rect x="886" y={Y1 + 8} width="90" height="26" fill="#fff" stroke={BLUE} strokeWidth="1.3" />
      <text x="931" y={Y1 + 27} textAnchor="middle" fontFamily={SANS} fontWeight="800" fontSize="16" fill={INK}>{total.toFixed(2)}</text>


      <polyline points={line.map((p) => p.join(",")).join(" ")} fill="none" stroke={INK} strokeWidth="4" strokeLinejoin="miter" />


      <text x="24" y="532" fontFamily={SANS} fontWeight="800" fontSize="16" fill={BLUE}>REMARKS</text>
      {marks.map((m, i) => (
        <g key={i}>
          <polyline points={`${m.px},${Y1 + 30} ${m.px},${Y1 + 40} ${m.ox},${Y1 + 40} ${m.ox},${Y1 + 58}`} fill="none" stroke={INK} strokeWidth="2" />
          <line x1={m.ox} y1={Y1 + 58} x2={m.ox - m.len * Math.cos(A)} y2={Y1 + 58 + m.len * Math.sin(A)} stroke={INK} strokeWidth="2.5" />

          <g transform={`translate(${m.ox},${Y1 + 58}) rotate(-58)`} fontFamily={SANS} fontSize="11" fill={INK}>
            <text x="-3" y="-4" textAnchor="end">{m.what}</text>
            <text x={-(m.what.length + 2) * 6.4} y="-4" textAnchor="end" fontWeight="700">{m.place}</text>
          </g>
        </g>
      ))}


      <Field x={24} y={776} w={330} value={header.shipper} caption="SHIPPER" />
      <Field x={374} y={776} w={330} value={header.commodity} caption="COMMODITY" />
      <Field x={724} y={776} w={252} value={header.load_number} caption="LOAD NO." />
      <Field x={24} y={832} w={300} value={log.on_duty.toFixed(2)} caption="ON-DUTY HOURS TODAY (LINES 3 AND 4)" />
      <Field x={350} y={832} w={300} value={log.recap.a.toFixed(2)} caption="A. TOTAL ON-DUTY HOURS IN CYCLE, INCL. TODAY" />
      <Field x={676} y={832} w={300} value={log.recap.b.toFixed(2)} caption="B. HOURS AVAILABLE TOMORROW (70 MINUS A)" />
      <text x="24" y="884" fontFamily={SANS} fontSize="9.5" fill={BLUE}>I certify these entries are true and correct. 70 hour / 8 day drivers. Use time standard of home terminal. Each change of duty status must have a location in the Remarks section.</text>
      <text x="24" y="900" fontFamily={SANS} fontSize="9.5" fill={BLUE}>{`Day ${day}. Generated by ELD Trip Planner.`}</text>
    </svg>
  );
}
