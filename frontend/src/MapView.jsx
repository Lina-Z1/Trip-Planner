import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Popup, ZoomControl, AttributionControl, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const COLORS = { fuel: "#f5b700", rest: "#8b5cf6", break: "#3b82f6" };
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));


const LETTERS = ["A", "B", "C"], KINDS = ["start", "pickup", "drop"], NAMES = ["Start", "Pickup", "Drop-off"];
const placeIcon = (text, i) => L.divIcon({
  className: "place", iconSize: [0, 0],
  html: `<i class="pin ${KINDS[i]}">${LETTERS[i]}</i><b class="${KINDS[i]}">${esc(text.split(",")[0])}</b>`,
});


function Fit({ points, drawer, panel }) {
  const map = useMap();
  useEffect(() => {
    if (!points || points.length < 2) return;
    const mobile = window.matchMedia("(max-width: 900px)").matches;
    const W = window.innerWidth, H = window.innerHeight;
    map.fitBounds(points, mobile
      ? { paddingTopLeft: [24, 24], paddingBottomRight: [24, panel ? Math.round(H * 0.5) : 90], maxZoom: 9 }
      : { paddingTopLeft: [440, 40], paddingBottomRight: [drawer ? Math.min(784, Math.max(40, W - 640)) : 40, 170], maxZoom: 9 });
  }, [points, drawer, panel, map]);
  return null;
}

export default function MapView({ data, day, drawer, panel }) {
  const active = data && day !== null ? data.logs[day].route : null;
  return (
    <MapContainer center={[39.5, -98.35]} zoom={4} zoomControl={false} attributionControl={false} className="map">
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ZoomControl position="topright" />

      <AttributionControl position="bottomright" prefix={false} />
      {data && (
        <>
          <Fit points={active || data.route} drawer={drawer} panel={panel} />

          <Polyline positions={data.route} pathOptions={active ? { color: "#111", weight: 4, dashArray: "1 9", lineCap: "round" } : { color: "#111", weight: 5 }} />
          {active && <Polyline positions={active} pathOptions={{ color: "#111", weight: 6 }} />}
          {data.stops.filter((s) => s.type in COLORS).map((s, i) => (
            <CircleMarker key={i} center={[s.lat, s.lon]} radius={7} pathOptions={{ color: "#fff", weight: 3, fillColor: COLORS[s.type], fillOpacity: 1 }}>
              <Popup><b>{s.label}</b><br />Mile {s.mile}</Popup>
            </CircleMarker>
          ))}
          {data.points.map((p, i) => (
            <Marker key={i} position={[p.lat, p.lon]} icon={placeIcon(p.label, i)}>
              <Popup><b>{NAMES[i]}</b><br />{p.label}</Popup>
            </Marker>
          ))}
        </>
      )}
    </MapContainer>
  );
}
