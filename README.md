# Trip Planner

<img width="1366" height="587" alt="Screenshot (6247)" src="https://github.com/user-attachments/assets/8e22516d-b960-4e86-a6b4-e549184a439f" />
<img width="1366" height="585" alt="Screenshot (6248)" src="https://github.com/user-attachments/assets/faba3a45-29c7-48f4-9edf-773bd8bbd745" />
<img width="1366" height="587" alt="Screenshot (6249)" src="https://github.com/user-attachments/assets/6792537f-1b98-4540-9e6f-4926746157e7" />

</br>
</br>

A full-stack app (Django + React) that takes a trip and returns a **route map with stops and rests** plus **filled-in ELD daily log sheets**, following US hours-of-service (HOS) rules for a property-carrying driver on a 70-hour / 8-day cycle.

- **Live app:**  [Visit Website]( https://trip-planner-project.netlify.app/)
- **API:**  [_View API](https://trip-planner-project-vfib.onrender.com/)
 

 

## Features
- Inputs: current location, pickup, drop-off, cycle hours already used (plus start date and optional log header fields such as carrier, vehicles, shipper, commodity, load number).
- Route on an OpenStreetMap map with lettered pins (A start, B pickup, C drop-off) and markers for fuel stops, breaks and rests.
- One paper-style daily log sheet per day: 24-hour graph, totals, remarks with a city at every duty-status change, and a 70-hour recap.
- Download any sheet as PNG or PDF, or all sheets in one PDF.
- Responsive: on phones the panel becomes a bottom sheet that can be hidden so the map fills the screen.



