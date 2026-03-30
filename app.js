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
  doItTogetherRevealed: {}, // Track revealed steps per question
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

  // Handle square roots - √(expression) or √number
  out = out.replace(/√\(([^)]+)\)/g, '√(<span class="math-root">$1</span>)');
  out = out.replace(/√(\d+)/g, '√<span class="math-root">$1</span>');

  // Handle exponents - only when preceded by a word character or closing paren
  out = out.replace(/([A-Za-z0-9)])\^([0-9]+)/g, '$1<sup>$2</sup>');

  // Handle multiplication symbol (ensure it displays properly)
  out = out.replace(/×/g, '×');

  // Handle fractions - be more conservative, only match simple number/number patterns
  out = out.replace(/(\d+)\s*\/\s*(\d+)/g, '<span class="frac"><span class="frac-top">$1</span><span class="frac-bar"></span><span class="frac-bottom">$2</span></span>');

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
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      if (mode === "arcade") {
        document.getElementById("gameModesPanel")?.classList.add("hidden");
        document.getElementById("arcadeGamesPanel")?.classList.remove("hidden");
      } else {
        setGameMode(mode);
      }
    });
  });

  // Initialize arcade games
  initArcadeGames();

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
  document.getElementById("arcadeGamesPanel")?.classList.add("hidden");
  document.getElementById("speedMathPanel")?.classList.add("hidden");
  document.getElementById("memoryMatchPanel")?.classList.add("hidden");
  document.getElementById("numberBurstPanel")?.classList.add("hidden");
  document.getElementById("equationRainPanel")?.classList.add("hidden");

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

  // Update Do It Together button to show if there's saved progress
  const ditBtn = document.getElementById("qpDoItTogetherBtn");
  if (ditBtn) {
    const savedProgress = loadDoItTogetherProgress(quickPracticeQuestion.id);
    if (savedProgress && savedProgress.stepIndex > 0) {
      ditBtn.textContent = `Continue Guidance (Step ${savedProgress.stepIndex + 1})`;
      ditBtn.style.borderColor = "var(--success)";
    } else {
      ditBtn.textContent = "Do It Together";
      ditBtn.style.borderColor = "";
    }
  }
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

  // Update Do It Together button to show if there's saved progress
  const ditBtn = document.getElementById("scDoItTogetherBtn");
  if (ditBtn) {
    const savedProgress = loadDoItTogetherProgress(q.id);
    if (savedProgress && savedProgress.stepIndex > 0) {
      ditBtn.textContent = `Continue (Step ${savedProgress.stepIndex + 1})`;
      ditBtn.style.borderColor = "var(--success)";
    } else {
      ditBtn.textContent = "Do It Together";
      ditBtn.style.borderColor = "";
    }
  }

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

  let currentStep = { title: "", text: "", blanks: [] };
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
      currentStep = { title: `Step ${stepNumber}`, text: trimmed, blanks: [] };
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
          text: trimmedSentence,
          blanks: [] // Don't extract blanks from auto-split sentences
        });
      });
      return newSteps;
    }
  }

  // Don't extract blanks - let students focus on reading the solution
  return steps.map(step => ({
    ...step,
    blanks: [] // Disable blanks for now to preserve formatting
  }));
};

const extractBlanks = (text) => {
  const blanks = [];
  // Find numbers and key values that can be blanks
  const numberRegex = /\b(\d+(?:\/\d+)?|\d+\/\d+)\b/g;
  let match;
  while ((match = numberRegex.exec(text)) !== null) {
    if (!text.substring(0, match.index).includes("Answer:") &&
        !text.substring(0, match.index).includes("Step")) {
      blanks.push({
        value: match[1],
        position: match.index
      });
    }
  }
  return blanks.slice(0, 3); // Limit to 3 blanks per step
};

let doItTogetherCurrentQuestion = null;

const startDoItTogether = (mode, question) => {
  state.doItTogetherActive = true;
  state.doItTogetherMode = mode;
  state.doItTogetherStepIndex = 0;
  doItTogetherCurrentQuestion = question;

  // Load saved progress for this question
  const savedProgress = loadDoItTogetherProgress(question.id);
  if (savedProgress) {
    state.doItTogetherStepIndex = savedProgress.stepIndex || 0;
    state.doItTogetherRevealed = savedProgress.revealed || {};
  } else {
    state.doItTogetherRevealed = {};
  }

  const solutionText = solutionMap[question.id] || `Method:\n${question.hint}\n\nFinal answer: ${question.answer}`;
  state.doItTogetherSteps = parseSolutionSteps(solutionText);

  // Ensure we have at least 3 helpful steps
  if (state.doItTogetherSteps.length < 3) {
    // Check if hint is just a cross-reference (e.g., "Same as Colt Q3.")
    const isCrossReference = question.hint && /^same as/i.test(question.hint.trim());

    if (isCrossReference) {
      // For cross-references, create a helpful explanation
      state.doItTogetherSteps = [
        {
          title: "Step 1: Understand the Problem",
          text: `Read the question carefully. ${formatMath(question.question)}\n\nThis problem asks you to find a value or solve an equation. Look at what information is given and what you need to find.`,
          blanks: []
        },
        {
          title: "Step 2: Recall Related Concepts",
          text: `This problem references another question (Colt Q3). The same solution method applies here.\n\nThink about: What formulas, rules, or techniques were used in the similar problem?`,
          blanks: []
        },
        {
          title: "Step 3: Work Through the Solution",
          text: `Apply the method step by step:\n${formatMath(solutionText)}\n\nShow your work clearly for each calculation.`,
          blanks: []
        },
        {
          title: "Step 4: Check Your Answer",
          text: `Verify your solution makes sense.\n\nFinal answer: ${formatMath(question.answer)}\n\nTry plugging your answer back into the original problem to confirm it works!`,
          blanks: []
        },
      ];
    } else {
      // Create structured steps from the hint and solution
      const planText = question.hint || "Think about what approach to use.";
      state.doItTogetherSteps = [
        {
          title: "Step 1: Understand the Problem",
          text: `Read carefully: ${formatMath(question.question)}\n\nIdentify what you know and what you need to find.`,
          blanks: []
        },
        {
          title: "Step 2: Plan Your Approach",
          text: planText,
          blanks: []
        },
        {
          title: "Step 3: Solve Step by Step",
          text: `Work through the calculation:\n${formatMath(solutionText)}`,
          blanks: []
        },
        {
          title: "Step 4: Check Your Work",
          text: `Verify: The answer is ${formatMath(question.answer)}\n\nDoes this make sense? Try checking your work!`,
          blanks: []
        },
      ];
    }
  }

  // Add final answer step if not present
  const lastStep = state.doItTogetherSteps[state.doItTogetherSteps.length - 1];
  if (!lastStep.text.includes(question.answer)) {
    state.doItTogetherSteps.push({
      title: `Step ${state.doItTogetherSteps.length + 1}: Final Answer`,
      text: `The answer is: ${formatMath(question.answer)}`,
      blanks: []
    });
  }

  // Hide main panels
  document.getElementById("quickPracticePanel")?.classList.add("hidden");
  document.getElementById("skillCheckActivePanel")?.classList.add("hidden");
  document.getElementById("doItTogetherPanel")?.classList.remove("hidden");

  // Setup UI
  document.getElementById("ditQuestionText").innerHTML = formatMath(question.question);
  document.getElementById("ditCategoryDisplay").textContent = question.category;

  // Update toggle button text
  updateToggleModeButton();

  // Setup button handlers
  document.getElementById("ditExitBtn")?.removeEventListener("click", exitDoItTogether);
  document.getElementById("ditPrevStepBtn")?.removeEventListener("click", handleDitPrevStep);
  document.getElementById("ditNextStepBtn")?.removeEventListener("click", handleDitNextStep);
  document.getElementById("ditPrevStepBtn2")?.removeEventListener("click", handleDitPrevStep);
  document.getElementById("ditNextStepBtn2")?.removeEventListener("click", handleDitNextStep);
  document.getElementById("ditToggleModeBtn")?.removeEventListener("click", toggleDoItTogetherMode);
  document.getElementById("ditRevealBtn")?.removeEventListener("click", revealCurrentStep);
  document.getElementById("ditSubmitBtn")?.removeEventListener("click", handleDitSubmit);
  document.getElementById("ditAnswerInput")?.removeEventListener("keypress", handleDitKeyPress);

  document.getElementById("ditExitBtn")?.addEventListener("click", exitDoItTogether);
  document.getElementById("ditPrevStepBtn")?.addEventListener("click", handleDitPrevStep);
  document.getElementById("ditNextStepBtn")?.addEventListener("click", handleDitNextStep);
  document.getElementById("ditPrevStepBtn2")?.addEventListener("click", handleDitPrevStep);
  document.getElementById("ditNextStepBtn2")?.addEventListener("click", handleDitNextStep);
  document.getElementById("ditToggleModeBtn")?.addEventListener("click", toggleDoItTogetherMode);
  document.getElementById("ditRevealBtn")?.addEventListener("click", revealCurrentStep);
  document.getElementById("ditSubmitBtn")?.addEventListener("click", handleDitSubmit);
  document.getElementById("ditAnswerInput")?.addEventListener("keypress", handleDitKeyPress);

  showDoItTogetherStep();
};

