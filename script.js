// ============================================================
//  FOLD — script.js
//  API key is now handled by server.js — no key needed here
// ============================================================

// ===== STATE =====
let logs = JSON.parse(localStorage.getItem("fold-logs") || "[]");

function saveLogs() {
  localStorage.setItem("fold-logs", JSON.stringify(logs));
}

function updateStreak() {
  document.getElementById("streak-count").textContent = logs.length;
}

// ===== NAV TAB SWITCHING =====
const navBtns = document.querySelectorAll(".nav-btn");
const tabs    = document.querySelectorAll(".tab");

navBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;
    navBtns.forEach(b => b.classList.remove("active"));
    tabs.forEach(t => t.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${target}`).classList.add("active");
    if (target === "history")   renderHistory();
    if (target === "dashboard") renderDashboard();
  });
});

// ===== INTENSITY SLIDER =====
const slider  = document.getElementById("intensity-slider");
const display = document.getElementById("intensity-display");

slider.addEventListener("input", () => {
  display.textContent = `${slider.value} / 10`;
  const hue = Math.round(120 - (slider.value - 1) * 13);
  display.style.color = `hsl(${hue}, 85%, 65%)`;
});

// ===== SUBMIT =====
const submitBtn    = document.getElementById("submit-btn");
const triggerInput = document.getElementById("trigger-input");
const responseCard = document.getElementById("response-card");
const responseText = document.getElementById("response-text");
const loadingCard  = document.getElementById("loading-card");

submitBtn.addEventListener("click", async () => {
  const intensity = parseInt(slider.value);
  const trigger   = triggerInput.value.trim();

  if (!trigger) {
    triggerInput.style.borderColor = "var(--danger)";
    triggerInput.placeholder = "Please describe what's triggering this urge...";
    return;
  }

  triggerInput.style.borderColor = "";
  submitBtn.disabled = true;
  loadingCard.classList.remove("hidden");
  responseCard.classList.add("hidden");

  const reframe = await getGeminiReframe(intensity, trigger);

  const entry = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    intensity,
    trigger,
    reframe
  };
  logs.unshift(entry);
  saveLogs();
  updateStreak();

  loadingCard.classList.add("hidden");
  submitBtn.disabled = false;
  responseText.textContent = reframe;
  responseCard.classList.remove("hidden");
});

document.getElementById("log-another-btn").addEventListener("click", () => {
  responseCard.classList.add("hidden");
  triggerInput.value = "";
  slider.value = 5;
  display.textContent = "5 / 10";
  display.style.color = "";
});

// ===== GEMINI API CALL (via Node backend) =====
async function getGeminiReframe(intensity, trigger) {
  try {
    const res = await fetch("/api/reframe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intensity, trigger })
    });
    const data = await res.json();
    return data.reframe;
  } catch (err) {
    console.error("Server error:", err);
    return "That urge is real, and so is your strength in pausing right now. Take three slow breaths — the urge will peak and pass, just like a wave.";
  }
}

// ===== RENDER HISTORY =====
function renderHistory() {
  const list  = document.getElementById("history-list");
  const empty = document.getElementById("history-empty");
  list.innerHTML = "";

  if (logs.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  logs.forEach(entry => {
    const card = document.createElement("div");
    card.className = "history-card";

    const date = new Date(entry.timestamp);
    const dateStr = date.toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit"
    });

    let badgeClass = "badge-low";
    let badgeLabel = `${entry.intensity}/10 — low`;
    if (entry.intensity >= 7)      { badgeClass = "badge-high";   badgeLabel = `${entry.intensity}/10 — high`; }
    else if (entry.intensity >= 4) { badgeClass = "badge-medium"; badgeLabel = `${entry.intensity}/10 — medium`; }

    card.innerHTML = `
      <div class="history-card-top">
        <span class="history-date">${dateStr}</span>
        <span class="history-badge ${badgeClass}">${badgeLabel}</span>
      </div>
      <div class="history-trigger">${escapeHtml(entry.trigger)}</div>
      <div class="history-reframe">♠ ${escapeHtml(entry.reframe)}</div>
    `;
    card.addEventListener("click", () => card.classList.toggle("expanded"));
    list.appendChild(card);
  });
}

// ===== RENDER DASHBOARD =====
let intensityChart = null;
let timeChart      = null;

function renderDashboard() {
  const empty = document.getElementById("dashboard-empty");

  if (logs.length === 0) {
    empty.classList.remove("hidden");
    document.querySelector(".charts-grid").style.display = "none";
    return;
  }

  empty.classList.add("hidden");
  document.querySelector(".charts-grid").style.display = "grid";
  renderIntensityChart();
  renderTimeChart();
}

function renderIntensityChart() {
  const ctx    = document.getElementById("intensity-chart").getContext("2d");
  const recent = [...logs].reverse().slice(-10);
  const labels = recent.map(e => {
    const d = new Date(e.timestamp);
    return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,"0")}`;
  });

  if (intensityChart) intensityChart.destroy();
  intensityChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        data: recent.map(e => e.intensity),
        borderColor: "#c8f060",
        backgroundColor: "rgba(200,240,96,0.06)",
        borderWidth: 2,
        pointBackgroundColor: "#c8f060",
        pointRadius: 4,
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#6b7280", font: { family: "DM Mono", size: 9 }, maxRotation: 45 }, grid: { color: "#232830" } },
        y: { min: 0, max: 10, ticks: { color: "#6b7280", font: { family: "DM Mono", size: 10 } }, grid: { color: "#232830" } }
      }
    }
  });
}

function renderTimeChart() {
  const ctx     = document.getElementById("time-chart").getContext("2d");
  const buckets = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 };

  logs.forEach(e => {
    const h = new Date(e.timestamp).getHours();
    if      (h >= 5  && h < 12) buckets.Morning++;
    else if (h >= 12 && h < 17) buckets.Afternoon++;
    else if (h >= 17 && h < 21) buckets.Evening++;
    else                         buckets.Night++;
  });

  if (timeChart) timeChart.destroy();
  timeChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(buckets),
      datasets: [{
        data: Object.values(buckets),
        backgroundColor: ["rgba(96,212,240,0.5)","rgba(200,240,96,0.5)","rgba(200,240,96,0.3)","rgba(96,96,240,0.4)"],
        borderColor: ["#60d4f0","#c8f060","#c8f060","#6060f0"],
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "#6b7280", font: { family: "DM Mono", size: 10 } }, grid: { color: "#232830" } },
        y: { beginAtZero: true, ticks: { color: "#6b7280", font: { family: "DM Mono", size: 10 }, stepSize: 1 }, grid: { color: "#232830" } }
      }
    }
  });
}

// ===== UTILITY =====
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ===== INIT =====
updateStreak();
renderHistory();
renderDashboard();
