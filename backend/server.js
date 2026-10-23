const express = require("express");
const cors = require("cors");
const { load, save } = require("./db");
const { dateKey, getMealMeta, isOpen } = require("./mealSchedule");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(require("path").join(__dirname, "..", "frontend")));

const MEALS = ["breakfast", "lunch", "dinner"];

// ---------- STUDENT ROUTES ----------

// Get today's 3 meals + this student's current vote + open/close status
app.get("/api/student/:id/today", (req, res) => {
  const db = load();
  const student = db.students.find(s => s.id === req.params.id);
  if (!student) return res.status(404).json({ error: "Student not found" });

  const now = new Date();
  const today = dateKey(now);

  const meals = MEALS.map(meal => {
    const { deadline, voteDateKey } = getMealMeta(now, meal, today);
    const voteKey = `${voteDateKey}_${meal}_${student.id}`;
    const existingVote = db.votes[voteKey];
    return {
      meal,
      deadline: deadline.toISOString(),
      open: now.getTime() < deadline.getTime(),
      myVote: existingVote ? existingVote.choice : null
    };
  });

  res.json({ student, meals, serverTime: now.toISOString() });
});

// Cast or change a vote
app.post("/api/vote", (req, res) => {
  const { studentId, meal, choice } = req.body;
  if (!MEALS.includes(meal)) return res.status(400).json({ error: "Invalid meal" });
  if (!["EAT", "SKIP"].includes(choice)) return res.status(400).json({ error: "Invalid choice" });

  const db = load();
  const student = db.students.find(s => s.id === studentId);
  if (!student) return res.status(404).json({ error: "Student not found" });

  const now = new Date();
  const today = dateKey(now);
  const { deadline, voteDateKey } = getMealMeta(now, meal, today);

  if (now.getTime() >= deadline.getTime()) {
    return res.status(403).json({ error: "Voting closed for this meal" });
  }

  const voteKey = `${voteDateKey}_${meal}_${student.id}`;
  db.votes[voteKey] = { choice, votedAt: now.toISOString() };
  save(db);

  res.json({ ok: true, meal, choice, deadline: deadline.toISOString() });
});

// Voting history for a student
app.get("/api/student/:id/history", (req, res) => {
  const db = load();
  const entries = Object.entries(db.votes)
    .filter(([key]) => key.endsWith(`_${req.params.id}`))
    .map(([key, v]) => {
      const [date, meal] = key.split("_");
      return { date, meal, choice: v.choice, votedAt: v.votedAt };
    })
    .sort((a, b) => (a.date + a.meal).localeCompare(b.date + b.meal))
    .reverse();
  res.json(entries);
});

// ---------- COOK ROUTES ----------

// Live counts + list of who's eating, for a given meal (defaults to today)
app.get("/api/cook/:meal", (req, res) => {
  const { meal } = req.params;
  if (!MEALS.includes(meal)) return res.status(400).json({ error: "Invalid meal" });

  const db = load();
  const now = new Date();
  const today = dateKey(now);
  const { deadline, voteDateKey } = getMealMeta(now, meal, today);

  const rows = db.students.map(student => {
    const voteKey = `${voteDateKey}_${meal}_${student.id}`;
    const vote = db.votes[voteKey];
    return {
      studentId: student.id,
      name: student.name,
      block: student.block,
      room: student.room,
      choice: vote ? vote.choice : "NOT_VOTED"
    };
  });

  const willEat = rows.filter(r => r.choice === "EAT").length;
  const willSkip = rows.filter(r => r.choice === "SKIP").length;
  const notVoted = rows.filter(r => r.choice === "NOT_VOTED").length;

  res.json({
    meal,
    deadline: deadline.toISOString(),
    open: now.getTime() < deadline.getTime(),
    totalStudents: db.students.length,
    willEat,
    willSkip,
    notVoted,
    students: rows
  });
});

// ---------- SEED RESET (handy for demos) ----------
app.post("/api/admin/reset-votes", (req, res) => {
  const db = load();
  db.votes = {};
  save(db);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Smart Hostel Meal backend running on http://0.0.0.0:${PORT}`);
  console.log(`Student app:  http://<your-ip>:${PORT}/index.html`);
  console.log(`Cook dashboard: http://<your-ip>:${PORT}/cook.html`);
});