const updateToggleModeButton = () => {
  const btn = document.getElementById("ditToggleModeBtn");
  if (btn) {
    btn.textContent = state.doItTogetherMode === "quick" ? "Try Myself" : "Show Me How";
  }
};

const handleDitPrevStep = () => {
  if (state.doItTogetherStepIndex > 0) {
    state.doItTogetherStepIndex--;
    showDoItTogetherStep();
    saveDoItTogetherProgress();
  }
};

const handleDitNextStep = () => {
  if (state.doItTogetherStepIndex < state.doItTogetherSteps.length - 1) {
    state.doItTogetherStepIndex++;
    showDoItTogetherStep();
    saveDoItTogetherProgress();
  }
};

const handleDitSubmit = () => {
  if (doItTogetherCurrentQuestion) {
    submitDoItTogetherAnswer(doItTogetherCurrentQuestion);
  }
};

const handleDitKeyPress = (e) => {
  if (e.key === "Enter" && doItTogetherCurrentQuestion) {
    submitDoItTogetherAnswer(doItTogetherCurrentQuestion);
  }
};

const toggleDoItTogetherMode = () => {
  if (!doItTogetherCurrentQuestion) return;

  // Save current progress before switching
  saveDoItTogetherProgress();

  if (state.doItTogetherMode === "quick") {
    // Switch to Try Myself mode - go back to quick practice at same question
    const currentIndex = quickPracticeQuestions.findIndex(q => q.id === doItTogetherCurrentQuestion.id);
    if (currentIndex >= 0) {
      quickPracticeQuestionIndex = currentIndex;
      quickPracticeQuestion = quickPracticeQuestions[currentIndex];
    }
    exitDoItTogether();
  } else {
    // Switch to Show Me How mode - come back to DIT with saved progress
    startDoItTogether("quick", doItTogetherCurrentQuestion);
  }
};

const revealCurrentStep = () => {
  const stepIndex = state.doItTogetherStepIndex;
  state.doItTogetherRevealed[stepIndex] = true;
  showDoItTogetherStep();
  saveDoItTogetherProgress();
};

const saveDoItTogetherProgress = () => {
  if (!doItTogetherCurrentQuestion) return;

  const progress = {
    stepIndex: state.doItTogetherStepIndex,
    revealed: state.doItTogetherRevealed,
    timestamp: Date.now()
  };
  localStorage.setItem(`dit-progress-${doItTogetherCurrentQuestion.id}`, JSON.stringify(progress));
};

const loadDoItTogetherProgress = (questionId) => {
  try {
    const saved = localStorage.getItem(`dit-progress-${questionId}`);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Failed to load DIT progress:", e);
  }
  return null;
};

const clearDoItTogetherProgress = () => {
  if (!doItTogetherCurrentQuestion) return;
  localStorage.removeItem(`dit-progress-${doItTogetherCurrentQuestion.id}`);
};

