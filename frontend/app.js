const API = "";
let studentId = localStorage.getItem("studentId");
let timerHandle = null;

const loginBox    = document.getElementById("loginBox");
const mealsBox    = document.getElementById("mealsBox");
const userChip    = document.getElementById("userChip");
const userName    = document.getElementById("userName");

document.getElementById("switchBtn").addEventListener("click", () => {
  localStorage.removeItem("studentId"); studentId = null; render();
});
document.getElementById("loginBtn").addEventListener("click", login);
document.getElementById("idInput").addEventListener("keydown", e => { if (e.key === "Enter") login(); });

function login() {
  const v = document.getElementById("idInput").value.trim().toUpperCase();
  if (!v) return;
  studentId = v; localStorage.setItem("studentId", v); render();
}

function showToast(msg, color) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.style.background = color || "var(--accent)";
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

function fmtCD(ms) {
  if (ms <= 0) return "Closed";
  const s = Math.floor(ms/1000), h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sc = s%60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sc}s`;
  return `${sc}s`;
}

function fmtDate(dk) {
  const [y,m,d] = dk.split("-").map(Number);
  return new Date(y,m-1,d).toLocaleDateString("en-IN", {weekday:"long",day:"numeric",month:"short"});
}

// ── PUSH NOTIFICATIONS ───────────────────────────────────────
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

async function registerPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    const existing = await reg.pushManager.getSubscription();
    if (existing) return; // already subscribed

    const keyRes = await fetch(`${API}/api/vapid-public-key`);
    const { key } = await keyRes.json();

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key)
    });

    await fetch(`${API}/api/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, subscription: sub })
    });

    showToast("🔔 Reminders enabled!", "#22c55e");
  } catch (e) {
    console.log("Push setup:", e.message);
  }
}

async function askNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") { registerPush(); return; }
  if (Notification.permission === "denied") return;
  const perm = await Notification.requestPermission();
  if (perm === "granted") registerPush();
}

// ── RENDER ───────────────────────────────────────────────────
async function render() {
  if (!studentId) {
    loginBox.style.display = "block";
    mealsBox.innerHTML = "";
    userChip.style.display = "none";
    return;
  }
  loginBox.style.display = "none";

  try {
    const res = await fetch(`${API}/api/student/${studentId}/today`);
    if (!res.ok) {
      const e = await res.json(); showToast(e.error || "Error", "#ef4444");
      localStorage.removeItem("studentId"); studentId = null;
      loginBox.style.display = "block"; userChip.style.display = "none"; return;
    }
    const data = await res.json();
    userName.textContent = `${data.student.name} · ${data.student.id}`;
    userChip.style.display = "flex";

    // Ask for notification permission after login
    askNotificationPermission();

    // Group by date
    const groups = {};
    for (const m of data.meals) {
      if (!groups[m.date]) groups[m.date] = { label: m.label, meals: [] };
      groups[m.date].meals.push(m);
    }

    let html = "";
    for (const [date, g] of Object.entries(groups)) {
      html += `<div class="date-group">
        <div class="date-header">
          <span class="date-tag">${g.label}</span>
          <span class="date-str">${fmtDate(date)}</span>
        </div>
        ${g.meals.map(m => mealCard(m)).join("")}
      </div>`;
    }
    mealsBox.innerHTML = html;

    document.querySelectorAll("[data-meal]").forEach(btn => {
      btn.addEventListener("click", () => vote(btn.dataset.meal, btn.dataset.date, btn.dataset.choice));
    });

    if (timerHandle) clearInterval(timerHandle);
    timerHandle = setInterval(() => tick(data.meals), 1000);
    tick(data.meals);
  } catch(e) { showToast("Can't reach server", "#ef4444"); }
}

function mealCard(m) {
  const eatSel  = m.myVote === "EAT"  ? "selected" : "";
  const skipSel = m.myVote === "SKIP" ? "selected" : "";
  const icons   = { breakfast:"🌅", lunch:"☀️", dinner:"🌙" };
  return `<div class="card${m.open ? "" : " dimmed"}">
    <div class="meal-header">
      <div class="meal-title">${icons[m.meal]} ${m.meal.charAt(0).toUpperCase()+m.meal.slice(1)}</div>
      <div class="badge ${m.open ? "open" : "closed"}">${m.open ? "OPEN" : "CLOSED"}</div>
    </div>
    <div class="countdown">${m.open ? `Closes in <b data-cd="${m.meal}-${m.date}"></b>` : "Voting closed"}</div>
    <div class="vote-row">
      <button class="vote-btn eat ${eatSel}"  data-meal="${m.meal}" data-date="${m.date}" data-choice="EAT"  ${m.open?"":"disabled"}>✅ I Will Eat</button>
      <button class="vote-btn skip ${skipSel}" data-meal="${m.meal}" data-date="${m.date}" data-choice="SKIP" ${m.open?"":"disabled"}>❌ Won't Eat</button>
    </div>
  </div>`;
}

function tick(meals) {
  for (const m of meals) {
    if (!m.open) continue;
    const el = document.querySelector(`[data-cd="${m.meal}-${m.date}"]`);
    if (!el) continue;
    const rem = new Date(m.closesAt).getTime() - Date.now();
    el.textContent = fmtCD(rem);
    if (rem <= 0) render();
  }
}

async function vote(meal, date, choice) {
  try {
    const res = await fetch(`${API}/api/vote`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, meal, date, choice })
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || "Vote failed", "#ef4444"); return; }
    showToast(choice === "EAT" ? `${meal} — Will eat ✅` : `${meal} — Won't eat ❌`, "#22c55e");
    render();
  } catch(e) { showToast("Network error", "#ef4444"); }
}

render();
