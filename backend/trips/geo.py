"""Geocoding (Nominatim) and routing (OSRM). Both are free and need no API key."""
import bisect
import math
import time
import requests

HEADERS = {"User-Agent": "eld-trip-planner/1.0 (assessment project)"}  # Nominatim requires this


def geocode(query):
    """Turn free text ('Dallas, TX') into (lat, lon)."""
    r = requests.get("https://nominatim.openstreetmap.org/search",
                     params={"q": query, "format": "json", "limit": 1}, headers=HEADERS, timeout=15)
    r.raise_for_status()
    data = r.json()
    if not data:
        raise ValueError(f"Could not find a location for '{query}'.")
    return float(data[0]["lat"]), float(data[0]["lon"])


def reverse_geocode(lat, lon):
    """Turn coordinates into 'City, ST' (what the Remarks section of a log requires)."""
    r = requests.get("https://nominatim.openstreetmap.org/reverse",
                     params={"lat": lat, "lon": lon, "format": "jsonv2", "zoom": 10, "addressdetails": 1},
                     headers=HEADERS, timeout=10)
    r.raise_for_status()
    a = r.json().get("address", {})
    city = a.get("city") or a.get("town") or a.get("village") or a.get("hamlet") or a.get("municipality") or a.get("county")
    state = (a.get("ISO3166-2-lvl4") or "").split("-")[-1] or a.get("state")  # 'US-IL' -> 'IL'
    return ", ".join(x for x in (city, state) if x) or None


def get_route(points):
    """Route through [(lat, lon), ...]. Returns (polyline, [leg_miles, ...])."""
    coords = ";".join(f"{lon},{lat}" for lat, lon in points)  # OSRM wants lon,lat
    r = requests.get(f"https://router.project-osrm.org/route/v1/driving/{coords}",
                     params={"overview": "simplified", "geometries": "geojson"}, timeout=30)
    r.raise_for_status()
    data = r.json()
    if data.get("code") != "Ok":
        raise ValueError("No drivable route found between those locations.")
    route = data["routes"][0]
    line = [(lat, lon) for lon, lat in route["geometry"]["coordinates"]]
    return line, [leg["distance"] / 1609.344 for leg in route["legs"]]  # metres -> miles


def _haversine(a, b):
    """Great-circle distance in miles."""
    la1, lo1, la2, lo2 = map(math.radians, (*a, *b))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 3958.8 * 2 * math.asin(math.sqrt(h))


class Path:
    """Answers 'where is the truck after N miles?' by interpolating along the route polyline."""

    def __init__(self, line, total_miles):
        cum = [0.0]
        for i in range(1, len(line)):
            cum.append(cum[-1] + _haversine(line[i - 1], line[i]))
        scale = total_miles / cum[-1] if cum[-1] else 0  # align with OSRM's road distance
        self.line, self.cum = line, [c * scale for c in cum]

    def at(self, mile):
        mile = min(max(mile, 0), self.cum[-1])
        i = max(bisect.bisect_left(self.cum, mile), 1)
        a, b = self.cum[i - 1], self.cum[i]
        f = (mile - a) / (b - a) if b > a else 0
        (la1, lo1), (la2, lo2) = self.line[i - 1], self.line[i]
        return la1 + (la2 - la1) * f, lo1 + (lo2 - lo1) * f

    def slice(self, m0, m1):
        """The part of the route between two mile markers (used to highlight one day on the map)."""
        inner = [p for p, c in zip(self.line, self.cum) if m0 < c < m1]
        return [self.at(m0), *inner, self.at(m1)]


_CACHE = {}  # (rounded lat, rounded lon) -> 'City, ST', shared across requests


class Places:
    """Mile marker -> 'City, ST'. User-typed names are reused for start/pickup/drop-off;
    everything else is reverse geocoded (1 request/second, cached, with a time budget)."""

    def __init__(self, path, anchors, budget=45):
        self.path, self.anchors = path, anchors            # anchors: [(typed name, mile), ...]
        self.deadline = time.monotonic() + budget

    def __call__(self, mile):
        for name, ref in self.anchors:
            if abs(mile - ref) < 0.5:
                return name
        lat, lon = self.path.at(mile)
        key = (round(lat, 2), round(lon, 2))
        if key not in _CACHE and time.monotonic() < self.deadline:
            time.sleep(1)                                   # Nominatim usage policy
            try:
                label = reverse_geocode(lat, lon)
                if label:
                    _CACHE[key] = label
            except requests.RequestException:
                pass
        return _CACHE.get(key) or f"Mile {mile:.0f} ({lat:.2f}, {lon:.2f})"  # fallback if lookup failed
