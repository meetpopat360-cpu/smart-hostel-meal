const IST_OFFSET = 5.5 * 60 * 60 * 1000;

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

function getMealMeta(meal, targetDateKey) {
  const [y, m, d] = targetDateKey.split("-").map(Number);
  const midIST = new Date(Date.UTC(y, m-1, d, 0, 0, 0)).getTime() - IST_OFFSET;
  if (meal === "breakfast") return {
    opensUTC:  new Date(midIST - 15 * 3600000),
    closesUTC: new Date(midIST +  7 * 3600000)
  };
  if (meal === "lunch") return {
    opensUTC:  new Date(midIST - 11 * 3600000),
    closesUTC: new Date(midIST +  9 * 3600000)
  };
  if (meal === "dinner") return {
    opensUTC:  new Date(midIST -  3 * 3600000),
    closesUTC: new Date(midIST + 17 * 3600000)
  };
  throw new Error("Unknown meal: " + meal);
}

function getRelevantMeals(now) {
  const MEALS = ["breakfast", "lunch", "dinner"];
  const nowMs = now.getTime();
  const todayKey    = dateKey(now);
  const tomorrowKey = dateKey(addDays(now, 1));
  const result = [];

  for (const meal of MEALS) {
    const { opensUTC, closesUTC } = getMealMeta(meal, todayKey);
    result.push({
      meal, date: todayKey, label: "Today",
      open: nowMs >= opensUTC.getTime() && nowMs < closesUTC.getTime(),
      opensAt: opensUTC.toISOString(), closesAt: closesUTC.toISOString()
    });
  }

  for (const meal of MEALS) {
    const { opensUTC, closesUTC } = getMealMeta(meal, tomorrowKey);
    if (nowMs >= opensUTC.getTime()) {
      result.push({
        meal, date: tomorrowKey, label: "Tomorrow",
        open: nowMs < closesUTC.getTime(),
        opensAt: opensUTC.toISOString(), closesAt: closesUTC.toISOString()
      });
    }
  }
  return result;
}

module.exports = { dateKey, addDays, getMealMeta, getRelevantMeals };
