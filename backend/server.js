const express = require("express");
const cors = require("cors");
const { load, save } = require("./db");
const { dateKey, getMealMeta, getRelevantMeals } = require("./mealSchedule");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(require("path").join(__dirname, "..", "frontend")));

const MEALS = ["breakfast", "lunch", "dinner"];

app.get("/api/student/:id/today", (req, res) => {
  const db = load();
  const student = db.students.find(s => s.id === req.params.id);
  if (!student) return res.status(404).json({ error: "Student not found" });

  const now = new Date();
  const slots = getRelevantMeals(now);

  const meals = slots.map(slot => {
    const voteKey = `${slot.date}_${slot.meal}_${student.id}`;
    return { ...slot, myVote: db.votes[voteKey] ? db.votes[voteKey].choice : null };
  });

  res.json({ student, meals, serverTime: now.toISOString() });
});

app.post("/api/vote", (req, res) => {
  const { studentId, meal, date, choice } = req.body;
  if (!MEALS.includes(meal))         return res.status(400).json({ error: "Invalid meal" });
  if (!["EAT","SKIP"].includes(choice)) return res.status(400).json({ error: "Invalid choice" });
  if (!date)                          return res.status(400).json({ error: "Date required" });

  const db = load();
  const student = db.students.find(s => s.id === studentId);
  if (!student) return res.status(404).json({ error: "Student not found" });

  const now = new Date();
  const { opensUTC, closesUTC } = getMealMeta(meal, date);
  if (now < opensUTC)  return res.status(403).json({ error: "Voting not open yet" });
  if (now >= closesUTC) return res.status(403).json({ error: "Voting closed for this meal" });

  const voteKey = `${date}_${meal}_${student.id}`;
  db.votes[voteKey] = { choice, votedAt: now.toISOString() };
  save(db);

  res.json({ ok: true, meal, date, choice, closesAt: closesUTC.toISOString() });
});

app.get("/api/cook/:meal", (req, res) => {
  const { meal } = req.params;
  const dateParam = req.query.date;
  if (!MEALS.includes(meal)) return res.status(400).json({ error: "Invalid meal" });

  const db = load();
  const now = new Date();
  const targetDate = dateParam || dateKey(now);
  const { opensUTC, closesUTC } = getMealMeta(meal, targetDate);

  const rows = db.students.map(student => {
    const voteKey = `${targetDate}_${meal}_${student.id}`;
    const vote = db.votes[voteKey];
    return { studentId: student.id, name: student.name, block: student.block, room: student.room, choice: vote ? vote.choice : "NOT_VOTED" };
  });

  res.json({
    meal, date: targetDate,
    opensAt: opensUTC.toISOString(), closesAt: closesUTC.toISOString(),
    open: now >= opensUTC && now < closesUTC,
    totalStudents: db.students.length,
    willEat:   rows.filter(r => r.choice === "EAT").length,
    willSkip:  rows.filter(r => r.choice === "SKIP").length,
    notVoted:  rows.filter(r => r.choice === "NOT_VOTED").length,
    students: rows
  });
});

app.post("/api/admin/reset-votes", (req, res) => {
  const db = load(); db.votes = {}; save(db);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`Running on http://0.0.0.0:${PORT}`));
