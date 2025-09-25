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
  COLUMNS: { name: "Name", attendance: "Attendance" },
  TITLE: "Snukendo Attendance Leaderboard"
};
```

Column names must exactly match your sheet headers (case-insensitive).

## 3) Run locally
Just open `index.html` in your browser. If the sheet is public/viewable, the data will load.

If your browser blocks cross-origin requests from a local file, you can run a quick static server:

```bash
# Python 3
python -m http.server 8080
# then open http://localhost:8080
```

## 4) Deploy to Netlify
1. Commit and push this repo to GitHub
2. In Netlify, choose "Add new site" → "Import an existing project"
3. Select your GitHub repo, leave build settings empty (no build step), and set Publish directory to the repo root
4. Deploy. Your site will be live at `https://<yoursite>.netlify.app`

Optional: add a custom domain in Netlify.

## Data format
Minimum columns:
- `Name`: string
- `Attendance`: number (total sessions)

Extra columns are ignored.

## Notes
- Ranks handle ties (same attendance → same rank)
- Top 3 are highlighted with gold/silver/bronze
- Search filters by member name in real time
