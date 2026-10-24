// Meal voting rules:
// Breakfast: vote the PREVIOUS day, closes 9:00 PM that previous day.
//   So "today's breakfast" was voted on yesterday and is already locked by morning.
// Lunch: closes 9:00 AM same day.
// Dinner: closes 5:00 PM same day.

const IST_OFFSET = 5.5 * 60 * 60 * 1000; // UTC+5:30
function pad(n) { return n.toString().padStart(2, "0"); }

function toIST(d) { return new Date(d.getTime() + IST_OFFSET); }
function dateKey(d) {
  const ist = toIST(d);
  return `${ist.getFullYear()}-${pad(ist.getMonth()+1)}-${pad(ist.getDate())}`;
}

function addDays(d, n) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

// Returns the deadline Date object for a given meal+date, and which "vote date"
// students actually cast that vote on (breakfast is voted the day before).
function getMealMeta(now, meal, targetDateKey) {
  const [y, m, d] = targetDateKey.split("-").map(Number);
  const targetDate = new Date(y, m - 1, d);

  if (meal === "breakfast") {
    const voteDay = addDays(targetDate, -1);
    const deadline = new Date(voteDay);
    deadline.setUTCHours(15, 30, 0, 0); // 9 PM previous day
    return { deadline, voteDateKey: dateKey(voteDay) };
  }
  if (meal === "lunch") {
    const deadline = new Date(targetDate);
    deadline.setUTCHours(3, 30, 0, 0); // 9 AM same day
    return { deadline, voteDateKey: targetDateKey };
  }
  if (meal === "dinner") {
    const deadline = new Date(targetDate);
    deadline.setUTCHours(11, 30, 0, 0); // 5 PM same day
    return { deadline, voteDateKey: targetDateKey };
  }
  throw new Error("Unknown meal: " + meal);
}

function isOpen(now, meal, targetDateKey) {
  const { deadline } = getMealMeta(now, meal, targetDateKey);
  return now.getTime() < deadline.getTime();
}

module.exports = { dateKey, addDays, getMealMeta, isOpen };
