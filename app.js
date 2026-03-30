const state = {
  role: "student",
  data: [],
  loaded: false,
  error: "",
  paper: "all",
  category: "all",
  search: "",
  viewMode: "list",
  timerMinutes: 3,
  timerTotalSeconds: 180,
  timerRemainingSeconds: 180,
  timerRunning: false,
  timerHandle: null,
  practiceIndex: 0,
  // Quick Practice state
  quickPracticeActive: false,
  quickPracticeScore: 0,
  quickPracticeTotal: 0,
  quickPracticeStreak: 0,
  quickPracticeBestStreak: 0,
  // Skill Check state
  skillCheckActive: false,
  skillCheckQuestions: [],
  skillCheckIndex: 0,
  skillCheckScore: 0,
  skillCheckTimeRemaining: 0,
  skillCheckTimerHandle: null,
  // Do It Together state
  doItTogetherActive: false,
  doItTogetherSteps: [],
  doItTogetherStepIndex: 0,
  doItTogetherMode: "quick", // "quick" or "skill"
  // Progress tracking
  progress: {
    totalAnswered: 0,
    totalCorrect: 0,
    categories: {},
    badges: [],
  },
};

const questionGrid = document.getElementById("questionGrid");
const paperFilter = document.getElementById("paperFilter");
const categoryFilter = document.getElementById("categoryFilter");
const searchInput = document.getElementById("searchInput");
const questionCount = document.getElementById("questionCount");
const paperCount = document.getElementById("paperCount");
const categoryCount = document.getElementById("categoryCount");
const roleButtons = document.querySelectorAll(".role-btn");
const viewModeSelect = document.getElementById("viewModeSelect");
const timerMinutesInput = document.getElementById("timerMinutesInput");
const studyModeControl = document.getElementById("studyModeControl");
const timerControl = document.getElementById("timerControl");
const practiceBackdrop = document.getElementById("practiceBackdrop");

const solutionMap = window.MATHISFUN_SOLUTIONS || {};
const STORAGE_KEYS = {
  role: "mathquest-role",
  roleLegacy: "mathisfun-role",
  viewMode: "mathquest-view-mode",
  viewModeLegacy: "mathisfun-view-mode",
  timer: "mathquest-timer-minutes",
  timerLegacy: "mathisfun-timer-minutes",
  progress: "mathquest-progress",
  bestStreak: "mathquest-best-streak",
};

const BADGES = [
  { id: "first_correct", name: "First Steps", icon: "🌟", desc: "Get your first answer correct" },
  { id: "streak_5", name: "On Fire", icon: "🔥", desc: "Get a 5-question streak" },
  { id: "streak_10", name: "Unstoppable", icon: "💪", desc: "Get a 10-question streak" },
  { id: "speed demon", name: "Speed Demon", icon: "⚡", desc: "Answer in under 10 seconds" },
  { id: "category_master", name: "Category Master", icon: "👑", desc: "Get 5 correct in one category" },
  { id: "century", name: "Century", icon: "💯", desc: "Answer 100 questions" },
];

const unique = (items) => Array.from(new Set(items)).sort();
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const randomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Progress tracking
const loadProgress = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.progress);
    if (saved) {
      state.progress = { ...state.progress, ...JSON.parse(saved) };
    }
    const savedBest = localStorage.getItem(STORAGE_KEYS.bestStreak);
    if (savedBest) {
      state.quickPracticeBestStreak = Number(savedBest);
    }
  } catch (e) {
    console.error("Failed to load progress:", e);
  }
};

const saveProgress = () => {
  localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(state.progress));
  localStorage.setItem(STORAGE_KEYS.bestStreak, String(state.quickPracticeBestStreak));
};

const recordAnswer = (isCorrect, category) => {
  state.progress.totalAnswered++;
  if (isCorrect) {
    state.progress.totalCorrect++;
  }
  if (!state.progress.categories[category]) {
    state.progress.categories[category] = { total: 0, correct: 0 };
  }
  state.progress.categories[category].total++;
  if (isCorrect) {
    state.progress.categories[category].correct++;
  }
  checkBadges();
  saveProgress();
};

const checkBadges = () => {
  const earned = [];

  if (state.progress.totalCorrect >= 1 && !state.progress.badges.includes("first_correct")) {
    earned.push("first_correct");
  }
  if (state.quickPracticeStreak >= 5 && !state.progress.badges.includes("streak_5")) {
    earned.push("streak_5");
  }
  if (state.quickPracticeStreak >= 10 && !state.progress.badges.includes("streak_10")) {
    earned.push("streak_10");
  }
  if (state.progress.totalAnswered >= 100 && !state.progress.badges.includes("century")) {
    earned.push("century");
  }

  // Check category master
  for (const [cat, data] of Object.entries(state.progress.categories)) {
    if (data.correct >= 5 && !state.progress.badges.includes("category_master")) {
      earned.push("category_master");
      break;
    }
  }

  earned.forEach((badgeId) => {
    if (!state.progress.badges.includes(badgeId)) {
      state.progress.badges.push(badgeId);
      showBadgeToast(badgeId);
    }
  });
};

