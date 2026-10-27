const express   = require("express");
const cors      = require("cors");
const webpush   = require("web-push");
const cron      = require("node-cron");
const path      = require("path");
const { load, save } = require("./db");
const { dateKey, getMealMeta, getRelevantMeals } = require("./mealSchedule");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "frontend")));

const MEALS = ["breakfast", "lunch", "dinner"];

// ── VAPID setup ──────────────────────────────────────────────
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC  || "BEEyotufEr4LssZyUBfcN_gzjjbbq8331Td1kdMAHg4hh2R5QyOsdhbTCg5OtD374fIZnuRzsh3AQGBqnm5ZHvU";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE || "4b9I-E_Mkxhv-I-_ajdpnO1Ox1tjxixNjKI5lsMVkys";

webpush.setVapidDetails("mailto:hostel@meals.app", VAPID_PUBLIC, VAPID_PRIVATE);

// Expose public key so frontend can subscribe
app.get("/api/vapid-public-key", (req, res) => {
  res.json({ key: VAPID_PUBLIC });
});

// ── SUBSCRIBE ────────────────────────────────────────────────
app.post("/api/subscribe", (req, res) => {
  const { studentId, subscription } = req.body;
  if (!studentId || !subscription) return res.status(400).json({ error: "Missing data" });
  const db = load();
  if (!db.subscriptions) db.subscriptions = {};
  db.subscriptions[studentId] = subscription;
  save(db);
  res.json({ ok: true });
});

// ── STUDENT ROUTES ───────────────────────────────────────────
app.get("/api/student/:id/today", (req, res) => {
  const db = load();
  const student = db.students.find(s => s.id === req.params.id);
  if (!student) return res.status(404).json({ error: "Student not found" });
  const now = new Date();
  const meals = getRelevantMeals(now).map(slot => {
    const voteKey = `${slot.date}_${slot.meal}_${student.id}`;
    return { ...slot, myVote: db.votes[voteKey] ? db.votes[voteKey].choice : null };
  });
  res.json({ student, meals, serverTime: now.toISOString() });
});

app.post("/api/vote", (req, res) => {
  const { studentId, meal, date, choice } = req.body;
  if (!MEALS.includes(meal))            return res.status(400).json({ error: "Invalid meal" });
  if (!["EAT","SKIP"].includes(choice)) return res.status(400).json({ error: "Invalid choice" });
  if (!date)                            return res.status(400).json({ error: "Date required" });
  const db = load();
  const student = db.students.find(s => s.id === studentId);
  if (!student) return res.status(404).json({ error: "Student not found" });
  const now = new Date();
  const { opensUTC, closesUTC } = getMealMeta(meal, date);
  if (now < opensUTC)   return res.status(403).json({ error: "Voting not open yet" });
  if (now >= closesUTC) return res.status(403).json({ error: "Voting closed for this meal" });
  db.votes[`${date}_${meal}_${student.id}`] = { choice, votedAt: now.toISOString() };
  save(db);
  res.json({ ok: true, meal, date, choice, closesAt: closesUTC.toISOString() });
});

// ── COOK ROUTES ──────────────────────────────────────────────
app.get("/api/cook/:meal", (req, res) => {
  const { meal } = req.params;
  const dateParam = req.query.date;
  if (!MEALS.includes(meal)) return res.status(400).json({ error: "Invalid meal" });
  const db = load();
  const now = new Date();
  const targetDate = dateParam || dateKey(now);
  const { opensUTC, closesUTC } = getMealMeta(meal, targetDate);
  const rows = db.students.map(s => {
    const vote = db.votes[`${targetDate}_${meal}_${s.id}`];
    return { studentId: s.id, name: s.name, block: s.block, room: s.room, choice: vote ? vote.choice : "NOT_VOTED" };
  });
  res.json({
    meal, date: targetDate,
    opensAt: opensUTC.toISOString(), closesAt: closesUTC.toISOString(),
    open: now >= opensUTC && now < closesUTC,
    totalStudents: db.students.length,
    willEat:  rows.filter(r => r.choice === "EAT").length,
    willSkip: rows.filter(r => r.choice === "SKIP").length,
    notVoted: rows.filter(r => r.choice === "NOT_VOTED").length,
    students: rows
  });
});

app.post("/api/admin/reset-votes", (req, res) => {
  const db = load(); db.votes = {}; save(db);
  res.json({ ok: true });
});

// ── PUSH NOTIFICATION SENDER ─────────────────────────────────
async function sendReminder(meal, closesAt) {
  const db = load();
  if (!db.subscriptions) return;

  const icons = { breakfast: "🌅", lunch: "☀️", dinner: "🌙" };
  const payload = JSON.stringify({
    title: `${icons[meal]} ${meal.charAt(0).toUpperCase()+meal.slice(1)} Poll Closing Soon!`,
    body:  `30 minutes left! Poll closes at ${closesAt}. Vote now →`,
    url:   "/"
  });

  const subs = Object.values(db.subscriptions);
  console.log(`[Push] Sending ${meal} reminder to ${subs.length} subscribers`);

  let failed = 0;
  await Promise.all(subs.map(async sub => {
    try {
      await webpush.sendNotification(sub, payload);
    } catch (e) {
      failed++;
      console.log(`[Push] Failed for a sub: ${e.statusCode}`);
    }
  }));
  console.log(`[Push] Done — ${subs.length - failed} sent, ${failed} failed`);
}

// ── CRON SCHEDULES (UTC times = IST - 5:30) ─────────────────
// Breakfast closes 7:00 AM IST → remind 6:30 AM IST = 01:00 UTC
cron.schedule("0 1 * * *", () => sendReminder("breakfast", "7:00 AM"));

// Lunch closes 9:00 AM IST → remind 8:30 AM IST = 03:00 UTC
cron.schedule("0 3 * * *", () => sendReminder("lunch", "9:00 AM"));

// Dinner closes 5:00 PM IST → remind 4:30 PM IST = 11:00 UTC
cron.schedule("0 11 * * *", () => sendReminder("dinner", "5:00 PM"));

console.log("[Cron] Reminders scheduled: 6:30 AM · 8:30 AM · 4:30 PM IST");

// ── START ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`Smart Hostel Meal running on http://0.0.0.0:${PORT}`)
);
