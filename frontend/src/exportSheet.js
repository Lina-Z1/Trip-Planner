import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SheetSvg, SHEET_W, SHEET_H, PAPER } from "./SheetSvg.jsx";

const SCALE = 2;


function sheetToCanvas(log, day, header) {
  const markup = renderToStaticMarkup(createElement(SheetSvg, { log, day, header, exportSize: true }));
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = SHEET_W * SCALE; c.height = SHEET_H * SCALE;
      const ctx = c.getContext("2d");
      ctx.fillStyle = PAPER; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not render the log sheet.")); };
    img.src = url;
  });
}

function saveBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export async function downloadPng(log, day, header) {
  const canvas = await sheetToCanvas(log, day, header);
  await new Promise((res) => canvas.toBlob((b) => { saveBlob(b, `eld-log-day-${day}-${log.date}.png`); res(); }, "image/png"));
}


export async function downloadPdf(logs, header, filename) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  for (let i = 0; i < logs.length; i++) {
    const canvas = await sheetToCanvas(logs[i], logs[i].dayNumber ?? i + 1, header);
    if (i) doc.addPage();
    doc.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 10, 10, 190, (190 * SHEET_H) / SHEET_W);
  }
  doc.save(filename);
}
