let currentMeal = pickDefaultMeal();

function pickDefaultMeal() {
  const h = new Date().getHours();
  if (h < 9) return "breakfast";
  if (h < 17) return "lunch";
  return "dinner";
}

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    currentMeal = tab.dataset.meal;
    load();
  });
});

function highlightTab() {
  document.querySelectorAll(".tab").forEach(t => {
    t.classList.toggle("active", t.dataset.meal === currentMeal);
  });
}

async function load() {
  highlightTab();
  try {
    const res = await fetch(`/api/cook/${currentMeal}`);
    const data = await res.json();

    document.getElementById("statEat").textContent = data.willEat;
    document.getElementById("statSkip").textContent = data.willSkip;
    document.getElementById("statPending").textContent = data.notVoted;

    document.getElementById("mealStatusLabel").textContent =
      `${data.meal[0].toUpperCase() + data.meal.slice(1)} — ${data.totalStudents} students`;
    const badge = document.getElementById("mealBadge");
    badge.textContent = data.open ? "OPEN" : "CLOSED";
    badge.className = "badge " + (data.open ? "open" : "closed");

    document.getElementById("studentList").innerHTML = data.students.map(s => `
      <div class="student-row">
        <div>
          <div>${s.name}</div>
          <div class="student-meta">${s.studentId} • Block ${s.block}, Room ${s.room}</div>
        </div>
        <div class="choice-pill ${s.choice}">${s.choice.replace("_", " ")}</div>
      </div>
    `).join("");
  } catch (e) {
    console.error(e);
  }
}

load();
setInterval(load, 5000);
