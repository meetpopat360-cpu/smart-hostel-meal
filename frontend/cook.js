const API="";
const MEALS=["breakfast","lunch","dinner"];

// date offset: 0=today, 1=tomorrow
let dayOffset=0;
let currentMeal=pickDefaultMeal();
let pollHandle=null;

function pickDefaultMeal(){
  const h=new Date().getHours();
  if(h<9)return"breakfast";
  if(h<17)return"lunch";
  return"dinner";
}

// Get IST date key for offset days from now
function getDateKey(offset){
  const now=new Date();
  const IST=new Date(now.getTime()+5.5*3600000+offset*86400000);
  const y=IST.getUTCFullYear(),m=String(IST.getUTCMonth()+1).padStart(2,"0"),d=String(IST.getUTCDate()).padStart(2,"0");
  return`${y}-${m}-${d}`;
}

function fmtDate(dk){
  const[y,m,d]=dk.split("-").map(Number);
  return new Date(y,m-1,d).toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"});
}

// wire tabs
document.querySelectorAll(".dtab").forEach(t=>{
  t.addEventListener("click",()=>{
    dayOffset=parseInt(t.dataset.offset);
    document.querySelectorAll(".dtab").forEach(x=>x.classList.remove("active"));
    t.classList.add("active");
    load();
  });
});

document.querySelectorAll(".mtab").forEach(t=>{
  t.addEventListener("click",()=>{
    currentMeal=t.dataset.meal;
    document.querySelectorAll(".mtab").forEach(x=>x.classList.remove("active"));
    t.classList.add("active");
    load();
  });
});

// set active meal tab on load
document.querySelectorAll(".mtab").forEach(t=>{
  if(t.dataset.meal===currentMeal)t.classList.add("active");
  else t.classList.remove("active");
});

async function load(){
  const date=getDateKey(dayOffset);
  try{
    const res=await fetch(`${API}/api/cook/${currentMeal}?date=${date}`);
    const data=await res.json();

    document.getElementById("statEat").textContent=data.willEat;
    document.getElementById("statSkip").textContent=data.willSkip;
    document.getElementById("statPend").textContent=data.notVoted;
    document.getElementById("statTotal").textContent=data.totalStudents;

    // status bar
    const bar=document.getElementById("statusBar");
    const label=dayOffset===0?"Today":"Tomorrow";
    bar.innerHTML=`
      <span><b>${currentMeal.charAt(0).toUpperCase()+currentMeal.slice(1)}</b> · ${label} · ${fmtDate(date)}</span>
      <span class="sbadge ${data.open?"open":"closed"}">${data.open?"OPEN":"CLOSED"}</span>`;

    // student list
    document.getElementById("studentList").innerHTML=
      data.students.map(s=>`
        <div class="s-row">
          <div>
            <div class="s-name">${s.name}</div>
            <div class="s-meta">${s.studentId} · Block ${s.block}, Room ${s.room}</div>
          </div>
          <div class="pill ${s.choice}">${s.choice.replace("_"," ")}</div>
        </div>`).join("");
  }catch(e){console.error(e);}
}

load();
pollHandle=setInterval(load,5000);
