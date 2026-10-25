const API = "";
let studentId = localStorage.getItem("studentId");
let timerHandle = null;

const loginBox = document.getElementById("loginBox");
const mealsBox = document.getElementById("mealsBox");
const studentLabel = document.getElementById("studentLabel");

document.getElementById("switchBtn").addEventListener("click", () => {
  localStorage.removeItem("studentId"); studentId = null; render();
});
document.getElementById("loginBtn").addEventListener("click", login);
document.getElementById("idInput").addEventListener("keydown", e => { if (e.key === "Enter") login(); });

function login() {
  const val = document.getElementById("idInput").value.trim().toUpperCase();
  if (!val) return;
  studentId = val;
  localStorage.setItem("studentId", val);
  render();
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1800);
}

function fmtCountdown(ms) {
  if (ms <= 0) return "Closed";
  const s = Math.floor(ms/1000), h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function fmtDate(dk) {
  const [y,m,d] = dk.split("-").map(Number);
  return new Date(y,m-1,d).toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"});
}

async function render() {
  if (!studentId) {
    loginBox.style.display = "block"; mealsBox.innerHTML = "";
    studentLabel.textContent = "Not logged in"; return;
  }
  loginBox.style.display = "none";

  try {
    const res = await fetch(`${API}/api/student/${studentId}/today`);
    if (!res.ok) {
      const err = await res.json(); showToast(err.error || "Error");
      localStorage.removeItem("studentId"); studentId = null;
      loginBox.style.display = "block"; return;
    }
    const data = await res.json();
    studentLabel.textContent = `${data.student.name} • ${data.student.id} • Block ${data.student.block}`;

    // Group by date
    const groups = {};
    for (const m of data.meals) {
      if (!groups[m.date]) groups[m.date] = { label: m.label, meals: [] };
      groups[m.date].meals.push(m);
    }

    let html = "";
    for (const [date, g] of Object.entries(groups)) {
      html += `<div class="date-group">
        <div class="date-label">${g.label} · ${fmtDate(date)}</div>
        ${g.meals.map(m => mealCardHtml(m)).join("")}
      </div>`;
    }
    mealsBox.innerHTML = html;

    document.querySelectorAll("[data-meal]").forEach(btn => {
      btn.addEventListener("click", () => vote(btn.dataset.meal, btn.dataset.date, btn.dataset.choice));
    });

    if (timerHandle) clearInterval(timerHandle);
    timerHandle = setInterval(() => tickCountdowns(data.meals), 1000);
    tickCountdowns(data.meals);
  } catch(e) { showToast("Can't reach server"); }
}

function mealCardHtml(m) {
  const eatSel  = m.myVote === "EAT"  ? "selected" : "";
  const skipSel = m.myVote === "SKIP" ? "selected" : "";
  const dis = m.open ? "" : "disabled";
  return `
  <div class="card meal-card ${m.open ? "" : "dimmed"}">
    <div class="meal-header">
      <div class="meal-title">${m.meal.charAt(0).toUpperCase()+m.meal.slice(1)}</div>
      <div class="badge ${m.open ? "open" : "closed"}">${m.open ? "OPEN" : "CLOSED"}</div>
    </div>
    <div class="countdown">
      ${m.open ? `Closes in <b data-cd="${m.meal}-${m.date}"></b>` : "Voting closed"}
    </div>
    <div class="vote-row">
      <button class="vote-btn eat ${eatSel}" data-meal="${m.meal}" data-date="${m.date}" data-choice="EAT" ${dis}>✅ I Will Eat</button>
      <button class="vote-btn skip ${skipSel}" data-meal="${m.meal}" data-date="${m.date}" data-choice="SKIP" ${dis}>❌ Won't Eat</button>
    </div>
  </div>`;
}

function tickCountdowns(meals) {
  for (const m of meals) {
    if (!m.open) continue;
    const el = document.querySelector(`[data-cd="${m.meal}-${m.date}"]`);
    if (!el) continue;
    const rem = new Date(m.closesAt).getTime() - Date.now();
    el.textContent = fmtCountdown(rem);
    if (rem <= 0) render();
  }
}

async function vote(meal, date, choice) {
  try {
    const res = await fetch(`${API}/api/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, meal, date, choice })
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || "Vote failed"); return; }
    showToast(`${meal} vote saved: ${choice === "EAT" ? "Will eat ✅" : "Won't eat ❌"}`);
    render();
  } catch(e) { showToast("Network error"); }
}

render();
