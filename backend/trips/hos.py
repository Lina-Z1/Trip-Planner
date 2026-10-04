"""
Hours-of-Service (HOS) planner - property-carrying driver, 70 hr / 8 day, no adverse conditions.

"""
import datetime

TRUCK_MPH = 55
MAX_DRIVE, MAX_WINDOW, BREAK_AFTER, CYCLE, FUEL_EVERY = 11, 14, 8, 70, 1000
PRE_TRIP = POST_TRIP = 0.25
EPS = 1e-9
START_HOUR = 7.0  # the trip begins at 07:00 on day 1


class Planner:
    def __init__(self, cycle_used, path):
        self.path = path
        self.t = START_HOUR                # clock, hours since midnight of day 1
        self.cycle = cycle_used            # on-duty hours counted toward the 70-hr limit
        self.miles = 0.0
        self.since_fuel = 0.0
        self.shift_start = None            # when the current 14-hour window opened
        self.drive_shift = 0.0             # driving hours this shift
        self.drive_break = 0.0             # driving hours since the last 30-min break
        self.segs, self.stops, self.arrive = [], [], None

    # ---- helpers -----------------------------------------------------------
    def _add(self, status, hours, label, miles=0.0):
        """Append a timeline segment and advance the clock."""
        self.segs.append(dict(status=status, start=self.t, end=self.t + hours,
                              label=label, miles=miles, mile=self.miles))
        self.t += hours

    def _stop(self, kind, label, hours):
        """Record a map marker (fuel, rest, break, pickup, drop-off)."""
        lat, lon = self.path.at(self.miles)
        self.stops.append(dict(type=kind, label=label, lat=lat, lon=lon, mile=round(self.miles), hours=hours))

    def _begin_shift(self):
        """Every shift opens with a short on-duty pre-trip inspection."""
        if self.shift_start is None:
            self.shift_start = self.t
            self._add("ON", PRE_TRIP, "Pre-trip inspection / TIV")
            self.cycle += PRE_TRIP

    def post_trip(self):
        """...and closes with a post-trip inspection."""
        if self.shift_start is not None:
            self._add("ON", POST_TRIP, "Post-trip inspection")
            self.cycle += POST_TRIP

    def _new_shift(self):
        self.shift_start, self.drive_shift, self.drive_break = None, 0.0, 0.0

    def _rest(self):
        """10 hours in the sleeper berth."""
        self.post_trip()
        self._stop("rest", "10-hr rest", 10)
        self._add("SB", 10, "10-hr rest")
        self._new_shift()

    def _restart(self):
        """34 consecutive hours off duty resets the 70-hour cycle."""
        self.post_trip()
        self._stop("rest", "34-hr restart", 34)
        self._add("OFF", 34, "34-hr restart")
        self.cycle = 0.0
        self._new_shift()

    # ---- activities --------------------------------------------------------
    def on_duty(self, hours, label, kind=None):
        """On-duty (not driving) work is allowed even after the window/cycle is used up: no forced rest here."""
        self._begin_shift()
        if kind:
            self._stop(kind, label, hours)
        self._add("ON", hours, label)
        self.cycle += hours
        if hours >= 0.5:
            self.drive_break = 0.0  # 30+ min of on-duty time also satisfies the break rule

    def drive(self, miles, label):
        """Drive `miles`, inserting breaks, fuel stops and rests exactly when a rule demands it."""
        remaining = miles
        while remaining > EPS:
            if CYCLE - self.cycle <= EPS:
                self._restart(); continue
            self._begin_shift()
            if CYCLE - self.cycle <= EPS:
                continue                                    # the inspection used the last cycle minutes
            window_left = MAX_WINDOW - (self.t - self.shift_start)
            drive_left = MAX_DRIVE - self.drive_shift
            if window_left <= EPS or drive_left <= EPS:
                self._rest(); continue
            if BREAK_AFTER - self.drive_break <= EPS:
                self._stop("break", "30-min break", 0.5)
                self._add("OFF", 0.5, "30-min break")
                self.drive_break = 0.0; continue
            if FUEL_EVERY - self.since_fuel <= EPS:
                self.on_duty(0.5, "Fueling", "fuel"); self.since_fuel = 0.0; continue
            # Drive until the first limit is reached (or the leg ends).
            hrs = min(remaining / TRUCK_MPH, window_left, drive_left, BREAK_AFTER - self.drive_break,
                      CYCLE - self.cycle, (FUEL_EVERY - self.since_fuel) / TRUCK_MPH)
            m = hrs * TRUCK_MPH
            self._add("D", hrs, label, m)
            self.miles += m; self.since_fuel += m; remaining -= m
            self.cycle += hrs; self.drive_shift += hrs; self.drive_break += hrs


