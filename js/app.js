  // Surface any script error on screen instead of failing silently.
  window.onerror = function (msg, src, line, col) {
    const b = document.getElementById('errorBanner');
    if (b) {
      b.style.display = 'block';
      b.textContent = 'Script error: ' + msg + ' (line ' + line + ':' + col + ')';
    }
    return false;
  };
 
  // show/hide via inline styles so no stylesheet rule can override them
  function show(el, mode) { if (el) el.style.display = mode || ''; }
  function hide(el) { if (el) el.style.display = 'none'; }
 
  const root = document.documentElement;
  const GOAL = 1000;
 
  function safeGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSet(key, val) {
    try { localStorage.setItem(key, val); } catch (e) { /* ignore */ }
  }
  function safeRemove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }
 
  /* ---------- Theme (single source of truth, no DOM re-reading) ---------- */
  let theme = safeGet('thousand-theme') === 'light' ? 'light' : 'dark';
  const themeLabel = document.getElementById('themeLabel');
 
  function applyTheme() {
    root.setAttribute('data-theme', theme);
    themeLabel.textContent = theme;
  }
  applyTheme();
 
  document.getElementById('themeToggle').addEventListener('click', function () {
    theme = (theme === 'light') ? 'dark' : 'light';
    applyTheme();
    safeSet('thousand-theme', theme);
  });
 
  /* ---------- Name ---------- */
  const name = safeGet('thousand-name');
  if (!name) {
    window.location.replace('index.html');
  } else {
    document.getElementById('greetName').textContent = name;
  }
 
  /* ---------- Star progress ---------- */
  let currentStars = Math.max(0, parseInt(safeGet('thousand-stars') || '0', 10) || 0);
 
  function refreshProgress() {
    document.getElementById('starCount').textContent = currentStars.toLocaleString();
    document.getElementById('progressNumber').textContent = currentStars.toLocaleString();
    const pct = Math.min(100, Math.round((currentStars / GOAL) * 100));
    document.getElementById('progressFill').style.width = pct + '%';
    document.getElementById('progressPct').textContent =
      currentStars >= GOAL ? "You've completed the 1000!" : pct + '% of the way there';
  }
  refreshProgress();
 
  /* ============================================================
     EXERCISES ARE LOADED FROM stars.json — edit that file, not this one.
     Format of each entry in stars.json:
       "name": 10                      -> flat stars per rep
       "name": "100 stars per minute"  -> stars over time
                                          ("per minute", "per 10 seconds", ...)
     FALLBACK_EXERCISES below is only used if stars.json can't be
     loaded (for example when opening the page straight from disk
     with file://, where browsers block fetch). Keep it in sync, or
     ignore it entirely if you always run a local server.
     ============================================================ */
  const FALLBACK_EXERCISES = {
    "pull-up": 10,
    "squads": 1,
    "push-up": 1,
    "biceps": 2,
    "plank": "50 stars per minute",
    "forearm-60-kg": 1,
    "abs/oblique": "100 stars per minute",
    "handstand": "100 stars per 10 seconds",
    "horizontal-hang": "100 stars per 5 seconds",
    "l-sit": "20 stars per 5 seconds",
    "beam-balance": "40 stars per minute",
    "beam-pushups": 2,
    "school-run": 100,
    "front-closed-hang": "20 stars per 5 seconds"
  };
  /* ============================================================ */
 
  let EXERCISE_LIST = [];
 
  function prettifyName(key) {
    return key
      .split('/')
      .map(function (part) {
        return part.split('-').map(function (w) {
          return w.charAt(0).toUpperCase() + w.slice(1);
        }).join(' ');
      })
      .join(' / ');
  }
 
  function parseExercise(value) {
    if (typeof value === 'number') {
      return { type: 'reps', starsPerRep: value };
    }
    const match = /^(\d+(?:\.\d+)?)\s*stars?\s*per\s*(\d+)?\s*(minute|minutes|second|seconds)$/i
      .exec(String(value).trim());
    if (!match) return { type: 'reps', starsPerRep: 0 };
    const stars = parseFloat(match[1]);
    const amount = match[2] ? parseFloat(match[2]) : 1;
    const unitSeconds = /minute/i.test(match[3]) ? 60 : 1;
    return { type: 'time', starsPerSecond: stars / (amount * unitSeconds) };
  }
 
  function buildExerciseList(data) {
    EXERCISE_LIST = Object.keys(data).map(function (key) {
      const parsed = parseExercise(data[key]);
      return {
        key: key,
        label: prettifyName(key),
        type: parsed.type,
        starsPerRep: parsed.starsPerRep,
        starsPerSecond: parsed.starsPerSecond
      };
    });
  }
 
  function rateSummary(ex) {
    return ex.type === 'reps'
      ? ex.starsPerRep + '★ / rep'
      : (Math.round(ex.starsPerSecond * 60 * 10) / 10) + '★ / min';
  }
 
  /* ---------- Exercise picker ---------- */
  let selectedExercise = null;
  let selectedAmount = null;
 
  const exerciseListEl = document.getElementById('exerciseList');
  const searchInput = document.getElementById('exerciseSearch');
  const amountSection = document.getElementById('amountSection');
  const amountLabel = document.getElementById('amountLabel');
  const presetRow = document.getElementById('presetRow');
  const customAmount = document.getElementById('customAmount');
  const rewardPreview = document.getElementById('rewardPreview');
  const rewardStars = document.getElementById('rewardStars');
  const addSetBtn = document.getElementById('addSetBtn');
 
  function renderExerciseList() {
    const q = searchInput.value.trim().toLowerCase();
    const matches = EXERCISE_LIST.filter(function (ex) {
      return ex.label.toLowerCase().indexOf(q) !== -1 || ex.key.toLowerCase().indexOf(q) !== -1;
    });
 
    exerciseListEl.innerHTML = '';
 
    if (matches.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'exercise-empty';
      empty.textContent = EXERCISE_LIST.length === 0
        ? 'Loading exercises…'
        : 'No exercises match that search.';
      exerciseListEl.appendChild(empty);
      return;
    }
 
    matches.forEach(function (ex) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'exercise-row';
      btn.setAttribute('data-key', ex.key);
      if (selectedExercise && selectedExercise.key === ex.key) btn.classList.add('selected');
 
      const nameSpan = document.createElement('span');
      nameSpan.textContent = ex.label;
      const rateSpan = document.createElement('span');
      rateSpan.className = 'rate';
      rateSpan.textContent = rateSummary(ex);
 
      btn.appendChild(nameSpan);
      btn.appendChild(rateSpan);
      exerciseListEl.appendChild(btn);
    });
  }
 
  // One delegated listener on the container survives every re-render.
  exerciseListEl.addEventListener('click', function (e) {
    const row = e.target.closest ? e.target.closest('.exercise-row') : null;
    if (!row) return;
    const key = row.getAttribute('data-key');
    const ex = EXERCISE_LIST.filter(function (x) { return x.key === key; })[0];
    if (ex) selectExercise(ex);
  });
 
  // Preset chips are rebuilt from scratch every time, including "More".
  function renderPresetChips(ex) {
    if (!presetRow) return;
    const presets = (ex.type === 'reps') ? [5, 10, 15, 20, 30] : [5, 10, 15, 30, 60];
    presetRow.innerHTML = '';
 
    presets.forEach(function (n) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.textContent = String(n);
      chip.addEventListener('click', function () {
        selectedAmount = n;
        hide(customAmount);
        customAmount.value = '';
        markSelectedChip(chip);
        updateReward();
      });
      presetRow.appendChild(chip);
    });
 
    const moreChip = document.createElement('button');
    moreChip.type = 'button';
    moreChip.className = 'chip';
    moreChip.textContent = 'More';
    moreChip.addEventListener('click', function () {
      show(customAmount, 'block');
      markSelectedChip(moreChip);
      try { customAmount.focus(); } catch (err) { /* ignore */ }
      const v = parseFloat(customAmount.value);
      selectedAmount = (isFinite(v) && v > 0) ? v : null;
      updateReward();
    });
    presetRow.appendChild(moreChip);
  }
 
  function markSelectedChip(chip) {
    const chips = presetRow.querySelectorAll('.chip');
    for (let i = 0; i < chips.length; i++) chips[i].classList.remove('selected');
    chip.classList.add('selected');
  }
 
  function selectExercise(ex) {
    selectedExercise = ex;
    selectedAmount = null;
    if (customAmount) { customAmount.value = ''; hide(customAmount); }
    hide(rewardPreview);
    addSetBtn.disabled = true;
 
    renderExerciseList();
 
    show(amountSection, 'block');
    amountLabel.textContent = (ex.type === 'reps') ? 'How many reps?' : 'How many seconds?';
    renderPresetChips(ex);
  }
 
  customAmount.addEventListener('input', function () {
    const v = parseFloat(customAmount.value);
    selectedAmount = (isFinite(v) && v > 0) ? v : null;
    updateReward();
  });
 
  function computeReward() {
    if (!selectedExercise || !selectedAmount || selectedAmount <= 0) return 0;
    return selectedExercise.type === 'reps'
      ? Math.round(selectedExercise.starsPerRep * selectedAmount)
      : Math.round(selectedExercise.starsPerSecond * selectedAmount);
  }
 
  function updateReward() {
    const reward = computeReward();
    if (reward > 0) { show(rewardPreview, 'block'); } else { hide(rewardPreview); }
    rewardStars.textContent = reward.toLocaleString();
    addSetBtn.disabled = reward <= 0;
  }
 
  searchInput.addEventListener('input', renderExerciseList);
 
  /* ---------- Activity log ---------- */
  function getLog() {
    try { return JSON.parse(safeGet('thousand-log') || '[]'); } catch (e) { return []; }
  }
  function setLog(log) { safeSet('thousand-log', JSON.stringify(log)); }
 
  function formatWhen(ts) {
    const mins = Math.round((Date.now() - ts) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + ' min ago';
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + ' hr ago';
    const days = Math.round(hrs / 24);
    return days + ' day' + (days === 1 ? '' : 's') + ' ago';
  }
 
  function renderLog() {
    const log = getLog();
    const logListEl = document.getElementById('logList');
    logListEl.innerHTML = '';
 
    if (log.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'log-empty';
      empty.textContent = "Nothing logged yet — your sets will show up here.";
      logListEl.appendChild(empty);
      return;
    }
 
    log.forEach(function (entry) {
      const row = document.createElement('div');
      row.className = 'log-item';
 
      const left = document.createElement('div');
      const nameDiv = document.createElement('div');
      nameDiv.className = 'log-name';
      nameDiv.textContent = entry.label;
      const metaDiv = document.createElement('div');
      metaDiv.className = 'log-meta';
      metaDiv.textContent = entry.amount + ' ' + entry.unit + ' · ' + formatWhen(entry.at);
      left.appendChild(nameDiv);
      left.appendChild(metaDiv);
 
      const starsDiv = document.createElement('div');
      starsDiv.className = 'log-stars';
      starsDiv.textContent = '+' + entry.stars;
 
      row.appendChild(left);
      row.appendChild(starsDiv);
      logListEl.appendChild(row);
    });
  }
 
  addSetBtn.addEventListener('click', function () {
    const reward = computeReward();
    if (!selectedExercise || reward <= 0) return;
 
    currentStars += reward;
    safeSet('thousand-stars', String(currentStars));
 
    const log = getLog();
    log.unshift({
      label: selectedExercise.label,
      amount: selectedAmount,
      unit: (selectedExercise.type === 'reps') ? 'reps' : 'sec',
      stars: reward,
      at: Date.now()
    });
    setLog(log.slice(0, 20));
 
    refreshProgress();
    renderLog();
 
    selectedExercise = null;
    selectedAmount = null;
    hide(amountSection);
    hide(rewardPreview);
    addSetBtn.disabled = true;
    searchInput.value = '';
    renderExerciseList();
  });
 
  document.getElementById('changeNameBtn').addEventListener('click', function () {
    safeRemove('thousand-name');
    window.location.href = 'index.html';
  });
 
  /* ---------- Clear data ---------- */
  const clearModal = document.getElementById('clearModal');
 
  function openModal() { show(clearModal, 'flex'); }
  function closeModal() { hide(clearModal); }
 
  // Always start closed, including when the browser restores the page
  // from its back/forward cache.
  closeModal();
  window.addEventListener('pageshow', closeModal);
 
  document.getElementById('clearDataBtn').addEventListener('click', openModal);
  document.getElementById('cancelClearBtn').addEventListener('click', closeModal);
  document.getElementById('confirmClearBtn').addEventListener('click', function () {
    safeRemove('thousand-name');
    safeRemove('thousand-stars');
    safeRemove('thousand-log');
    closeModal();
    window.location.href = 'index.html';
  });
  clearModal.addEventListener('click', function (e) {
    if (e.target === clearModal) closeModal();
  });
 
  /* ---------- Load exercises from stars.json ---------- */
  try {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
  } catch (err) { /* ignore */ }
 
  renderExerciseList();
  renderLog();
 
  function useFallback(reason) {
    console.warn('Could not load stars.json, using built-in list:', reason);
    buildExerciseList(FALLBACK_EXERCISES);
    renderExerciseList();
  }
 
  try {
    if (typeof fetch !== 'function') {
      useFallback('fetch unavailable');
    } else {
      fetch('stars.json', { cache: 'no-store' })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function (data) {
          buildExerciseList(data);
          renderExerciseList();
        })
        .catch(useFallback);
    }
  } catch (err) {
    useFallback(err);
  }
