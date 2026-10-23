# Smart Hostel Meal — Voting Flow Prototype

A working end-to-end prototype: students vote "I Will Eat" / "Won't Eat" for
breakfast/lunch/dinner from their phone browser, and the cook sees a live
headcount.

## What's actually built (this prototype)
- Student voting page (mobile-first, works on any phone browser — no app
  install needed)
- Cook dashboard with live counts, auto-refreshing every 5s
- Real deadline logic: breakfast closes 9 PM the day before, lunch closes
  9 AM, dinner closes 5 PM — voting auto-locks after that
- Countdown timers per meal
- 5 demo students seeded (S101–S105)

## What's not built yet (next layers)
Warden dashboard, fines/appeals, QR attendance, analytics charts,
notifications, Google/JWT auth, Postgres. The current backend uses a single
JSON file (`backend/data.json`) as the database — perfect for a prototype,
trivial to swap for Postgres + Prisma later without touching the frontend.

## Run it

```bash
cd backend
npm install
node server.js
```

You'll see:
```
Smart Hostel Meal backend running on http://0.0.0.0:3000
```

## Get it on student phones

The server binds to `0.0.0.0`, so any phone on the **same Wi-Fi** can reach it.

1. Find your laptop's local IP (Mac/Linux: `ifconfig | grep inet`,
   Windows: `ipconfig`) — e.g. `192.168.1.42`
2. On a phone, open: `http://192.168.1.42:3000/index.html`
3. Cook dashboard (on the kitchen's device/tablet):
   `http://192.168.1.42:3000/cook.html`
4. Log in with a demo ID: **S101, S102, S103, S104, or S105**

To actually let students use it from anywhere (not just hostel Wi-Fi),
deploy `backend/` to a host like Railway or Render — same code, just point
the phones at the public URL instead of your local IP. Once deployed, a
student can tap "Add to Home Screen" in their phone browser and it behaves
like an app icon.

## Reset demo votes
```bash
curl -X POST http://localhost:3000/api/admin/reset-votes
```

## Project structure
```
backend/
  server.js        – Express API (vote, cook dashboard, student state)
  mealSchedule.js   – deadline/open-closed logic for breakfast/lunch/dinner
  db.js             – simple JSON-file data store (swap for Postgres later)
backend/data.json   – auto-created on first run (students + votes)
frontend/
  index.html, app.js   – student voting screen
  cook.html, cook.js   – cook live dashboard
  style.css            – shared mobile-first dark theme
```