const showDoItTogetherStep = () => {
  const step = state.doItTogetherSteps[state.doItTogetherStepIndex];
  if (!step) return;

  const isRevealed = state.doItTogetherRevealed[state.doItTogetherStepIndex];
  const hasBlanks = step.blanks && step.blanks.length > 0;

  document.getElementById("ditStepTitle").textContent = step.title;
  document.getElementById("ditStepIcon").textContent = getIconForStep(state.doItTogetherStepIndex);
  document.getElementById("ditStepIndicator").textContent = `Step ${state.doItTogetherStepIndex + 1} of ${state.doItTogetherSteps.length}`;

  // Render step text with better formatting
  let stepContent = step.text;

  // Apply math formatting first
  stepContent = formatMath(stepContent);

  // Convert newlines to line breaks for multi-line solutions
  if (stepContent.includes("<br>")) {
    // Already has breaks from formatMath or elsewhere
  } else if (step.text.includes("\n")) {
    stepContent = stepContent.replace(/\n/g, "<br>");
  }

  // Replace blanks with input fields or placeholders
  if (hasBlanks && !isRevealed) {
    step.blanks.forEach((blank, idx) => {
      const blankHtml = `<input type="text" class="blank-input" data-blank-idx="${idx}" data-value="${blank.value}" placeholder="?" />`;
      stepContent = stepContent.replace(new RegExp(escapeRegExp(blank.value), 'g'), blankHtml);
    });
    document.getElementById("ditStepText").innerHTML = stepContent;

    // Setup blank input handlers
    document.querySelectorAll(".blank-input").forEach((input) => {
      input.addEventListener("change", (e) => checkBlankAnswer(e));
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") checkBlankAnswer(e);
      });
    });
  } else {
    // Wrap in styled paragraph for better readability
    document.getElementById("ditStepText").innerHTML = `<div style="line-height:1.8;font-size:1.05rem">${stepContent}</div>`;
  }

  // Update progress dots
  const progressContainer = document.getElementById("ditStepProgress");
  if (progressContainer) {
    progressContainer.innerHTML = state.doItTogetherSteps.map((_, idx) =>
      `<div class="solution-step-progress__dot ${idx === state.doItTogetherStepIndex ? "active" : ""} ${idx < state.doItTogetherStepIndex ? "completed" : ""}"></div>`
    ).join("");
  }

  // Update button states for both sets of navigation buttons
  const isFirstStep = state.doItTogetherStepIndex === 0;
  const isLastStep = state.doItTogetherStepIndex === state.doItTogetherSteps.length - 1;

  document.getElementById("ditPrevStepBtn").disabled = isFirstStep;
  document.getElementById("ditNextStepBtn").disabled = isLastStep;
  document.getElementById("ditPrevStepBtn2").disabled = isFirstStep;
  document.getElementById("ditNextStepBtn2").disabled = isLastStep;

  // Show/hide reveal button - only show if there are blanks to reveal
  const revealBtn = document.getElementById("ditRevealBtn");
  const actionsContainer = document.getElementById("ditStepActions");
  if (revealBtn && actionsContainer) {
    if (hasBlanks && !isRevealed) {
      actionsContainer.classList.remove("hidden");
      revealBtn.textContent = "Reveal This Step";
      revealBtn.disabled = false;
    } else {
      // No blanks or already revealed - hide the reveal button
      actionsContainer.classList.add("hidden");
    }
  }

  // Show/hide blanks container
  const blanksContainer = document.getElementById("ditStepBlanks");
  if (blanksContainer) {
    blanksContainer.classList.toggle("hidden", !hasBlanks || isRevealed);
  }

  // Show answer input on last step
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

const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const getIconForStep = (index) => {
  const icons = ["🧠", "💡", "✏️", "🔢", "✅", "🎯", "⭐", "📝"];
  return icons[index % icons.length];
};

