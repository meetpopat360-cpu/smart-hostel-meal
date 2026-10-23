const API = ""; // same origin

let studentId = localStorage.getItem("studentId");
let timerHandle = null;

const loginBox = document.getElementById("loginBox");
const mealsBox = document.getElementById("mealsBox");
const studentLabel = document.getElementById("studentLabel");

document.getElementById("switchBtn").addEventListener("click", () => {
  localStorage.removeItem("studentId");
  studentId = null;
  render();
});

document.getElementById("loginBtn").addEventListener("click", login);
document.getElementById("idInput").addEventListener("keydown", e => {
  if (e.key === "Enter") login();
});

function login() {
  const val = document.getElementById("idInput").value.trim().toUpperCase();
  if (!val) return;
  studentId = val;
  localStorage.setItem("studentId", val);
  render();
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1800);
}

function fmtCountdown(ms) {
  if (ms <= 0) return "Closed";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

async function render() {
  if (!studentId) {
    loginBox.style.display = "block";
    mealsBox.innerHTML = "";
    studentLabel.textContent = "Not logged in";
    return;
  }

  loginBox.style.display = "none";

  try {
    const res = await fetch(`${API}/api/student/${studentId}/today`);
    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || "Error");
      localStorage.removeItem("studentId");
      studentId = null;
      loginBox.style.display = "block";
      return;
    }
    const data = await res.json();
    studentLabel.textContent = `${data.student.name} • ${data.student.id} • Block ${data.student.block}`;

    mealsBox.innerHTML = data.meals.map(m => mealCardHtml(m)).join("");

    data.meals.forEach(m => {
      document.querySelectorAll(`[data-meal="${m.meal}"]`).forEach(btn => {
        btn.addEventListener("click", () => vote(m.meal, btn.dataset.choice));
      });
    });

    if (timerHandle) clearInterval(timerHandle);
    timerHandle = setInterval(() => tickCountdowns(data.meals), 1000);
    tickCountdowns(data.meals);
  } catch (e) {
    showToast("Can't reach server");
  }
}

function mealCardHtml(m) {
  const eatSel = m.myVote === "EAT" ? "selected" : "";
  const skipSel = m.myVote === "SKIP" ? "selected" : "";
  return `
  <div class="card meal-card" data-card="${m.meal}">
    <div class="meal-header">
      <div class="meal-title">${m.meal}</div>
      <div class="badge ${m.open ? "open" : "closed"}">${m.open ? "OPEN" : "CLOSED"}</div>
    </div>
    <div class="countdown" data-deadline="${m.deadline}" data-meal-label="${m.meal}">
      ${m.open ? "Closes in <b data-cd></b>" : "Voting closed"}
    </div>
    <div class="vote-row">
      <button class="vote-btn eat ${eatSel}" data-meal="${m.meal}" data-choice="EAT" ${m.open ? "" : "disabled"}>✅ I Will Eat</button>
      <button class="vote-btn skip ${skipSel}" data-meal="${m.meal}" data-choice="SKIP" ${m.open ? "" : "disabled"}>❌ Won't Eat</button>
    </div>
  </div>`;
}

function tickCountdowns() {
  document.querySelectorAll("[data-deadline]").forEach(el => {
    const deadline = new Date(el.dataset.deadline).getTime();
    const now = Date.now();
    const cdEl = el.querySelector("[data-cd]");
    if (!cdEl) return;
    const remaining = deadline - now;
    cdEl.textContent = fmtCountdown(remaining);
    if (remaining <= 0) render(); // refresh full state once it closes
  });
}

async function vote(meal, choice) {
  try {
    const res = await fetch(`${API}/api/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, meal, choice })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || "Vote failed");
      return;
    }
    showToast(`${meal} vote saved: ${choice === "EAT" ? "Will eat ✅" : "Won't eat ❌"}`);
    render();
  } catch (e) {
    showToast("Network error");
  }
}

render();