def plan(path, leg_miles, cycle_used):
    p = Planner(cycle_used, path)
    p.drive(leg_miles[0], "Driving to pickup")
    p.on_duty(1, "Pickup - loading", "pickup")
    p.drive(leg_miles[1], "Driving to drop-off")
    p.on_duty(1, "Drop-off - unloading", "dropoff")
    p.arrive = p.t
    p.post_trip()
    return p


def build_logs(p, start_date, resolve, cycle_used):
    """Cut the timeline into 24-hour daily log sheets. `resolve(mile)` returns 'City, ST'."""
    days = {}
    for s in p.segs:
        a, length = s["start"], s["end"] - s["start"]
        while a < s["end"] - EPS:
            d = int(a // 24)
            e = min(s["end"], (d + 1) * 24)                  # split segments that cross midnight
            days.setdefault(d, []).append(dict(
                status=s["status"], start=a - 24 * d, end=e - 24 * d, label=s["label"],
                miles=s["miles"] * (e - a) / length, mile=s["mile"] + s["miles"] * (a - s["start"]) / length))
            a = e

    logs, running, cum = [], cycle_used, 0.0
    for d in sorted(days):
        segs = days[d]
        for s in segs:                                         # 70-hr recap: plain running counter
            if s["label"] == "34-hr restart":
                running = 0.0
            elif s["status"] in ("D", "ON"):
                running += s["end"] - s["start"]
        start_mile, end_mile = segs[0]["mile"], segs[-1]["mile"] + segs[-1]["miles"]
        if segs[0]["start"] > EPS:                             # pad so the sheet always covers 0-24h
            segs.insert(0, dict(status="OFF", start=0, end=segs[0]["start"], label="Off duty", miles=0, mile=start_mile))
        if segs[-1]["end"] < 24 - EPS:
            segs.append(dict(status="OFF", start=segs[-1]["end"], end=24, label="Off duty", miles=0, mile=end_mile))

        merged = []                                            # neighbours with the same status share one line
        for s in segs:
            if merged and merged[-1]["status"] == s["status"]:
                merged[-1]["end"] = s["end"]
            else:
                merged.append(dict(status=s["status"], start=s["start"], end=s["end"]))
        totals = {k: 0.0 for k in ("OFF", "SB", "D", "ON")}
        for s in merged:
            totals[s["status"]] += s["end"] - s["start"]

        remarks, prev = [], None                               # a city/state for every change of duty status
        for i, s in enumerate(segs):
            if i == 0 or s["label"] != prev:
                remarks.append(dict(time=s["start"], label=s["label"], place=resolve(s["mile"])))
            prev = s["label"]

        day_miles = sum(s["miles"] for s in segs)
        cum += day_miles
        logs.append(dict(
            date=(start_date + datetime.timedelta(days=d)).isoformat(),
            segments=merged, remarks=remarks, totals={k: round(v, 2) for k, v in totals.items()},
            miles=round(day_miles), cum_miles=round(cum), on_duty=round(totals["D"] + totals["ON"], 2),
            recap=dict(a=round(running, 2), b=round(max(0.0, CYCLE - running), 2)),
            from_place=resolve(start_mile), to_place=resolve(end_mile),
            route=[[round(la, 4), round(lo, 4)] for la, lo in p.path.slice(start_mile, end_mile)]))
    return logs
