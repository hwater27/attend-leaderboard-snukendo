# Snukendo Attendance Leaderboard

Simple, stylish leaderboard that pulls attendance rankings from a Google Sheet and displays them on a static site. Deployable to Netlify in minutes.

## 1) Prepare your Google Sheet
- Create a sheet with headers, e.g. `Name`, `Attendance` (totals as numbers)
- Share the sheet so anyone with the link can view, or use File → Share → Publish to the web
- Copy the Sheet ID (from the URL: between `/d/` and `/edit`) and the tab `gid`

## 2) Configure the site
Edit `config.js`:

```
window.LEADERBOARD_CONFIG = {
  SHEET_ID: "YOUR_SHEET_ID",
  GID: "0",
  COLUMNS: { name: "Name", attendance: "Attendance", events: "Events" },
}

## Data format
Minimum columns:
- `Name`: string
- `Attendance`: number (total sessions)
- Optional `Events`: number (extra sessions)

Extra columns are ignored.

## Notes
- Ranks handle ties (same attendance → same rank)
- Top 3 are highlighted with gold/silver/bronze
- Search filters by member name in real time
 - Toggle between Base and +Events using the switch next to Search
