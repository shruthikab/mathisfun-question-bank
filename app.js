const state = {
  role: "student",
  data: [],
  importedData: [],
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
const aiImportPanel = document.getElementById("aiImportPanel");
const paperUploadInput = document.getElementById("paperUploadInput");
const aiImportBtn = document.getElementById("aiImportBtn");
const clearImportedBtn = document.getElementById("clearImportedBtn");
const exportCombinedBtn = document.getElementById("exportCombinedBtn");
const aiImportStatus = document.getElementById("aiImportStatus");

const solutionMap = window.MATHISFUN_SOLUTIONS || {};
const STORAGE_KEYS = {
  role: "mathquest-role",
  roleLegacy: "mathisfun-role",
  viewMode: "mathquest-view-mode",
  viewModeLegacy: "mathisfun-view-mode",
  timer: "mathquest-timer-minutes",
  timerLegacy: "mathisfun-timer-minutes",
  imported: "mathquest-imported-questions",
};

const unique = (items) => Array.from(new Set(items)).sort();
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

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

const getAllQuestions = () => [...state.data, ...state.importedData];

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

const setStatus = (text, tone = "info") => {
  if (!aiImportStatus) return;
  aiImportStatus.textContent = text;
  aiImportStatus.dataset.tone = tone;
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

const persistImportedData = () => {
  localStorage.setItem(STORAGE_KEYS.imported, JSON.stringify(state.importedData));
};

const loadImportedData = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.imported);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) state.importedData = parsed;
  } catch {
    state.importedData = [];
  }
};

const generateImportId = (index, existingIds) => {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate()
  ).padStart(2, "0")}`;

  let i = index + 1;
  let id = `AI_${stamp}_${String(i).padStart(3, "0")}`;
  while (existingIds.has(id)) {
    i += 1;
    id = `AI_${stamp}_${String(i).padStart(3, "0")}`;
  }
  return id;
};

const normalizeImportedQuestions = (rows) => {
  const existingIds = new Set(getAllQuestions().map((q) => q.id));

  return rows
    .map((r, idx) => {
      const question = String(r.question || r.prompt || "").trim();
      if (!question) return null;

      let id = String(r.id || "").trim();
      if (!id || existingIds.has(id)) {
        id = generateImportId(idx, existingIds);
      }
      existingIds.add(id);

      return {
        id,
        paper: String(r.paper || "Imported Paper").trim() || "Imported Paper",
        category: String(r.category || "General").trim() || "General",
        question,
        hint: String(r.hint || "").trim(),
        answer: String(r.answer || "").trim(),
      };
    })
    .filter(Boolean);
};

const readFileAsText = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file as text."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsText(file);
  });

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file as image."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });

const parseQuestionsWithAIService = async (file) => {
  const isImage = file.type.startsWith("image/");
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const content = isImage || isPdf ? await readFileAsDataUrl(file) : await readFileAsText(file);

  const response = await fetch("/api/import-questions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName: file.name,
      isImage,
      isPdf,
      content,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`AI import failed (${response.status}): ${err.slice(0, 300)}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload.questions)) {
    throw new Error("AI import service returned invalid response.");
  }
  return payload.questions;
};

const handleAiImport = async () => {
  const file = paperUploadInput.files?.[0];
  if (!file) {
    setStatus("Choose a file first.", "error");
    return;
  }

  try {
    aiImportBtn.disabled = true;
    setStatus("Reading and parsing file...", "info");

    let parsed;
    if (file.name.toLowerCase().endsWith(".json")) {
      const text = await readFileAsText(file);
      parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        throw new Error("JSON file must contain an array of question objects.");
      }
    } else {
      setStatus("Sending file to server-side AI import...", "info");
      parsed = await parseQuestionsWithAIService(file);
    }

    const normalized = normalizeImportedQuestions(parsed);
    if (!normalized.length) {
      throw new Error("No valid questions were extracted.");
    }

    state.importedData = [...state.importedData, ...normalized];
    persistImportedData();
    refreshFiltersAndStats();
    render();

    setStatus(`Imported ${normalized.length} question(s).`, "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    aiImportBtn.disabled = false;
  }
};

const clearImportedQuestions = () => {
  state.importedData = [];
  persistImportedData();
  refreshFiltersAndStats();
  render();
  setStatus("Cleared imported questions.", "info");
};

const exportCombinedQuestions = () => {
  const all = getAllQuestions();
  const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mathquest-questions-combined.json";
  a.click();
  URL.revokeObjectURL(url);
  setStatus("Exported combined JSON.", "success");
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
  aiImportPanel.classList.toggle("hidden", !isAdmin);

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

  loadImportedData();
  loadRole();
  setRole(state.role);
  render();

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
  } catch (error) {
    if (Array.isArray(window.MATHISFUN_QUESTIONS)) {
      try {
        state.data = normalizeQuestions(window.MATHISFUN_QUESTIONS, "config-data.js");
        state.loaded = true;
        state.error = "";
        refreshFiltersAndStats();
        render();
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

aiImportBtn.addEventListener("click", handleAiImport);
clearImportedBtn.addEventListener("click", clearImportedQuestions);
exportCombinedBtn.addEventListener("click", exportCombinedQuestions);

// Export init function for auth.js to call
window.init = init;
