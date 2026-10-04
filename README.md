# ELD Trip Planner

A full-stack app (Django + React) that takes a trip and returns a **route map with stops and rests** plus **filled-in ELD daily log sheets**, following US hours-of-service (HOS) rules for a property-carrying driver on a 70-hour / 8-day cycle.

- **Live app:** _add Vercel link_
- **API:** _add Render/Railway link_
- **Walkthrough video:** _add Loom link_

![App screenshot](docs/screenshot-map.png)
![Log sheet screenshot](docs/screenshot-log.png)

## Features
- Inputs: current location, pickup, drop-off, cycle hours already used (plus start date and optional log header fields such as carrier, vehicles, shipper, commodity, load number).
- Route on an OpenStreetMap map with lettered pins (A start, B pickup, C drop-off) and markers for fuel stops, breaks and rests.
- One paper-style daily log sheet per day: 24-hour graph, totals, remarks with a city at every duty-status change, and a 70-hour recap.
- Download any sheet as PNG or PDF, or all sheets in one PDF.
- Responsive: on phones the panel becomes a bottom sheet that can be hidden so the map fills the screen.

## Tech stack
- **Backend:** Python, Django, django-cors-headers, requests, gunicorn (no database needed).
- **Frontend:** React 18, Vite, Leaflet / react-leaflet, jsPDF.
- **Free map services (no API keys):** OpenStreetMap tiles, Nominatim (geocoding), OSRM (routing).

## How it works
1. `POST /api/plan/` geocodes the three locations and asks OSRM for the driving route.
2. `trips/hos.py` simulates the trip and applies the rules below, producing a timeline of duty statuses.
3. The timeline is cut at midnight into daily logs. Each remark gets a "City, ST" through reverse geocoding (cached, 1 request/second).
4. The frontend draws the map and renders each log as an SVG, which is also what gets exported to PNG/PDF.

**HOS rules modelled:** 11-hour driving limit, 14-hour on-duty window, 30-minute break after 8 hours of driving, 10 hours off duty (shown as Sleeper Berth) to reset a shift, 34-hour restart when the 70-hour cycle is used up, fuel at least every 1,000 miles (30 min), 1 hour for pickup and 1 hour for drop-off, pre-trip and post-trip inspections on every shift. On-duty work (pickup, fueling, inspections) is still allowed after the limits are reached; only driving is blocked.

## Assumptions and limitations
- Property-carrying driver, 70 hours / 8 days, no adverse driving conditions, no short-haul exceptions.
- Trip starts at 07:00 on the chosen date; average truck speed 55 mph.
- The 70-hour cycle is a plain counter, not a true rolling 8-day window; the recap's line C (last 8 days) is omitted for that reason.
- Sleeper-berth split provisions are not modelled; every rest is a full 10 hours.
- Public OSRM/Nominatim servers are rate-limited, so long trips can take 20-40 seconds. If a city lookup fails, the remark falls back to a mile marker.

## Run locally
**Backend** (Python 3.10+; a virtual environment is recommended)
```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1        # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python manage.py runserver        # http://127.0.0.1:8000  (health check: /api/health/)
```
**Frontend** (Node 18+)
```powershell
cd frontend
npm install
npm run dev                       # http://localhost:5173
```
The frontend reads the API address from `frontend/.env` (`VITE_API_URL`, default `http://localhost:8000`). See `.env.example`.

## API
`POST /api/plan/`
```json
{ "current": "Chicago, IL", "pickup": "Des Moines, IA", "dropoff": "Denver, CO",
  "cycle_used": 20, "start_date": "2026-10-05",
  "carrier": "", "main_office": "", "home_terminal": "", "vehicles": "",
  "driver": "", "co_driver": "", "shipper": "", "commodity": "", "load_number": "" }
```
Returns `route`, `points`, `stops`, `header`, `logs` (per-day segments, totals, remarks, recap) and `summary`. Errors return `{"error": "..."}` with status 400.

## Deployment
| Part | Host | Settings |
|---|---|---|
| Backend | Render / Railway | Root directory `backend`; build `pip install -r requirements.txt`; start `gunicorn config.wsgi --timeout 120`; env vars `DEBUG=0`, `SECRET_KEY=<long random string>` |
| Frontend | Vercel | Root directory `frontend`; framework Vite; env var `VITE_API_URL=<backend URL, no trailing slash>` |

Vite bakes `VITE_API_URL` in at build time, so redeploy the frontend after changing it. Free hosting tiers may sleep when idle, so the first request after a pause can be slow. In `backend/config/settings.py`, replace `CORS_ALLOW_ALL_ORIGINS = True` with `CORS_ALLOWED_ORIGINS = ["https://your-app.vercel.app"]` for production.

## Project structure
```
backend/
  config/            Django settings, urls, wsgi
  trips/
    geo.py           geocoding, routing, reverse geocoding, path helpers
    hos.py           HOS planner and daily-log builder
    views.py         POST /api/plan/
frontend/src/
  App.jsx            form, state, panel and day cards
  MapView.jsx        Leaflet map, route, pins, stops
  SheetSvg.jsx       the daily log drawn as SVG
  LogSheet.jsx       log drawer with downloads
  exportSheet.js     PNG / PDF export
```
