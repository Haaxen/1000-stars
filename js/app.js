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

// The number currently shown on screen. It chases currentStars during
// an animation, so a second add/delete mid-animation continues smoothly.
let displayedStars = currentStars;
let progressAnimFrame = null;

// Draws one frame of the progress UI for a given (possibly mid-count) value.
function renderProgress(value) {
    const shown = Math.round(value);
    document.getElementById('starCount').textContent = shown.toLocaleString();
    document.getElementById('progressNumber').textContent = shown.toLocaleString();

    const rawPct = Math.round((shown / GOAL) * 100);
    const pct = Math.min(100, rawPct);
    document.getElementById('progressFill').style.width = pct + '%';
    document.getElementById('progressPct').textContent =
        shown > GOAL ? "Gaddem you made it up to " + rawPct + "%" : pct + '% of the way there';
}

// refreshProgress(false) or refreshProgress(): jump straight to the value.
// refreshProgress(true): count quickly from the old number to the new one.
function refreshProgress(animate) {
    const card = document.querySelector('.progress-card');
    if (progressAnimFrame && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(progressAnimFrame);
        progressAnimFrame = null;
    }

    const from = displayedStars;
    const to = currentStars;

    if (!animate || from === to || typeof requestAnimationFrame !== 'function') {
        displayedStars = to;
        renderProgress(to);
        if (card) card.classList.remove('counting');
        return;
    }

    // Longer jumps take a bit longer, but never more than ~1.6 seconds.
    const duration = Math.min(1600, 600 + Math.abs(to - from) * 3);
    const startTime = performance.now();
    if (card) card.classList.add('counting');

    function step(now) {
        const t = Math.min(1, (now - startTime) / duration);
        const eased = 1 - Math.pow(1 - t, 3);          // fast start, soft landing
        displayedStars = from + (to - from) * eased;
        renderProgress(displayedStars);
        if (t < 1) {
        progressAnimFrame = requestAnimationFrame(step);
        } else {
        displayedStars = to;
        renderProgress(to);
        progressAnimFrame = null;
        if (card) card.classList.remove('counting');
        }
    }
    progressAnimFrame = requestAnimationFrame(step);
}
refreshProgress(false);

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
let customAmountEl = null;

const exerciseListEl = document.getElementById('exerciseList');
const searchInput = document.getElementById('exerciseSearch');
const amountSection = document.getElementById('amountSection');
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

// Delegated listener with a manual ancestor walk (no Element.closest
// dependency), so it survives every re-render and works everywhere.
exerciseListEl.addEventListener('click', function (e) {
let node = e.target;
while (node && node !== exerciseListEl) {
    if (node.classList && node.classList.contains('exercise-row')) break;
    node = node.parentNode;
}
if (!node || node === exerciseListEl) return;
const key = node.getAttribute('data-key');
const ex = EXERCISE_LIST.filter(function (x) { return x.key === key; })[0];
if (ex) selectExercise(ex);
});

// Everything below the exercise list — label, preset chips, custom
// input — is rebuilt from scratch each time, inside amountSection.
// Nothing here depends on state left over from a previous selection.
function renderAmountPicker(ex) {
amountSection.innerHTML = '';

const label = document.createElement('label');
label.className = 'field-label';
label.textContent = (ex.type === 'reps') ? 'How many reps?' : 'How many seconds?';
amountSection.appendChild(label);

const chipGrid = document.createElement('div');
chipGrid.className = 'chip-grid';
amountSection.appendChild(chipGrid);

const customInput = document.createElement('input');
customInput.type = 'number';
customInput.setAttribute('inputmode', 'decimal');
customInput.setAttribute('min', '0');
customInput.setAttribute('step', 'any');
customInput.className = 'custom-amount';
customInput.placeholder = 'Enter amount';
customInput.style.display = 'none';
amountSection.appendChild(customInput);
customAmountEl = customInput;

function clearChipSelection() {
    const allChips = chipGrid.querySelectorAll('.chip');
    for (let i = 0; i < allChips.length; i++) allChips[i].classList.remove('selected');
}

const presets = (ex.type === 'reps') ? [5, 10, 15, 20, 30] : [5, 10, 15, 30, 60];
presets.forEach(function (n) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = String(n);
    chip.addEventListener('click', function () {
    customInput.style.display = 'none';
    customInput.value = '';
    clearChipSelection();
    chip.classList.add('selected');
    selectedAmount = n;
    updateReward();
    });
    chipGrid.appendChild(chip);
});