const showBadgeToast = (badgeId) => {
  const badge = BADGES.find((b) => b.id === badgeId);
  if (!badge) return;

  const toast = document.createElement("div");
  toast.className = "badge-toast";
  toast.innerHTML = `
    <span class="badge-toast-icon">${badge.icon}</span>
    <div class="badge-toast-content">
      <strong>Badge Unlocked!</strong>
      <span>${badge.name}</span>
    </div>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 100);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};

const getRandomQuestion = (categoryFilter) => {
  const all = getAllQuestions();
  let filtered = all;
  if (categoryFilter && categoryFilter !== "all") {
    filtered = all.filter((q) => q.category === categoryFilter);
  }
  if (filtered.length === 0) return null;
  return randomElement(filtered);
};

const normalizeQuestions = (data, sourceLabel) => {
  if (!Array.isArray(data)) {
    throw new Error(`${sourceLabel} must be a JSON array of question objects.`);
  }
  return data;
};

const escapeHtml = (text) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatMath = (text) => {
  let out = escapeHtml(String(text ?? ""));

  out = out.replace(
    /\b([A-Za-z0-9]+)C([A-Za-z0-9+\-]+)\b/g,
    '<span class="math"><span class="math-base">$1</span>C<sub>$2</sub></span>'
  );

  out = out.replace(
    /\b([A-Za-z0-9)\]])\^([A-Za-z0-9+\-]+)\b/g,
    '<span class="math">$1<sup>$2</sup></span>'
  );

  out = out.replace(/sqrt\(([^)]+)\)/g, '<span class="math">√($1)</span>');

  out = out.replace(
    /\b([A-Za-z0-9+\-]+)\s*\/\s*([A-Za-z0-9+\-]+)\b/g,
    '<span class="frac"><span class="frac-top">$1</span><span class="frac-bar"></span><span class="frac-bottom">$2</span></span>'
  );

  return out;
};

const formatTextBlock = (text) => formatMath(text).replaceAll("\n", "<br>");

const getSolutionText = (item) => {
  const mapped = solutionMap[item.id];
  if (mapped) return mapped;
  return `Method:\n${item.hint}\n\nFinal answer: ${item.answer}`;
};

const getAllQuestions = () => state.data;

const matchesSearch = (item, query) => {
  if (!query) return true;
  const needle = query.toLowerCase();
  return (
    item.id.toLowerCase().includes(needle) ||
    item.question.toLowerCase().includes(needle)
  );
};

const getFilteredQuestions = () =>
  getAllQuestions().filter((item) => {
    const paperOk = state.paper === "all" || item.paper === state.paper;
    const categoryOk = state.category === "all" || item.category === state.category;
    const searchOk = matchesSearch(item, state.search);
    return paperOk && categoryOk && searchOk;
  });

const updateStats = (data) => {
  questionCount.textContent = data.length;
  paperCount.textContent = unique(data.map((item) => item.paper)).length;
  categoryCount.textContent = unique(data.map((item) => item.category)).length;
};

const fillSelect = (select, label, items, selected) => {
  select.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = `All ${label}`;
  select.appendChild(allOption);

  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    select.appendChild(option);
  });

  const valid = ["all", ...items];
  select.value = valid.includes(selected) ? selected : "all";
};

const refreshFiltersAndStats = () => {
  const all = getAllQuestions();
  updateStats(all);
  fillSelect(paperFilter, "papers", unique(all.map((item) => item.paper)), state.paper);
  state.paper = paperFilter.value;
  fillSelect(
    categoryFilter,
    "categories",
    unique(all.map((item) => item.category)),
    state.category
  );
  state.category = categoryFilter.value;
};

const setTimerMinutes = (minutes) => {
  const safeMinutes = clamp(Number(minutes) || 1, 1, 120);
  state.timerMinutes = safeMinutes;
  state.timerTotalSeconds = safeMinutes * 60;
  state.timerRemainingSeconds = state.timerTotalSeconds;
  state.timerRunning = false;
  if (state.timerHandle) {
    clearInterval(state.timerHandle);
    state.timerHandle = null;
  }
};

const formatClock = (seconds) => {
  const safe = Math.max(0, seconds);
  const mm = String(Math.floor(safe / 60)).padStart(2, "0");
  const ss = String(safe % 60).padStart(2, "0");
  return `${mm}:${ss}`;
};

const timerChipClass = (seconds, total) => {
  if (total <= 0) return "timer-chip";
  const ratio = seconds / total;
  if (ratio <= 0.2) return "timer-chip is-critical";
  if (ratio <= 0.4) return "timer-chip is-warning";
  return "timer-chip";
};

const stopTimer = () => {
  state.timerRunning = false;
  if (state.timerHandle) {
    clearInterval(state.timerHandle);
    state.timerHandle = null;
  }
};

const resetTimer = () => {
  stopTimer();
  state.timerRemainingSeconds = state.timerTotalSeconds;
};

const updateTimerUi = () => {
  const timerEl = document.getElementById("practiceTimer");
  const startBtn = document.getElementById("timerStartBtn");
  const resetBtn = document.getElementById("timerResetBtn");
  if (!timerEl || !startBtn || !resetBtn) return;

  timerEl.textContent = formatClock(state.timerRemainingSeconds);
  timerEl.className = timerChipClass(state.timerRemainingSeconds, state.timerTotalSeconds);
  startBtn.textContent = state.timerRunning ? "Pause" : "Start";
  resetBtn.disabled = state.timerRunning;
};

const startOrPauseTimer = () => {
  if (state.timerRunning) {
    stopTimer();
    updateTimerUi();
    return;
  }

  state.timerRunning = true;
  state.timerHandle = setInterval(() => {
    if (state.timerRemainingSeconds <= 0) {
      stopTimer();
      updateTimerUi();
      return;
    }
    state.timerRemainingSeconds -= 1;
    updateTimerUi();
  }, 1000);

  updateTimerUi();
};

const attachPracticeHandlers = (filtered) => {
  const prevBtn = document.getElementById("practicePrevBtn");
  const nextBtn = document.getElementById("practiceNextBtn");
  const startBtn = document.getElementById("timerStartBtn");
  const resetBtn = document.getElementById("timerResetBtn");

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      state.practiceIndex = clamp(state.practiceIndex - 1, 0, filtered.length - 1);
      resetTimer();
      render();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      state.practiceIndex = clamp(state.practiceIndex + 1, 0, filtered.length - 1);
      resetTimer();
      render();
    });
  }

  if (startBtn) startBtn.addEventListener("click", startOrPauseTimer);
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      resetTimer();
      updateTimerUi();
    });
  }

  updateTimerUi();
};

const setPracticeBackdrop = (item) => {
  if (!practiceBackdrop) return;
  if (!item) {
    practiceBackdrop.classList.remove("active");
    practiceBackdrop.innerHTML = "";
    return;
  }
  practiceBackdrop.classList.add("active");
  practiceBackdrop.innerHTML = generateBackdropScene(item);
};

const generateBackdropScene = (item) => {
  const question = (item.question || "").toLowerCase();
  const title = escapeHtml(item.question || "Math question");

  if (question.includes("ice cream")) {
    return `
      <svg viewBox="0 0 1600 900" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${title}">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#8ec5ff"/>
            <stop offset="100%" stop-color="#4463aa"/>
          </linearGradient>
          <linearGradient id="cone" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#d4a66d"/>
            <stop offset="100%" stop-color="#9f6f3f"/>
          </linearGradient>
        </defs>
        <rect width="1600" height="900" fill="url(#sky)"/>
        <circle cx="220" cy="160" r="80" fill="#f7dc6f" opacity="0.85"/>
        <ellipse cx="360" cy="250" rx="170" ry="60" fill="#fff" opacity="0.28"/>
        <ellipse cx="650" cy="230" rx="210" ry="70" fill="#fff" opacity="0.22"/>
        <g transform="translate(1030 260)">
          <polygon points="170,190 320,540 20,540" fill="url(#cone)"/>
          <circle cx="170" cy="120" r="130" fill="#f8d6a7"/>
          <circle cx="115" cy="75" r="88" fill="#ff86a7"/>
          <circle cx="225" cy="75" r="88" fill="#8fe3a7"/>
          <circle cx="170" cy="8" r="86" fill="#8cc8ff"/>
          <circle cx="226" cy="-42" r="17" fill="#d7263d"/>
        </g>
      </svg>
    `;
  }

  if (question.includes("dice") || question.includes("d6") || question.includes("d12")) {
    return `
      <svg viewBox="0 0 1600 900" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${title}">
        <rect width="1600" height="900" fill="#1b2137"/>
        <rect x="250" y="250" width="280" height="280" rx="44" fill="#2a3050" stroke="#7aa2f7" stroke-width="12"/>
        <rect x="660" y="320" width="280" height="280" rx="44" fill="#2a3050" stroke="#7dcfff" stroke-width="12"/>
        <rect x="1070" y="250" width="280" height="280" rx="44" fill="#2a3050" stroke="#bb9af7" stroke-width="12"/>
      </svg>
    `;
  }

  if (
    question.includes("circle") ||
    question.includes("radius") ||
    question.includes("diameter") ||
    question.includes("arc")
  ) {
    return `
      <svg viewBox="0 0 1600 900" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${title}">
        <rect width="1600" height="900" fill="#1f2335"/>
        <circle cx="520" cy="450" r="300" fill="none" stroke="#7aa2f7" stroke-width="18"/>
        <line x1="220" y1="450" x2="820" y2="450" stroke="#7dcfff" stroke-width="12"/>
        <path d="M1020,700 L1280,220 L1460,700 Z" fill="none" stroke="#9ece6a" stroke-width="14"/>
      </svg>
    `;
  }

  if (question.includes("triangle") || question.includes("angle")) {
    return `
      <svg viewBox="0 0 1600 900" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${title}">
        <rect width="1600" height="900" fill="#1f2335"/>
        <polygon points="280,700 760,190 980,700" fill="rgba(122,162,247,0.12)" stroke="#7aa2f7" stroke-width="16"/>
        <polygon points="980,700 1270,260 1500,700" fill="rgba(158,206,106,0.1)" stroke="#9ece6a" stroke-width="16"/>
      </svg>
    `;
  }

  if (
    question.includes("mod") ||
    question.includes("gcd") ||
    question.includes("lcm") ||
    question.includes("prime")
  ) {
    return `
      <svg viewBox="0 0 1600 900" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${title}">
        <rect width="1600" height="900" fill="#1f2335"/>
        <rect x="120" y="140" width="1360" height="620" rx="24" fill="#24283b" stroke="#3b4261"/>
        <text x="230" y="330" fill="#7aa2f7" font-size="112" font-family="monospace">gcd(a,b)</text>
        <text x="230" y="500" fill="#7dcfff" font-size="112" font-family="monospace">lcm(x,y)</text>
        <text x="230" y="660" fill="#9ece6a" font-size="96" font-family="monospace">mod n</text>
      </svg>
    `;
  }

  return `
    <svg viewBox="0 0 1600 900" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${title}">
      <rect width="1600" height="900" fill="#1f2335"/>
      <path d="M120 720 C 420 430, 560 840, 860 560 S 1280 360, 1500 640" fill="none" stroke="#7aa2f7" stroke-width="18"/>
      <circle cx="420" cy="330" r="76" fill="#bb9af7" opacity="0.45"/>
      <circle cx="740" cy="240" r="58" fill="#9ece6a" opacity="0.5"/>
      <circle cx="1250" cy="300" r="95" fill="#f7768e" opacity="0.35"/>
    </svg>
  `;
};

const renderPracticeMode = (filtered) => {
  const index = clamp(state.practiceIndex, 0, Math.max(0, filtered.length - 1));
  state.practiceIndex = index;
  const item = filtered[index];
  const done = index === filtered.length - 1;

  questionGrid.innerHTML = `
    <article class="card practice-card">
      <div class="practice-top">
        <div class="meta">
          <span class="chip">${item.id}</span>
          <span class="chip">${item.paper}</span>
          <span class="chip">${item.category}</span>
          <span class="chip">Question ${index + 1} of ${filtered.length}</span>
        </div>
        <div class="practice-timer">
          <span id="practiceTimer" class="${timerChipClass(
            state.timerRemainingSeconds,
            state.timerTotalSeconds
          )}">${formatClock(state.timerRemainingSeconds)}</span>
          <button type="button" class="mini-btn" id="timerStartBtn">Start</button>
          <button type="button" class="mini-btn" id="timerResetBtn">Reset</button>
        </div>
      </div>
      <div class="practice-content">
        <h3>${formatMath(item.question)}</h3>
        <div class="practice-nav">
          <button type="button" class="mini-btn" id="practicePrevBtn" ${
            index === 0 ? "disabled" : ""
          }>Previous</button>
          <button type="button" class="mini-btn" id="practiceNextBtn" ${
            done ? "disabled" : ""
          }>Next</button>
        </div>
      </div>
    </article>
  `;

  setPracticeBackdrop(item);
  attachPracticeHandlers(filtered);
};

const render = () => {
  if (!state.loaded && !state.error) {
    setPracticeBackdrop(null);
    questionGrid.innerHTML = `
      <div class="card">
        <h3>Loading questions...</h3>
        <p>Reading <code>config.json</code> from this folder.</p>
      </div>
    `;
    return;
  }

  if (state.error) {
    setPracticeBackdrop(null);
    questionGrid.innerHTML = `
      <div class="card">
        <h3>Failed to load questions</h3>
        <p>${state.error}</p>
        <p>If you opened this with <code>file://</code>, run a local server in this folder and open that URL.</p>
      </div>
    `;
    return;
  }

  const filtered = getFilteredQuestions();
  questionGrid.innerHTML = "";

  if (!filtered.length) {
    setPracticeBackdrop(null);
    const empty = document.createElement("div");
    empty.className = "card";
    empty.innerHTML = `
      <h3>No matching questions</h3>
      <p>Try another paper, category, or search term.</p>
    `;
    questionGrid.appendChild(empty);
    return;
  }

  const studentPractice = state.role === "student" && state.viewMode === "practice";
  if (studentPractice) {
    renderPracticeMode(filtered);
    return;
  }

  setPracticeBackdrop(null);

  filtered.forEach((item) => {
    const card = document.createElement("article");
    card.className = "card";
    if (state.role === "student") card.classList.add("student-card");

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = `
      <span class="chip">${item.id}</span>
      <span class="chip">${item.paper}</span>
      <span class="chip">${item.category}</span>
    `;

    const question = document.createElement("h3");
    question.innerHTML = formatMath(item.question);

    card.appendChild(meta);
    card.appendChild(question);

    if (state.role === "admin") {
      const hint = document.createElement("p");
      hint.innerHTML = `<strong>Hint:</strong> ${formatMath(item.hint)}`;
      const answer = document.createElement("div");
      answer.className = "answer";
      answer.innerHTML = `<strong>Answer:</strong> ${formatMath(item.answer)}`;
      const details = document.createElement("details");
      details.className = "solution";
      details.innerHTML = `
        <summary>Show full solution</summary>
        <div class="solution__content">${formatTextBlock(getSolutionText(item))}</div>
      `;
      card.appendChild(hint);
      card.appendChild(answer);
      card.appendChild(details);
    }

    questionGrid.appendChild(card);
  });
};

const setRole = (role) => {
  state.role = role;
  roleButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.role === role);
  });

  const isStudent = role === "student";
  const isAdmin = role === "admin";
  studyModeControl.classList.toggle("hidden", !isStudent);
  timerControl.classList.toggle("hidden", !isStudent);

  if (!isStudent) {
    stopTimer();
    setPracticeBackdrop(null);
  }

  localStorage.setItem(STORAGE_KEYS.role, role);
  render();
};

const loadRole = () => {
  const savedRole =
    localStorage.getItem(STORAGE_KEYS.role) ||
    localStorage.getItem(STORAGE_KEYS.roleLegacy);
  if (savedRole === "admin" || savedRole === "student") {
    state.role = savedRole;
  }

  const savedView =
    localStorage.getItem(STORAGE_KEYS.viewMode) ||
    localStorage.getItem(STORAGE_KEYS.viewModeLegacy);
  if (savedView === "list" || savedView === "practice") {
    state.viewMode = savedView;
    viewModeSelect.value = savedView;
  }

  const savedMinutes = Number(
    localStorage.getItem(STORAGE_KEYS.timer) ||
      localStorage.getItem(STORAGE_KEYS.timerLegacy)
  );
  if (Number.isFinite(savedMinutes) && savedMinutes >= 1) {
    timerMinutesInput.value = String(clamp(savedMinutes, 1, 120));
  }

  setTimerMinutes(timerMinutesInput.value);
};

const init = async () => {
  // Check if user is authenticated first
  const token = localStorage.getItem('mathquest-auth-token');
  if (!token) {
    // Auth module will handle showing login screen
    return;
  }

  loadRole();
  loadProgress();
  setRole(state.role);
  render();

  // Setup game mode buttons
  document.querySelectorAll(".game-mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => setGameMode(btn.dataset.mode));
  });

  try {
    if (window.location.protocol === "file:" && Array.isArray(window.MATHISFUN_QUESTIONS)) {
      state.data = normalizeQuestions(window.MATHISFUN_QUESTIONS, "config-data.js");
    } else {
      const configUrl = new URL("./config.json", window.location.href);
      const response = await fetch(configUrl.href, { cache: "no-store" });

      if (!response.ok && response.status !== 0) {
        throw new Error(`HTTP ${response.status} while reading ${configUrl.pathname}`);
      }

      const text = await response.text();
      state.data = normalizeQuestions(JSON.parse(text), "config.json");
    }

    state.loaded = true;
    state.error = "";
    refreshFiltersAndStats();
    render();

    // Start in browse mode
    setGameMode("browse");
  } catch (error) {
    if (Array.isArray(window.MATHISFUN_QUESTIONS)) {
      try {
        state.data = normalizeQuestions(window.MATHISFUN_QUESTIONS, "config-data.js");
        state.loaded = true;
        state.error = "";
        refreshFiltersAndStats();
        render();
        setGameMode("browse");
        return;
      } catch (fallbackError) {
        state.error = fallbackError.message;
      }
    } else {
      state.error = error.message;
    }

    state.loaded = false;
    refreshFiltersAndStats();
    render();
  }
};

roleButtons.forEach((btn) => {
  btn.addEventListener("click", () => setRole(btn.dataset.role));
});

viewModeSelect.addEventListener("change", (event) => {
  state.viewMode = event.target.value;
  state.practiceIndex = 0;
  resetTimer();
  localStorage.setItem(STORAGE_KEYS.viewMode, state.viewMode);
  render();
});

timerMinutesInput.addEventListener("change", (event) => {
  setTimerMinutes(event.target.value);
  localStorage.setItem(STORAGE_KEYS.timer, String(state.timerMinutes));
  render();
});

paperFilter.addEventListener("change", (event) => {
  state.paper = event.target.value;
  state.practiceIndex = 0;
  resetTimer();
  render();
});

categoryFilter.addEventListener("change", (event) => {
  state.category = event.target.value;
  state.practiceIndex = 0;
  resetTimer();
  render();
});

searchInput.addEventListener("input", (event) => {
  state.search = event.target.value.trim();
  state.practiceIndex = 0;
  resetTimer();
  render();
});

// Remove import panel references since it's been removed
const aiImportPanel = document.getElementById("aiImportPanel");
if (aiImportPanel) aiImportPanel.remove();

// Export init function for auth.js to call
window.init = init;

// ============= GAME MODES =============

// Mode switching
const gameModes = {
  current: "browse",
  previous: "browse",
};

const setGameMode = (mode) => {
  gameModes.previous = gameModes.current;
  gameModes.current = mode;

  // Hide all panels
  document.getElementById("quickPracticePanel")?.classList.add("hidden");
  document.getElementById("skillCheckPanel")?.classList.add("hidden");
  document.getElementById("skillCheckActivePanel")?.classList.add("hidden");
  document.getElementById("skillCheckResultsPanel")?.classList.add("hidden");
  document.getElementById("progressPanel")?.classList.add("hidden");
  document.getElementById("mainControls")?.classList.add("hidden");
  document.getElementById("questionGrid")?.classList.add("hidden");
  document.getElementById("gameModesPanel")?.classList.add("hidden");

  // Update button states
  document.querySelectorAll(".game-mode-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });

  // Show selected panel
  switch (mode) {
    case "quick":
      document.getElementById("gameModesPanel")?.classList.remove("hidden");
      document.getElementById("quickPracticePanel")?.classList.remove("hidden");
      startQuickPractice();
      break;
    case "skill":
      document.getElementById("gameModesPanel")?.classList.remove("hidden");
      document.getElementById("skillCheckPanel")?.classList.remove("hidden");
      renderSkillCheckCategories();
      break;
    case "browse":
      document.getElementById("gameModesPanel")?.classList.remove("hidden");
      document.getElementById("mainControls")?.classList.remove("hidden");
      document.getElementById("questionGrid")?.classList.remove("hidden");
      render();
      break;
    case "progress":
      document.getElementById("gameModesPanel")?.classList.remove("hidden");
      document.getElementById("progressPanel")?.classList.remove("hidden");
      renderProgress();
      break;
  }
};

// ============= QUICK PRACTICE =============

let quickPracticeQuestions = [];
let quickPracticeQuestion = null;
let quickPracticeAnswerTime = 0;
let quickPracticeQuestionIndex = 0;

const startQuickPractice = () => {
  state.quickPracticeActive = true;
  state.quickPracticeScore = 0;
  state.quickPracticeTotal = 0;
  state.quickPracticeStreak = 0;
  quickPracticeQuestions = [];
  quickPracticeQuestion = null;
  quickPracticeQuestionIndex = 0;

  // Pre-load 20 random questions for the session
  const allQuestions = getAllQuestions();
  for (let i = 0; i < Math.min(20, allQuestions.length); i++) {
    const q = getRandomQuestion(state.category !== "all" ? state.category : null);
    if (q && !quickPracticeQuestions.find((x) => x.id === q.id)) {
      quickPracticeQuestions.push(q);
    }
  }

  // Setup button handlers
  document.getElementById("qpExitBtn")?.addEventListener("click", () => {
    setGameMode("browse");
  });

  document.getElementById("qpPrevBtn")?.addEventListener("click", () => {
    if (quickPracticeQuestionIndex > 0) {
      quickPracticeQuestionIndex--;
      quickPracticeQuestion = quickPracticeQuestions[quickPracticeQuestionIndex];
      showQuickPracticeQuestion();
    }
  });

  document.getElementById("qpNextBtn")?.addEventListener("click", () => {
    if (quickPracticeQuestionIndex < quickPracticeQuestions.length - 1) {
      quickPracticeQuestionIndex++;
      quickPracticeQuestion = quickPracticeQuestions[quickPracticeQuestionIndex];
      showQuickPracticeQuestion();
    } else {
      // Load more questions
      for (let i = 0; i < 10; i++) {
        const q = getRandomQuestion(state.category !== "all" ? state.category : null);
        if (q && !quickPracticeQuestions.find((x) => x.id === q.id)) {
          quickPracticeQuestions.push(q);
        }
      }
      quickPracticeQuestionIndex++;
      quickPracticeQuestion = quickPracticeQuestions[quickPracticeQuestionIndex];
      showQuickPracticeQuestion();
    }
  });

  document.getElementById("qpDoItTogetherBtn")?.addEventListener("click", () => {
    if (quickPracticeQuestion) {
      startDoItTogether("quick", quickPracticeQuestion);
    }
  });

  document.getElementById("qpSubmitBtn")?.addEventListener("click", submitQuickPracticeAnswer);
  document.getElementById("qpAnswerInput")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") submitQuickPracticeAnswer();
  });

  loadQuickPracticeQuestion();
};

const showQuickPracticeQuestion = () => {
  if (!quickPracticeQuestion) return;

  document.getElementById("qpQuestionText").innerHTML = formatMath(quickPracticeQuestion.question);
  document.getElementById("qpCategoryDisplay").textContent = quickPracticeQuestion.category;
  document.getElementById("qpStreakDisplay").textContent = `Streak: ${state.quickPracticeStreak}`;
  document.getElementById("qpAnswerInput").value = "";
  document.getElementById("qpFeedback").classList.add("hidden");
  document.getElementById("qpSubmitBtn").disabled = false;
  document.getElementById("qpAnswerInput").focus();
  document.getElementById("qpPrevBtn").disabled = quickPracticeQuestionIndex === 0;
  quickPracticeAnswerTime = Date.now();
};

const loadQuickPracticeQuestion = () => {
  if (quickPracticeQuestions.length === 0) {
    document.getElementById("qpQuestionText").textContent = "No questions available!";
    return;
  }

  quickPracticeQuestionIndex = 0;
  quickPracticeQuestion = quickPracticeQuestions[0];
  showQuickPracticeQuestion();
};

const submitQuickPracticeAnswer = () => {
  if (!quickPracticeQuestion) return;

  const input = document.getElementById("qpAnswerInput").value.trim().toLowerCase();
  if (!input) return;

  const correct = normalizeAnswer(input) === normalizeAnswer(quickPracticeQuestion.answer);
  const answerTime = (Date.now() - quickPracticeAnswerTime) / 1000;

  state.quickPracticeTotal++;
  if (correct) {
    state.quickPracticeScore++;
    state.quickPracticeStreak++;
    if (state.quickPracticeStreak > state.quickPracticeBestStreak) {
      state.quickPracticeBestStreak = state.quickPracticeStreak;
    }
  } else {
    state.quickPracticeStreak = 0;
  }

  recordAnswer(correct, quickPracticeQuestion.category);
  updateQuickPracticeScore();

  const feedback = document.getElementById("qpFeedback");
  feedback.classList.remove("hidden");
  if (correct) {
    feedback.className = "result-feedback correct";
    feedback.innerHTML = `✓ Correct! ${answerTime < 10 ? "⚡ Speed bonus!" : ""}`;
  } else {
    feedback.className = "result-feedback incorrect";
    feedback.innerHTML = `✗ Incorrect. The answer was: <strong>${quickPracticeQuestion.answer}</strong>`;
  }

  document.getElementById("qpSubmitBtn").disabled = true;

  // Auto-advance to next question after feedback
  setTimeout(() => {
    document.getElementById("qpSubmitBtn").disabled = false;
    if (quickPracticeQuestionIndex < quickPracticeQuestions.length - 1) {
      quickPracticeQuestionIndex++;
      quickPracticeQuestion = quickPracticeQuestions[quickPracticeQuestionIndex];
      showQuickPracticeQuestion();
    } else {
      // Load more questions
      for (let i = 0; i < 10; i++) {
        const q = getRandomQuestion(state.category !== "all" ? state.category : null);
        if (q && !quickPracticeQuestions.find((x) => x.id === q.id)) {
          quickPracticeQuestions.push(q);
        }
      }
      if (quickPracticeQuestionIndex < quickPracticeQuestions.length - 1) {
        quickPracticeQuestionIndex++;
        quickPracticeQuestion = quickPracticeQuestions[quickPracticeQuestionIndex];
      }
      showQuickPracticeQuestion();
    }
  }, correct ? 1200 : 2000);
};

const normalizeAnswer = (answer) => {
  return String(answer)
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9\/\-]/g, "");
};

const updateQuickPracticeScore = () => {
  document.getElementById("qpScoreCorrect").textContent = state.quickPracticeScore;
  document.getElementById("qpScoreTotal").textContent = state.quickPracticeTotal;
  const accuracy = state.quickPracticeTotal > 0
    ? Math.round((state.quickPracticeScore / state.quickPracticeTotal) * 100)
    : 0;
  document.getElementById("qpAccuracy").textContent = `${accuracy}%`;
  document.getElementById("qpStreakDisplay").textContent = `Streak: ${state.quickPracticeStreak}`;
};

// ============= SKILL CHECK =============

let skillCheckCategory = null;
let skillCheckTimeLimit = 120;
let skillCheckAnswers = {}; // Track which questions have been answered

const renderSkillCheckCategories = () => {
  const grid = document.getElementById("skillCategoryGrid");
  if (!grid) return;

  const categories = unique(getAllQuestions().map((q) => q.category));
  const categoryCounts = {};
  getAllQuestions().forEach((q) => {
    categoryCounts[q.category] = (categoryCounts[q.category] || 0) + 1;
  });

  grid.innerHTML = categories.map((cat) => `
    <button class="skill-category-btn" data-category="${escapeHtml(cat)}">
      <div class="cat-name">${escapeHtml(cat)}</div>
      <div class="cat-count">${categoryCounts[cat]} questions</div>
    </button>
  `).join("");

  grid.querySelectorAll(".skill-category-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      startSkillCheck(btn.dataset.category);
    });
  });

  document.getElementById("scExitBtn")?.addEventListener("click", () => {
    stopSkillCheckTimer();
    setGameMode("browse");
  });
};

const startSkillCheck = (category) => {
  skillCheckCategory = category;
  const categoryQuestions = getAllQuestions().filter((q) => q.category === category);

  // Pick 5 random questions
  skillCheckQuestions = [];
  const available = [...categoryQuestions];
  for (let i = 0; i < Math.min(5, available.length); i++) {
    const idx = Math.floor(Math.random() * available.length);
    skillCheckQuestions.push(available[idx]);
    available.splice(idx, 1);
  }

  state.skillCheckIndex = 0;
  state.skillCheckScore = 0;
  skillCheckTimeLimit = 120;
  skillCheckAnswers = {};

  document.getElementById("skillCheckPanel").classList.add("hidden");
  document.getElementById("skillCheckActivePanel").classList.remove("hidden");

  document.getElementById("scCategoryDisplay").textContent = category;
  document.getElementById("scExitBtn")?.addEventListener("click", () => {
    stopSkillCheckTimer();
    setGameMode("browse");
  });

  document.getElementById("scPrevBtn")?.addEventListener("click", () => {
    if (state.skillCheckIndex > 0) {
      state.skillCheckIndex--;
      showSkillCheckQuestion();
    }
  });

  document.getElementById("scNextBtn")?.addEventListener("click", () => {
    if (state.skillCheckIndex < skillCheckQuestions.length - 1) {
      state.skillCheckIndex++;
      showSkillCheckQuestion();
    }
  });

  document.getElementById("scDoItTogetherBtn")?.addEventListener("click", () => {
    const currentQuestion = skillCheckQuestions[state.skillCheckIndex];
    if (currentQuestion) {
      startDoItTogether("skill", currentQuestion);
    }
  });

  document.getElementById("scSubmitBtn")?.addEventListener("click", submitSkillCheckAnswer);
  document.getElementById("scAnswerInput")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") submitSkillCheckAnswer();
  });
  document.getElementById("scRetryBtn")?.addEventListener("click", () => {
    startSkillCheck(skillCheckCategory);
  });
  document.getElementById("scBackBtn")?.addEventListener("click", () => {
    document.getElementById("skillCheckResultsPanel").classList.add("hidden");
    document.getElementById("skillCheckPanel").classList.remove("hidden");
  });

  startSkillCheckTimer();
  loadSkillCheckQuestion();
};

const startSkillCheckTimer = () => {
  stopSkillCheckTimer();
  state.skillCheckTimerHandle = setInterval(() => {
    skillCheckTimeLimit--;
    const mm = String(Math.floor(skillCheckTimeLimit / 60)).padStart(2, "0");
    const ss = String(skillCheckTimeLimit % 60).padStart(2, "0");
    document.getElementById("scTimerDisplay").textContent = `${mm}:${ss}`;

    if (skillCheckTimeLimit <= 0) {
      stopSkillCheckTimer();
      endSkillCheck();
    }
  }, 1000);
};

const stopSkillCheckTimer = () => {
  if (state.skillCheckTimerHandle) {
    clearInterval(state.skillCheckTimerHandle);
    state.skillCheckTimerHandle = null;
  }
};

const showSkillCheckQuestion = () => {
  const q = skillCheckQuestions[state.skillCheckIndex];
  if (!q) {
    endSkillCheck();
    return;
  }

  document.getElementById("scQuestionText").innerHTML = formatMath(q.question);
  document.getElementById("scProgressDisplay").textContent = `Question ${state.skillCheckIndex + 1} of ${skillCheckQuestions.length}`;
  document.getElementById("scAnswerInput").value = "";
  document.getElementById("scFeedback").classList.add("hidden");
  document.getElementById("scSubmitBtn").disabled = skillCheckAnswers[state.skillCheckIndex];
  document.getElementById("scAnswerInput").focus();
  document.getElementById("scPrevBtn").disabled = state.skillCheckIndex === 0;
  document.getElementById("scNextBtn").disabled = state.skillCheckIndex === skillCheckQuestions.length - 1;

  // If already answered, show the feedback
  if (skillCheckAnswers[state.skillCheckIndex] !== undefined) {
    const feedback = document.getElementById("scFeedback");
    feedback.classList.remove("hidden");
    if (skillCheckAnswers[state.skillCheckIndex]) {
      feedback.className = "result-feedback correct";
      feedback.textContent = "✓ Correct!";
    } else {
      feedback.className = "result-feedback incorrect";
      feedback.innerHTML = `✗ Answer: <strong>${q.answer}</strong>`;
    }
  }
};

const loadSkillCheckQuestion = () => {
  showSkillCheckQuestion();
};

const submitSkillCheckAnswer = () => {
  const q = skillCheckQuestions[state.skillCheckIndex];
  if (!q) return;

  const input = document.getElementById("scAnswerInput").value.trim().toLowerCase();
  if (!input) return;

  const correct = normalizeAnswer(input) === normalizeAnswer(q.answer);

  if (correct) {
    state.skillCheckScore++;
  }

  skillCheckAnswers[state.skillCheckIndex] = correct;
  recordAnswer(correct, q.category);

  const feedback = document.getElementById("scFeedback");
  feedback.classList.remove("hidden");
  if (correct) {
    feedback.className = "result-feedback correct";
    feedback.textContent = "✓ Correct!";
  } else {
    feedback.className = "result-feedback incorrect";
    feedback.innerHTML = `✗ Answer: <strong>${q.answer}</strong>`;
  }

  document.getElementById("scSubmitBtn").disabled = true;
};

const endSkillCheck = () => {
  stopSkillCheckTimer();
  document.getElementById("skillCheckActivePanel").classList.add("hidden");
  document.getElementById("skillCheckResultsPanel").classList.remove("hidden");

  document.getElementById("scResultsCategory").textContent = skillCheckCategory;
  document.getElementById("scFinalScore").textContent = `${state.skillCheckScore}/${skillCheckQuestions.length}`;
  const accuracy = Math.round((state.skillCheckScore / skillCheckQuestions.length) * 100);
  document.getElementById("scFinalAccuracy").textContent = `${accuracy}%`;
};

// ============= DO IT TOGETHER =============

const parseSolutionSteps = (solutionText) => {
  if (!solutionText) return [];

  const steps = [];
  const lines = solutionText.split("\n");

  let currentStep = { title: "", text: "" };
  let stepNumber = 1;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check for step markers
    if (trimmed.match(/^(Step \d+:|\d+\.\s|\- |\* )/) || trimmed.match(/^(Use |Convert |Set |Solve |Find |Calculate |Compute |Check |Let |Work |Put |Model)/i)) {
      if (currentStep.text) {
        steps.push({ ...currentStep, title: `Step ${stepNumber}` });
        stepNumber++;
      }
      currentStep = { title: `Step ${stepNumber}`, text: trimmed };
    } else {
      currentStep.text += "\n" + trimmed;
    }
  }

  if (currentStep.text) {
    steps.push({ ...currentStep, title: `Step ${stepNumber}` });
  }

  // If we only have one step, split by sentences
  if (steps.length === 1 && steps[0].text.includes(".")) {
    const sentences = steps[0].text.split(".").filter(s => s.trim());
    if (sentences.length > 1) {
      const newSteps = [];
      sentences.forEach((sentence, idx) => {
        const trimmedSentence = sentence.trim() + ".";
        newSteps.push({
          title: `Step ${idx + 1}`,
          text: trimmedSentence
        });
      });
      return newSteps;
    }
  }

  return steps;
};

const startDoItTogether = (mode, question) => {
  state.doItTogetherActive = true;
  state.doItTogetherMode = mode;
  state.doItTogetherStepIndex = 0;

  const solutionText = solutionMap[question.id] || `Method:\n${question.hint}\n\nFinal answer: ${question.answer}`;
  state.doItTogetherSteps = parseSolutionSteps(solutionText);

  // Ensure we have at least 3 steps
  if (state.doItTogetherSteps.length < 3) {
    state.doItTogetherSteps = [
      { title: "Step 1: Understand", text: `Read the problem carefully. ${question.question}` },
      { title: "Step 2: Plan", text: question.hint || "Think about what approach to use." },
      { title: "Step 3: Solve", text: `Work through the solution. ${solutionText}` },
      { title: "Step 4: Check", text: `Verify your answer. The answer is: ${question.answer}` },
    ];
  }

  // Add final answer step if not present
  const lastStep = state.doItTogetherSteps[state.doItTogetherSteps.length - 1];
  if (!lastStep.text.includes(question.answer)) {
    state.doItTogetherSteps.push({
      title: `Step ${state.doItTogetherSteps.length + 1}: Answer`,
      text: `Final answer: ${question.answer}`
    });
  }

  // Hide main panels
  document.getElementById("quickPracticePanel")?.classList.add("hidden");
  document.getElementById("skillCheckActivePanel")?.classList.add("hidden");
  document.getElementById("doItTogetherPanel")?.classList.remove("hidden");

  // Setup UI
  document.getElementById("ditQuestionText").innerHTML = formatMath(question.question);
  document.getElementById("ditCategoryDisplay").textContent = question.category;

  // Setup button handlers
  document.getElementById("ditExitBtn")?.addEventListener("click", () => {
    exitDoItTogether();
  });

  document.getElementById("ditPrevStepBtn")?.addEventListener("click", () => {
    if (state.doItTogetherStepIndex > 0) {
      state.doItTogetherStepIndex--;
      showDoItTogetherStep();
    }
  });

  document.getElementById("ditNextStepBtn")?.addEventListener("click", () => {
    if (state.doItTogetherStepIndex < state.doItTogetherSteps.length - 1) {
      state.doItTogetherStepIndex++;
      showDoItTogetherStep();
    }
  });

  document.getElementById("ditSubmitBtn")?.addEventListener("click", () => {
    submitDoItTogetherAnswer(question);
  });

  document.getElementById("ditAnswerInput")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") submitDoItTogetherAnswer(question);
  });

  showDoItTogetherStep();
};

const showDoItTogetherStep = () => {
  const step = state.doItTogetherSteps[state.doItTogetherStepIndex];
  if (!step) return;

  document.getElementById("ditStepTitle").textContent = step.title;
  document.getElementById("ditStepText").innerHTML = formatMath(step.text.replace(/\n/g, "<br>"));
  document.getElementById("ditStepIndicator").textContent = `Step ${state.doItTogetherStepIndex + 1} of ${state.doItTogetherSteps.length}`;

  // Update progress dots
  const progressContainer = document.getElementById("ditStepProgress");
  if (progressContainer) {
    progressContainer.innerHTML = state.doItTogetherSteps.map((_, idx) =>
      `<div class="solution-step-progress__dot ${idx === state.doItTogetherStepIndex ? "active" : ""} ${idx < state.doItTogetherStepIndex ? "completed" : ""}"></div>`
    ).join("");
  }

  // Update button states
  document.getElementById("ditPrevStepBtn").disabled = state.doItTogetherStepIndex === 0;
  document.getElementById("ditNextStepBtn").disabled = state.doItTogetherStepIndex === state.doItTogetherSteps.length - 1;

  // Show answer input on last step
  const isLastStep = state.doItTogetherStepIndex === state.doItTogetherSteps.length - 1;
  const answerPanel = document.getElementById("ditAnswerPanel");
  if (answerPanel) {
    answerPanel.classList.toggle("hidden", !isLastStep);
  }

  if (isLastStep) {
    document.getElementById("ditAnswerInput").value = "";
    document.getElementById("ditFeedback").classList.add("hidden");
    document.getElementById("ditAnswerInput").focus();
  }
};

const submitDoItTogetherAnswer = (question) => {
  const input = document.getElementById("ditAnswerInput").value.trim().toLowerCase();
  if (!input) return;

  const correct = normalizeAnswer(input) === normalizeAnswer(question.answer);

  const feedback = document.getElementById("ditFeedback");
  feedback.classList.remove("hidden");
  if (correct) {
    feedback.className = "result-feedback correct";
    feedback.innerHTML = `✓ Correct! Great job working through it together!`;
    recordAnswer(true, question.category);

    // Update score if in quick practice mode
    if (state.doItTogetherMode === "quick") {
      state.quickPracticeTotal++;
      state.quickPracticeScore++;
      state.quickPracticeStreak++;
      if (state.quickPracticeStreak > state.quickPracticeBestStreak) {
        state.quickPracticeBestStreak = state.quickPracticeStreak;
      }
      updateQuickPracticeScore();
    }
  } else {
    feedback.className = "result-feedback incorrect";
    feedback.innerHTML = `✗ Not quite. The answer was: <strong>${question.answer}</strong>`;
    recordAnswer(false, question.category);

    if (state.doItTogetherMode === "quick") {
      state.quickPracticeTotal++;
      state.quickPracticeStreak = 0;
      updateQuickPracticeScore();
    }
  }
};

const exitDoItTogether = () => {
  state.doItTogetherActive = false;
  document.getElementById("doItTogetherPanel")?.classList.add("hidden");

  if (state.doItTogetherMode === "quick") {
    document.getElementById("quickPracticePanel")?.classList.remove("hidden");
  } else {
    document.getElementById("skillCheckActivePanel")?.classList.remove("hidden");
  }
};

// ============= PROGRESS =============

const renderProgress = () => {
  document.getElementById("progTotalAnswered").textContent = state.progress.totalAnswered;
  document.getElementById("progTotalCorrect").textContent = state.progress.totalCorrect;
  const accuracy = state.progress.totalAnswered > 0
    ? Math.round((state.progress.totalCorrect / state.progress.totalAnswered) * 100)
    : 0;
  document.getElementById("progAccuracy").textContent = `${accuracy}%`;
  document.getElementById("progBestStreak").textContent = state.quickPracticeBestStreak;

  const badgesGrid = document.getElementById("badgesGrid");
  if (!badgesGrid) return;

  badgesGrid.innerHTML = BADGES.map((badge) => {
    const earned = state.progress.badges.includes(badge.id);
    return `
      <div class="badge-item ${earned ? "earned" : ""}">
        <div class="badge-item__icon">${badge.icon}</div>
        <div class="badge-item__name">${badge.name}</div>
        <div class="badge-item__desc">${badge.desc}</div>
      </div>
    `;
  }).join("");

  document.getElementById("progressBackBtn")?.addEventListener("click", () => {
    setGameMode("browse");
  });
};
