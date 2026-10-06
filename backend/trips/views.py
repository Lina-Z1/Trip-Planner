import datetime
import json
import time
import requests
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from .geo import geocode, get_route, Path, Places
from .hos import plan, build_logs

# Log header fields from the paper template; blanks become "N/A" as on the sample log.
HEADER_FIELDS = ("carrier", "main_office", "home_terminal", "vehicles", "driver",
                 "co_driver", "shipper", "commodity", "load_number")


def health(request):
    return JsonResponse({"ok": True})


def index(request):
    return JsonResponse({"service": "ELD Trip Planner API", "endpoints": ["/api/plan/", "/api/health/"]})


@csrf_exempt
@require_POST
def plan_trip(request):
    """POST {current, pickup, dropoff, cycle_used, start_date?, + header fields} -> route, stops, logs."""
    try:
        body = json.loads(request.body)
        names = [str(body[k]).strip() for k in ("current", "pickup", "dropoff")]
        if not all(names):
            raise ValueError("Enter all three locations.")
        cycle_used = float(body.get("cycle_used", 0))
        if not 0 <= cycle_used <= 70:
            raise ValueError("Cycle used must be between 0 and 70 hours.")
        start_date = datetime.date.fromisoformat(body.get("start_date") or datetime.date.today().isoformat())
        header = {k: str(body.get(k) or "").strip() or "N/A" for k in HEADER_FIELDS}

        points = []
        for i, n in enumerate(names):
            if i:
                time.sleep(1)  # Nominatim's usage policy: max 1 request/second
            points.append(geocode(n))

        line, leg_miles = get_route(points)
        total = sum(leg_miles)
        path = Path(line, total)
        trip = plan(path, leg_miles, cycle_used)
        places = Places(path, [(names[0], 0), (names[1], leg_miles[0]), (names[2], total)])
        logs = build_logs(trip, start_date, places, cycle_used)
        arrival = datetime.datetime.combine(start_date, datetime.time()) + datetime.timedelta(hours=trip.arrive)

        return JsonResponse({
            "route": line,
            "points": [{"label": n, "lat": p[0], "lon": p[1]} for n, p in zip(names, points)],
            "stops": trip.stops, "header": header, "logs": logs,
            "summary": {
                "from": names[0], "pickup": names[1], "to": names[2],
                "miles": round(total), "days": len(logs), "arrival": arrival.isoformat(),
                "drive_hours": round(sum(l["totals"]["D"] for l in logs), 1),
            },
        })
    except requests.RequestException:
        # Public map servers can be busy or rate-limited; give a friendly message, not a raw URL.
        return JsonResponse({"error": "The free map service is busy right now. Please wait a minute and try again."}, status=503)
    except (ValueError, KeyError, TypeError) as e:
        return JsonResponse({"error": str(e) or "Invalid request."}, status=400)