const checkBlankAnswer = (e) => {
  const input = e.target;
  const expectedValue = input.dataset.value;
  const userValue = normalizeAnswer(input.value);
  const expectedNormalized = normalizeAnswer(expectedValue);

  if (userValue === expectedNormalized) {
    input.style.borderColor = "var(--success)";
    input.style.background = "rgba(158, 206, 106, 0.15)";
    input.disabled = true;

    // Check if all blanks are filled
    const allBlanks = document.querySelectorAll(".blank-input");
    const allCorrect = Array.from(allBlanks).every(inp =>
      normalizeAnswer(inp.value) === normalizeAnswer(inp.dataset.value)
    );

    if (allCorrect) {
      state.doItTogetherRevealed[state.doItTogetherStepIndex] = true;
      saveDoItTogetherProgress();
      setTimeout(() => {
        showDoItTogetherStep();
      }, 500);
    }
  } else {
    input.style.borderColor = "var(--error)";
    input.style.background = "rgba(247, 118, 142, 0.15)";
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

    // Clear progress for this question since they completed it
    clearDoItTogetherProgress();

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

// ============= ARCADE GAMES =============

// Arcade game state
const arcadeState = {
  speedMath: {
    score: 0,
    timeRemaining: 60,
    timerHandle: null,
    currentQuestion: null,
    active: false,
    difficulty: 1, // Increases with score
  },
  memoryMatch: {
    cards: [],
    flipped: [],
    matched: 0,
    timeElapsed: 0,
    timerHandle: null,
    active: false,
    difficulty: 1,
  },
  numberBurst: {
    score: 0,
    lives: 3,
    target: 10,
    numbers: [],
    active: false,
    operation: '+',
  },
  equationRain: {
    score: 0,
    lives: 3,
    equations: [],
    fallSpeed: 1,
    timerHandle: null,
    active: false,
    difficulty: 1,
  },
};

// Generate skill-based math problems aligned with question bank
const generateSpeedMathProblem = () => {
  const difficulty = arcadeState.speedMath.difficulty;
  const skillTypes = ['algebra', 'numberTheory', 'geometry', 'fractions', 'multiDigit'];
  const skillType = randomElement(skillTypes);

  let question, answer;

  switch (skillType) {
    case 'algebra':
      // Generate algebra problems: solve for x, evaluate expressions
      if (Math.random() < 0.5) {
        // ax + b = c, solve for x
        const a = Math.floor(Math.random() * 10 * difficulty) + 2;
        const x = Math.floor(Math.random() * 20 * difficulty) + 1;
        const b = Math.floor(Math.random() * 50 * difficulty) + 1;
        const c = a * x + b;
        const sign = b >= 0 ? '+' : '-';
        question = `${a}x ${sign} ${Math.abs(b)} = ${c}, find x`;
        answer = String(x);
      } else {
        // Evaluate expression: a(b + c)
        const a = Math.floor(Math.random() * 10 * difficulty) + 2;
        const b = Math.floor(Math.random() * 10 * difficulty) + 1;
        const c = Math.floor(Math.random() * 10 * difficulty) + 1;
        question = `${a}(${b} + ${c}) = ?`;
        answer = String(a * (b + c));
      }
      break;

    case 'numberTheory':
      // GCD, LCM, prime factors, perfect squares
      const ntType = randomElement(['gcd', 'lcm', 'factors', 'squares']);
      if (ntType === 'gcd') {
        const base = Math.floor(Math.random() * 10 * difficulty) + 3;
        const a = base * (Math.floor(Math.random() * 5) + 2);
        const b = base * (Math.floor(Math.random() * 5) + 2);
        question = `GCD(${a}, ${b}) = ?`;
        answer = String(base);
      } else if (ntType === 'lcm') {
        const a = Math.floor(Math.random() * 8 * difficulty) + 3;
        const b = Math.floor(Math.random() * 8 * difficulty) + 3;
        const gcd = (x, y) => (y === 0 ? x : gcd(y, x % y));
        const lcm = (a * b) / gcd(a, b);
        question = `LCM(${a}, ${b}) = ?`;
        answer = String(lcm);
      } else if (ntType === 'factors') {
        const n = Math.floor(Math.random() * 50 * difficulty) + 10;
        let count = 0;
        for (let i = 1; i <= n; i++) {
          if (n % i === 0) count++;
        }
        question = `Number of factors of ${n} = ?`;
        answer = String(count);
      } else {
        // Perfect square check or find
        const root = Math.floor(Math.random() * 20 * difficulty) + 5;
        question = `√${root * root} = ?`;
        answer = String(root);
      }
      break;

    case 'geometry':
      // Area, perimeter, angles
      const geoType = randomElement(['area', 'perimeter', 'pythagorean', 'angles']);
      if (geoType === 'area') {
        const shape = randomElement(['rectangle', 'triangle', 'circle']);
        if (shape === 'rectangle') {
          const l = Math.floor(Math.random() * 20 * difficulty) + 3;
          const w = Math.floor(Math.random() * 15 * difficulty) + 2;
          question = `Area of rectangle: ${l} × ${w} = ?`;
          answer = String(l * w);
        } else if (shape === 'triangle') {
          const b = Math.floor(Math.random() * 20 * difficulty) + 4;
          const h = Math.floor(Math.random() * 15 * difficulty) + 3;
          question = `Area of triangle: base=${b}, height=${h} = ?`;
          answer = String(Math.floor(b * h / 2));
        } else {
          const r = Math.floor(Math.random() * 10 * difficulty) + 2;
          question = `Area of circle (use π=3.14), r=${r} = ?`;
          answer = String(Math.round(3.14 * r * r));
        }
      } else if (geoType === 'pythagorean') {
        // Pythagorean triples
        const triples = [[3,4,5], [5,12,13], [6,8,10], [8,15,17], [9,12,15]];
        const [a, b, c] = randomElement(triples);
        const scale = Math.floor(Math.random() * difficulty) + 1;
        question = `Right triangle: legs ${a*scale} and ${b*scale}, hypotenuse = ?`;
        answer = String(c * scale);
      } else if (geoType === 'angles') {
        const n = randomElement([3, 4, 5, 6, 8]);
        const sum = (n - 2) * 180;
        question = `Sum of interior angles of a ${n}-gon = ?`;
        answer = String(sum);
      } else {
        const l = Math.floor(Math.random() * 15 * difficulty) + 5;
        const w = Math.floor(Math.random() * 12 * difficulty) + 4;
        question = `Perimeter of rectangle: ${l} × ${w} = ?`;
        answer = String(2 * (l + w));
      }
      break;

    case 'fractions':
      // Fraction operations
      const op = randomElement(['add', 'subtract', 'multiply', 'simplify']);
      if (op === 'add' || op === 'subtract') {
        const denom = randomElement([2, 3, 4, 5, 6, 8, 10, 12]);
        const num1 = Math.floor(Math.random() * denom) + 1;
        const num2 = Math.floor(Math.random() * denom) + 1;
        if (op === 'add') {
          question = `${num1}/${denom} + ${num2}/${denom} = ? (simplified)`;
          const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
          const g = gcd(num1 + num2, denom);
          if (denom / g === 1) {
            answer = String((num1 + num2) / g);
          } else {
            answer = `${(num1 + num2) / g}/${denom / g}`;
          }
        } else {
          const max = Math.max(num1, num2);
          const min = Math.min(num1, num2);
          question = `${max}/${denom} - ${min}/${denom} = ? (simplified)`;
          const g = gcd(max - min, denom);
          if (denom / g === 1) {
            answer = String((max - min) / g);
          } else {
            answer = `${(max - min) / g}/${denom / g}`;
          }
        }
      } else if (op === 'multiply') {
        const a = Math.floor(Math.random() * 8 * difficulty) + 2;
        const b = Math.floor(Math.random() * 8) + 2;
        const c = Math.floor(Math.random() * 8 * difficulty) + 2;
        const d = Math.floor(Math.random() * 8) + 2;
        question = `${a}/${b} × ${c}/${d} = ? (simplified)`;
        const num = a * c;
        const den = b * d;
        const g = gcd(num, den);
        if (den / g === 1) {
          answer = String(num / g);
        } else {
          answer = `${num / g}/${den / g}`;
        }
      } else {
        const num = Math.floor(Math.random() * 40 * difficulty) + 10;
        const den = Math.floor(Math.random() * 40) + 5;
        const g = gcd(num, den);
        question = `Simplify ${num}/${den}`;
        answer = `${num/g}/${den/g}`;
      }
      break;

    default:
      // Multi-digit arithmetic
      const multiOp = randomElement(['+', '-', '×']);
      let a, b;
      if (multiOp === '+') {
        a = Math.floor(Math.random() * 100 * difficulty) + 50;
        b = Math.floor(Math.random() * 100 * difficulty) + 50;
        question = `${a} + ${b} = ?`;
        answer = String(a + b);
      } else if (multiOp === '-') {
        a = Math.floor(Math.random() * 200 * difficulty) + 100;
        b = Math.floor(Math.random() * a);
        question = `${a} - ${b} = ?`;
        answer = String(a - b);
      } else {
        a = Math.floor(Math.random() * 20 * difficulty) + 5;
        b = Math.floor(Math.random() * 20) + 3;
        question = `${a} × ${b} = ?`;
        answer = String(a * b);
      }
  }

  return { question: formatMath(question), answer: String(answer) };
};

// Helper function for GCD
const gcd = (a, b) => {
  return b === 0 ? a : gcd(b, a % b);
};

// Speed Math Game
const startSpeedMath = () => {
  arcadeState.speedMath.active = true;
  arcadeState.speedMath.score = 0;
  arcadeState.speedMath.difficulty = 1;
  arcadeState.speedMath.timeRemaining = 60;
  arcadeState.speedMath.timerHandle = null;

  document.getElementById("arcadeGamesPanel")?.classList.add("hidden");
  document.getElementById("speedMathPanel")?.classList.remove("hidden");

  updateSpeedMathDisplay();
  nextSpeedMathProblem();

  // Start timer
  arcadeState.speedMath.timerHandle = setInterval(() => {
    arcadeState.speedMath.timeRemaining--;
    updateSpeedMathDisplay();

    if (arcadeState.speedMath.timeRemaining <= 0) {
      endSpeedMath();
    }
  }, 1000);
};

const updateSpeedMathDisplay = () => {
  document.getElementById("smScoreDisplay").textContent = `Score: ${arcadeState.speedMath.score}`;
  document.getElementById("smTimeDisplay").textContent = `Time: ${arcadeState.speedMath.timeRemaining}s`;
};

const nextSpeedMathProblem = () => {
  // Increase difficulty every 5 points
  arcadeState.speedMath.difficulty = Math.floor(arcadeState.speedMath.score / 5) + 1;
  const problem = generateSpeedMathProblem();
  arcadeState.speedMath.currentQuestion = problem;
  document.getElementById("smQuestionText").innerHTML = formatMath(problem.question);
  document.getElementById("smAnswerInput").value = "";
  document.getElementById("smAnswerInput").focus();
  document.getElementById("smFeedback")?.classList.add("hidden");
};

const checkSpeedMathAnswer = () => {
  const input = document.getElementById("smAnswerInput");
  const feedback = document.getElementById("smFeedback");
  const userAnswer = normalizeAnswer(input.value);
  const correctAnswer = normalizeAnswer(arcadeState.speedMath.currentQuestion.answer);

  if (userAnswer === correctAnswer) {
    arcadeState.speedMath.score++;
    feedback.textContent = "✓ Correct!";
    feedback.className = "result-feedback correct";
  } else {
    feedback.textContent = `✗ Wrong! Answer was ${arcadeState.speedMath.currentQuestion.answer}`;
    feedback.className = "result-feedback incorrect";
  }

  feedback.classList.remove("hidden");
  updateSpeedMathDisplay();

  setTimeout(() => {
    nextSpeedMathProblem();
  }, 800);
};

const endSpeedMath = () => {
  clearInterval(arcadeState.speedMath.timerHandle);
  arcadeState.speedMath.active = false;
  document.getElementById("speedMathPanel")?.classList.add("hidden");
  document.getElementById("arcadeGamesPanel")?.classList.remove("hidden");
  alert(`Time's up! Your score: ${arcadeState.speedMath.score}`);
};

// Memory Match Game
const startMemoryMatch = () => {
  arcadeState.memoryMatch.active = true;
  arcadeState.memoryMatch.matched = 0;
  arcadeState.memoryMatch.flipped = [];
  arcadeState.memoryMatch.timeElapsed = 0;
  arcadeState.memoryMatch.difficulty = 1;

  document.getElementById("arcadeGamesPanel")?.classList.add("hidden");
  document.getElementById("memoryMatchPanel")?.classList.remove("hidden");

  // Generate pairs of math problems and answers based on skill categories
  const pairs = generateMemoryMatchPairs();

  // Shuffle cards
  arcadeState.memoryMatch.cards = shuffleArray(pairs);

  renderMemoryGrid();
  updateMemoryMatchDisplay();

  // Start timer
  arcadeState.memoryMatch.timerHandle = setInterval(() => {
    arcadeState.memoryMatch.timeElapsed++;
    updateMemoryMatchDisplay();

    if (arcadeState.memoryMatch.matched === 8) {
      endMemoryMatch();
    }
  }, 1000);
};

// Generate skill-based memory match pairs
const generateMemoryMatchPairs = () => {
  const difficulty = arcadeState.memoryMatch.difficulty;
  const pairs = [];
  const skillTypes = ['algebra', 'numberTheory', 'geometry', 'fractions'];

  for (let i = 0; i < 8; i++) {
    const skillType = skillTypes[i % skillTypes.length];
    let problem, answer;

    switch (skillType) {
      case 'algebra':
        if (i < 4) {
          // Solve for x: ax + b = c
          const a = Math.floor(Math.random() * 8 * difficulty) + 2;
          const x = Math.floor(Math.random() * 10 * difficulty) + 1;
          const b = Math.floor(Math.random() * 20 * difficulty) + 1;
          const c = a * x + b;
          const sign = b >= 0 ? '+' : '-';
          problem = `${a}x ${sign} ${Math.abs(b)} = ${c}`;
          answer = String(x);
        } else {
          // Evaluate expression: a(b + c)
          const a = Math.floor(Math.random() * 10 * difficulty) + 2;
          const b = Math.floor(Math.random() * 10 * difficulty) + 1;
          const c = Math.floor(Math.random() * 10) + 1;
          problem = `${a}(${b} + ${c})`;
          answer = String(a * (b + c));
        }
        break;

      case 'numberTheory':
        const ntType = randomElement(['gcd', 'squares', 'factors']);
        if (ntType === 'gcd') {
          const base = Math.floor(Math.random() * 8 * difficulty) + 2;
          const num1 = base * (Math.floor(Math.random() * 4) + 2);
          const num2 = base * (Math.floor(Math.random() * 4) + 2);
          problem = `GCD(${num1}, ${num2})`;
          answer = String(base);
        } else if (ntType === 'squares') {
          const root = Math.floor(Math.random() * 15 * difficulty) + 3;
          problem = `√${root * root}`;
          answer = String(root);
        } else {
          const n = Math.floor(Math.random() * 30 * difficulty) + 8;
          let count = 0;
          for (let j = 1; j <= n; j++) {
            if (n % j === 0) count++;
          }
          problem = `Factors of ${n}`;
          answer = String(count);
        }
        break;

      case 'geometry':
        const geoType = randomElement(['area', 'pythagorean', 'perimeter']);
        if (geoType === 'area') {
          const l = Math.floor(Math.random() * 12 * difficulty) + 3;
          const w = Math.floor(Math.random() * 10 * difficulty) + 2;
          problem = `Area: ${l} × ${w}`;
          answer = String(l * w);
        } else if (geoType === 'pythagorean') {
          const triples = [[3,4,5], [5,12,13], [6,8,10], [8,15,17]];
          const [a, b, c] = randomElement(triples);
          const scale = Math.floor(Math.random() * difficulty) + 1;
          problem = `√(${(a*scale)**2} + ${(b*scale)**2})`;
          answer = String(c * scale);
        } else {
          const s = Math.floor(Math.random() * 12 * difficulty) + 4;
          problem = `Square perimeter: ${s}`;
          answer = String(4 * s);
        }
        break;

      case 'fractions':
        const denom = randomElement([2, 3, 4, 5, 6, 8, 10, 12]);
        const num1 = Math.floor(Math.random() * denom) + 1;
        const num2 = Math.floor(Math.random() * denom) + 1;
        const sum = num1 + num2;
        const g = gcd(sum, denom);
        problem = `${num1}/${denom} + ${num2}/${denom}`;
        if (denom / g === 1) {
          answer = String(sum / g);
        } else {
          answer = `${sum/g}/${denom/g}`;
        }
        break;

      default:
        const a = Math.floor(Math.random() * 15 * difficulty) + 5;
        const b = Math.floor(Math.random() * 12 * difficulty) + 3;
        problem = `${a} × ${b}`;
        answer = String(a * b);
    }

    pairs.push({ id: i, content: problem, type: 'problem' });
    pairs.push({ id: i, content: answer, type: 'answer' });
  }

  return pairs;
};

const shuffleArray = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const renderMemoryGrid = () => {
  const grid = document.getElementById("memoryGrid");
  grid.innerHTML = arcadeState.memoryMatch.cards.map((card, index) => {
    const formattedContent = formatMath(card.content);
    return `<div class="memory-card" data-index="${index}" onclick="flipMemoryCard(${index})">
      <div class='card-front'>${formattedContent}</div>
      <div class='card-back'>?</div>
    </div>`;
  }).join("");
};

const flipMemoryCard = (index) => {
  const { cards, flipped } = arcadeState.memoryMatch;

  // Ignore if already matched
  if (cards[index].matched) return;

  // Toggle: if already flipped, flip it back (unless it's matched)
  if (cards[index].flipped) {
    cards[index].flipped = false;
    const grid = document.getElementById("memoryGrid");
    const cardEl = grid.children[index];
    cardEl.classList.remove("flipped");
    return;
  }

  // Ignore if we already have 2 flipped (waiting to check match)
  if (flipped.length >= 2) return;

  cards[index].flipped = true;
  const card = cards[index];

  const grid = document.getElementById("memoryGrid");
  const cardEl = grid.children[index];
  cardEl.classList.add("flipped");

  flipped.push(index);

  if (flipped.length === 2) {
    checkMemoryMatch();
  }
};

const checkMemoryMatch = () => {
  const { cards, flipped } = arcadeState.memoryMatch;
  const [idx1, idx2] = flipped;

  if (cards[idx1].id === cards[idx2].id) {
    // Match found - keep them visible
    cards[idx1].matched = true;
    cards[idx2].matched = true;
    arcadeState.memoryMatch.matched++;
    flipped.length = 0;
    updateMemoryMatchDisplay();

    // Check for win
    if (arcadeState.memoryMatch.matched === 8) {
      setTimeout(endMemoryMatch, 500);
    }
  } else {
    // No match - but keep them visible for learning!
    // Just clear the flipped array so player can try other cards
    flipped.length = 0;
  }
};

const updateMemoryMatchDisplay = () => {
  document.getElementById("mmScoreDisplay").textContent = `Matches: ${arcadeState.memoryMatch.matched}/8`;
  document.getElementById("mmTimeDisplay").textContent = `Time: ${arcadeState.memoryMatch.timeElapsed}s`;
};

const endMemoryMatch = () => {
  clearInterval(arcadeState.memoryMatch.timerHandle);
  arcadeState.memoryMatch.active = false;
  document.getElementById("memoryMatchPanel")?.classList.add("hidden");
  document.getElementById("arcadeGamesPanel")?.classList.remove("hidden");
  alert(`Great job! You completed Memory Match in ${arcadeState.memoryMatch.timeElapsed} seconds!`);
};

// Number Burst Game - Simple: find the target number
const startNumberBurst = () => {
  arcadeState.numberBurst.active = true;
  arcadeState.numberBurst.score = 0;
  arcadeState.numberBurst.lives = 3;
  arcadeState.numberBurst.target = 10;
  arcadeState.numberBurst.difficulty = 1;

  document.getElementById("arcadeGamesPanel")?.classList.add("hidden");
  document.getElementById("numberBurstPanel")?.classList.remove("hidden");

  generateNumberBurstNumbers();
  updateNumberBurstDisplay();
  updateNumberBurstTarget();
};

const updateNumberBurstTarget = () => {
  const diff = arcadeState.numberBurst.difficulty;
  // Generate a target number to find
  arcadeState.numberBurst.target = Math.floor(Math.random() * 15 * diff) + 5;
  document.getElementById("nbTargetText").textContent = `FIND: ${arcadeState.numberBurst.target}`;
};

const generateNumberBurstNumbers = () => {
  const container = document.getElementById("numberBurstGrid");
  arcadeState.numberBurst.numbers = [];
  const target = arcadeState.numberBurst.target;

  for (let i = 0; i < 20; i++) {
    let num;
    // 25% chance to be the target (correct answer)
    if (Math.random() < 0.25) {
      num = target;
    } else {
      // Generate random numbers near the target
      const offset = Math.floor(Math.random() * 10) - 5;
      num = Math.max(1, target + offset);
    }
    arcadeState.numberBurst.numbers.push(num);
  }

  container.innerHTML = arcadeState.numberBurst.numbers.map((num, idx) => `
    <button class="number-burst-btn" onclick="catchNumberBurst(${idx})">${num}</button>
  `).join("");
};

const catchNumberBurst = (index) => {
  const btns = document.querySelectorAll(".number-burst-btn");
  const num = arcadeState.numberBurst.numbers[index];
  const target = arcadeState.numberBurst.target;

  if (num === target) {
    // Correct! Found the target number
    arcadeState.numberBurst.score++;
    btns[index].style.background = "rgba(158, 206, 106, 0.3)";
    btns[index].style.borderColor = "var(--success)";

    // Generate new number for this spot
    setTimeout(() => {
      const newNum = Math.floor(Math.random() * 30) + 1;
      arcadeState.numberBurst.numbers[index] = newNum;
      btns[index].textContent = newNum;
      btns[index].style.background = "";
      btns[index].style.borderColor = "";
    }, 300);

    // Increase difficulty every 5 points
    if (arcadeState.numberBurst.score % 5 === 0) {
      arcadeState.numberBurst.difficulty = Math.floor(arcadeState.numberBurst.score / 5) + 1;
      updateNumberBurstTarget();
      generateNumberBurstNumbers();
    }
  } else {
    // Wrong number!
    arcadeState.numberBurst.lives--;
    btns[index].classList.add("caught");
    setTimeout(() => btns[index].classList.remove("caught"), 300);

    if (arcadeState.numberBurst.lives <= 0) {
      endNumberBurst();
      return;
    }
  }

  updateNumberBurstDisplay();
};

const updateNumberBurstDisplay = () => {
  document.getElementById("nbScoreDisplay").textContent = `Score: ${arcadeState.numberBurst.score}`;
  document.getElementById("nbLivesDisplay").textContent = `Lives: ${"❤️".repeat(arcadeState.numberBurst.lives)}`;
};

const endNumberBurst = () => {
  arcadeState.numberBurst.active = false;
  document.getElementById("numberBurstPanel")?.classList.add("hidden");
  document.getElementById("arcadeGamesPanel")?.classList.remove("hidden");
  alert(`Game Over! Your score: ${arcadeState.numberBurst.score}`);
};

// Equation Rain Game - Skill-based equations from question bank topics
const startEquationRain = () => {
  arcadeState.equationRain.active = true;
  arcadeState.equationRain.score = 0;
  arcadeState.equationRain.lives = 3;
  arcadeState.equationRain.fallSpeed = 0.5;
  arcadeState.equationRain.difficulty = 1;
  arcadeState.equationRain.equations = [];

  document.getElementById("arcadeGamesPanel")?.classList.add("hidden");
  document.getElementById("equationRainPanel")?.classList.remove("hidden");
  document.getElementById("equationRainContainer").innerHTML = `
    <div id="rainClouds" style="position:absolute;top:0;left:0;right:0;height:50px;background:linear-gradient(180deg,rgba(100,100,120,0.3),transparent)"></div>
  `;
  document.getElementById("erAnswerInput").value = "";

  updateEquationRainDisplay();

  // Spawn equations
  spawnEquation();

  // Start game loop
  arcadeState.equationRain.timerHandle = setInterval(() => {
    updateEquationRain();

    // Spawn new equations periodically
    if (Math.random() < 0.025) {
      spawnEquation();
    }
  }, 50);
};

// Generate skill-based equation for Equation Rain
const generateEquationRainProblem = () => {
  const diff = arcadeState.equationRain.difficulty;
  const skillTypes = ['algebra', 'numberTheory', 'geometry', 'fractions', 'multiDigit'];
  const skillType = randomElement(skillTypes);

  let question, answer;

  switch (skillType) {
    case 'algebra':
      const algType = randomElement(['solveX', 'evaluate', 'simplify']);
      if (algType === 'solveX') {
        const a = Math.floor(Math.random() * 8 * diff) + 2;
        const x = Math.floor(Math.random() * 10 * diff) + 1;
        const b = Math.floor(Math.random() * 30 * diff) + 1;
        const c = a * x + b;
        const sign = b >= 0 ? '+' : '-';
        question = `${a}x${sign}${Math.abs(b)}=${c}`;
        answer = String(x);
      } else if (algType === 'evaluate') {
        const a = Math.floor(Math.random() * 10 * diff) + 2;
        const b = Math.floor(Math.random() * 10 * diff) + 1;
        const c = Math.floor(Math.random() * 10) + 1;
        question = `${a}(${b}+${c})`;
        answer = String(a * (b + c));
      } else {
        const a = Math.floor(Math.random() * 10 * diff) + 2;
        const b = Math.floor(Math.random() * 10) + 1;
        question = `${a}**2-${b}**2`;
        answer = String((a + b) * (a - b));
      }
      break;

    case 'numberTheory':
      const ntType = randomElement(['gcd', 'lcm', 'sqrt', 'factors']);
      if (ntType === 'gcd') {
        const base = Math.floor(Math.random() * 8 * diff) + 2;
        const num1 = base * (Math.floor(Math.random() * 4) + 2);
        const num2 = base * (Math.floor(Math.random() * 4) + 2);
        question = `GCD(${num1},${num2})`;
        answer = String(base);
      } else if (ntType === 'lcm') {
        const a = Math.floor(Math.random() * 8 * diff) + 2;
        const b = Math.floor(Math.random() * 6) + 2;
        const g = gcd(a, b);
        const lcm = (a * b) / g;
        question = `LCM(${a},${b})`;
        answer = String(lcm);
      } else if (ntType === 'sqrt') {
        const root = Math.floor(Math.random() * 15 * diff) + 2;
        question = `√${root * root}`;
        answer = String(root);
      } else {
        const n = Math.floor(Math.random() * 30 * diff) + 6;
        let count = 0;
        for (let i = 1; i <= n; i++) {
          if (n % i === 0) count++;
        }
        question = `Factors(${n})`;
        answer = String(count);
      }
      break;

    case 'geometry':
      const geoType = randomElement(['area', 'pythagorean', 'perimeter', 'angles']);
      if (geoType === 'area') {
        const shape = randomElement(['rectangle', 'triangle']);
        if (shape === 'rectangle') {
          const l = Math.floor(Math.random() * 15 * diff) + 3;
          const w = Math.floor(Math.random() * 12 * diff) + 2;
          question = `${l}×${w}(area)`;
          answer = String(l * w);
        } else {
          const b = Math.floor(Math.random() * 16 * diff) + 4;
          const h = Math.floor(Math.random() * 12 * diff) + 3;
          question = `△(${b},${h})`;
          answer = String(Math.floor(b * h / 2));
        }
      } else if (geoType === 'pythagorean') {
        const triples = [[3,4,5], [5,12,13], [6,8,10], [8,15,17]];
        const [a, b, c] = randomElement(triples);
        const scale = Math.floor(Math.random() * diff) + 1;
        question = `√(${(a*scale)**2}+${(b*scale)**2})`;
        answer = String(c * scale);
      } else if (geoType === 'perimeter') {
        const l = Math.floor(Math.random() * 12 * diff) + 4;
        const w = Math.floor(Math.random() * 10 * diff) + 3;
        question = `P(${l},${w})`;
        answer = String(2 * (l + w));
      } else {
        const n = randomElement([3, 4, 5, 6]);
        const angleSum = (n - 2) * 180;
        question = `${n}-gon angle sum`;
        answer = String(angleSum);
      }
      break;

    case 'fractions':
      const denom = randomElement([2, 3, 4, 5, 6, 8, 10]);
      const num1 = Math.floor(Math.random() * denom) + 1;
      const num2 = Math.floor(Math.random() * denom) + 1;
      const op = randomElement(['+', '-']);
      if (op === '+') {
        question = `${num1}/${denom}+${num2}/${denom}`;
        const sum = num1 + num2;
        const g = gcd(sum, denom);
        if (denom / g === 1) {
          answer = String(sum / g);
        } else {
          answer = `${sum/g}/${denom/g}`;
        }
      } else {
        const max = Math.max(num1, num2);
        const min = Math.min(num1, num2);
        question = `${max}/${denom}-${min}/${denom}`;
        const diff = max - min;
        const g = gcd(diff, denom);
        if (denom / g === 1) {
          answer = String(diff / g);
        } else {
          answer = `${diff/g}/${denom/g}`;
        }
      }
      break;

    default:
      // Multi-digit arithmetic
      const multiOp = randomElement(['+', '-', '×']);
      let a, b;
      if (multiOp === '+') {
        a = Math.floor(Math.random() * 50 * diff) + 20;
        b = Math.floor(Math.random() * 50 * diff) + 20;
        question = `${a}+${b}`;
        answer = String(a + b);
      } else if (multiOp === '-') {
        a = Math.floor(Math.random() * 80 * diff) + 50;
        b = Math.floor(Math.random() * a);
        question = `${a}-${b}`;
        answer = String(a - b);
      } else {
        a = Math.floor(Math.random() * 15 * diff) + 5;
        b = Math.floor(Math.random() * 12) + 3;
        question = `${a}×${b}`;
        answer = String(a * b);
      }
  }

  return { question: formatMath(question), answer: String(answer) };
};

const spawnEquation = () => {
  const container = document.getElementById("equationRainContainer");
  const problem = generateEquationRainProblem();

  const equation = {
    id: Date.now() + Math.random(),
    x: Math.random() * 80 + 10, // 10-90%
    y: -40,
    answer: problem.answer,
    element: null,
  };

  const el = document.createElement("div");
  el.className = "rain-equation";
  el.textContent = problem.question;
  el.style.left = `${equation.x}%`;
  el.style.top = `${equation.y}px`;
  el.onclick = () => solveEquation(equation);

  container.appendChild(el);
  equation.element = el;
  arcadeState.equationRain.equations.push(equation);
};

const solveEquation = (equation) => {
  const input = document.getElementById("erAnswerInput");
  const feedback = document.getElementById("erFeedback");
  const userAnswer = normalizeAnswer(input.value);

  if (userAnswer === String(equation.answer)) {
    arcadeState.equationRain.score++;
    equation.element.remove();
    arcadeState.equationRain.equations = arcadeState.equationRain.equations.filter(e => e.id !== equation.id);
    input.value = "";
    feedback.textContent = "✓";
    feedback.className = "result-feedback correct";
    feedback.classList.remove("hidden");
    setTimeout(() => feedback.classList.add("hidden"), 500);
    updateEquationRainDisplay();
  }
};

const updateEquationRain = () => {
  arcadeState.equationRain.equations.forEach((eq) => {
    eq.y += arcadeState.equationRain.fallSpeed;
    eq.element.style.top = `${eq.y}px`;

    // Check if reached bottom
    if (eq.y > 220) {
      arcadeState.equationRain.lives--;
      eq.element.remove();
      updateEquationRainDisplay();

      if (arcadeState.equationRain.lives <= 0) {
        endEquationRain();
      }
    }
  });

  // Increase difficulty based on score
  if (arcadeState.equationRain.score > 0 && arcadeState.equationRain.score % 5 === 0) {
    const newDifficulty = Math.floor(arcadeState.equationRain.score / 5) + 1;
    if (newDifficulty > arcadeState.equationRain.difficulty) {
      arcadeState.equationRain.difficulty = newDifficulty;
      arcadeState.equationRain.fallSpeed += 0.3; // Increase fall speed
    }
  } else {
    // Gradual increase
    arcadeState.equationRain.fallSpeed += 0.001;
  }
};

const updateEquationRainDisplay = () => {
  document.getElementById("erScoreDisplay").textContent = `Score: ${arcadeState.equationRain.score}`;
  document.getElementById("erLivesDisplay").textContent = `Lives: ${arcadeState.equationRain.lives}`;
};

const endEquationRain = () => {
  clearInterval(arcadeState.equationRain.timerHandle);
  arcadeState.equationRain.active = false;
  document.getElementById("equationRainPanel")?.classList.add("hidden");
  document.getElementById("arcadeGamesPanel")?.classList.remove("hidden");
  alert(`Game Over! Your score: ${arcadeState.equationRain.score}`);
};

// Initialize Arcade Games
const initArcadeGames = () => {
  // Back button
  document.getElementById("arcadeBackBtn")?.addEventListener("click", () => {
    document.getElementById("arcadeGamesPanel")?.classList.add("hidden");
    document.getElementById("gameModesPanel")?.classList.remove("hidden");
  });

  // Game selection buttons
  document.querySelector('[data-arcade="speed-math"]')?.addEventListener("click", startSpeedMath);
  document.querySelector('[data-arcade="memory-match"]')?.addEventListener("click", startMemoryMatch);
  document.querySelector('[data-arcade="number-burst"]')?.addEventListener("click", startNumberBurst);
  document.querySelector('[data-arcade="equation-rain"]')?.addEventListener("click", startEquationRain);

  // Exit buttons
  document.getElementById("smExitBtn")?.addEventListener("click", () => {
    clearInterval(arcadeState.speedMath.timerHandle);
    document.getElementById("speedMathPanel")?.classList.add("hidden");
    document.getElementById("arcadeGamesPanel")?.classList.remove("hidden");
  });

  document.getElementById("mmExitBtn")?.addEventListener("click", () => {
    clearInterval(arcadeState.memoryMatch.timerHandle);
    document.getElementById("memoryMatchPanel")?.classList.add("hidden");
    document.getElementById("arcadeGamesPanel")?.classList.remove("hidden");
  });

  document.getElementById("nbExitBtn")?.addEventListener("click", () => {
    document.getElementById("numberBurstPanel")?.classList.add("hidden");
    document.getElementById("arcadeGamesPanel")?.classList.remove("hidden");
  });

  document.getElementById("erExitBtn")?.addEventListener("click", () => {
    clearInterval(arcadeState.equationRain.timerHandle);
    document.getElementById("equationRainPanel")?.classList.add("hidden");
    document.getElementById("arcadeGamesPanel")?.classList.remove("hidden");
  });

  // Submit buttons
  document.getElementById("smSubmitBtn")?.addEventListener("click", checkSpeedMathAnswer);
  document.getElementById("smAnswerInput")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") checkSpeedMathAnswer();
  });

  document.getElementById("erSubmitBtn")?.addEventListener("click", () => {
    // Find the lowest equation and solve it
    const equations = arcadeState.equationRain.equations;
    if (equations.length > 0) {
      const lowest = equations.reduce((min, eq) => eq.y > min.y ? eq : min, equations[0]);
      solveEquation(lowest);
    }
  });
  document.getElementById("erAnswerInput")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      const equations = arcadeState.equationRain.equations;
      if (equations.length > 0) {
        const lowest = equations.reduce((min, eq) => eq.y > min.y ? eq : min, equations[0]);
        solveEquation(lowest);
      }
    }
  });

  // Expose functions globally for onclick handlers
  window.flipMemoryCard = flipMemoryCard;
  window.catchNumberBurst = catchNumberBurst;
};