const moreChip = document.createElement('button');
moreChip.type = 'button';
moreChip.className = 'chip';
moreChip.textContent = 'More';
moreChip.addEventListener('click', function () {
    customInput.style.display = 'block';
    clearChipSelection();
    moreChip.classList.add('selected');
    try { customInput.focus(); } catch (err) { /* ignore */ }
    const v = parseFloat(customInput.value);
    selectedAmount = (isFinite(v) && v > 0) ? v : null;
    updateReward();
});
chipGrid.appendChild(moreChip);

customInput.addEventListener('input', function () {
    const v = parseFloat(customInput.value);
    selectedAmount = (isFinite(v) && v > 0) ? v : null;
    updateReward();
});
}

function selectExercise(ex) {
selectedExercise = ex;
selectedAmount = null;
hide(rewardPreview);
addSetBtn.disabled = true;

renderExerciseList();

show(amountSection, 'block');
renderAmountPicker(ex);
}

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

log.forEach(function (entry, index) {
    const row = document.createElement('div');
    row.className = 'log-item';

    const mainRow = document.createElement('div');
    mainRow.className = 'log-item-main';

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

    mainRow.appendChild(left);
    mainRow.appendChild(starsDiv);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'log-delete-btn';
    deleteBtn.textContent = 'Delete';
    hide(deleteBtn);

    // Tapping a row reveals its delete button; collapses any other open one.
    mainRow.addEventListener('click', function () {
    const isShown = deleteBtn.style.display !== 'none';
    const openBtns = logListEl.querySelectorAll('.log-delete-btn');
    for (let i = 0; i < openBtns.length; i++) hide(openBtns[i]);
    if (!isShown) show(deleteBtn, 'inline-flex');
    });

    deleteBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (skipDeleteConfirm()) {
        deleteLogEntry(index);
    } else {
        openDeleteModal(index);
    }
    });

    row.appendChild(mainRow);
    row.appendChild(deleteBtn);
    logListEl.appendChild(row);
});
}

function deleteLogEntry(index) {
const log = getLog();
const removed = log.splice(index, 1)[0];
setLog(log);

// Take the stars this entry earned back off the total (never below 0).
const earned = removed ? (Number(removed.stars) || 0) : 0;
currentStars = Math.max(0, currentStars - earned);
safeSet('thousand-stars', String(currentStars));

renderLog();
refreshProgress(true);
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

refreshProgress(true);
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

/* ----------  Open Source  ---------- */
function openSource() { window.location = "https://github.com/Haaxen/1000-stars"}

/* ---------- Clear data ---------- */
const clearModal = document.getElementById('clearModal');

function openModal() { show(clearModal, 'flex'); }
function closeModal() { hide(clearModal); }

document.getElementById('clearDataBtn').addEventListener('click', openModal);
document.getElementById('cancelClearBtn').addEventListener('click', closeModal);
document.getElementById('confirmClearBtn').addEventListener('click', function () {
safeRemove('thousand-name');
safeRemove('thousand-stars');
safeRemove('thousand-log');
safeRemove('thousand-skip-delete-confirm');
closeModal();
window.location.href = 'index.html';
});
clearModal.addEventListener('click', function (e) {
if (e.target === clearModal) closeModal();
});

/* ---------- Delete a single log entry ---------- */
const deleteModal = document.getElementById('deleteModal');
const disablePopupCheckbox = document.getElementById('disablePopupCheckbox');
let pendingDeleteIndex = null;

function skipDeleteConfirm() { return safeGet('thousand-skip-delete-confirm') === 'true'; }

function openDeleteModal(index) {
pendingDeleteIndex = index;
disablePopupCheckbox.checked = skipDeleteConfirm();
show(deleteModal, 'flex');
}
function closeDeleteModal() {
hide(deleteModal);
pendingDeleteIndex = null;
}

document.getElementById('cancelDeleteBtn').addEventListener('click', closeDeleteModal);
document.getElementById('confirmDeleteBtn').addEventListener('click', function () {
safeSet('thousand-skip-delete-confirm', disablePopupCheckbox.checked ? 'true' : 'false');
if (pendingDeleteIndex !== null) deleteLogEntry(pendingDeleteIndex);
closeDeleteModal();
});
deleteModal.addEventListener('click', function (e) {
if (e.target === deleteModal) closeDeleteModal();
});

// Always start both modals closed, including when the browser restores
// the page from its back/forward cache.
closeModal();
closeDeleteModal();
window.addEventListener('pageshow', function () {
closeModal();
closeDeleteModal();
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
