const root = document.documentElement;

function safeGet(key) {
    try { return localStorage.getItem(key); } 

    catch (e) {
        return null;
    }
}

function safeSet(key, val) {
    try {
        localStorage.setItem(key, val);
        return true;
    } catch (e) {
        return false;
    }
}

function safeRemove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
}

const query = new URLSearchParams(window.location.search);
const returningForName = query.has('name-required');
const clearingData = query.has('clear-data');
const changingName = query.has('change-name');

if (clearingData) {
    safeRemove('thousand-name');
    safeRemove('thousand-stars');
    safeRemove('thousand-log');
    safeRemove('thousand-skip-delete-confirm');
} else if (changingName) {
    safeRemove('thousand-name');
}

// Theme
const savedTheme = safeGet('thousand-theme');

if (savedTheme) root.setAttribute('data-theme', savedTheme);
const themeLabel = document.getElementById('themeLabel');
themeLabel.textContent = root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
document.getElementById('themeToggle').addEventListener('click', () => {

    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    themeLabel.textContent = next;
    safeSet('thousand-theme', next); 
});

// Show current progress in the nav pill, even before starting
const starCount = parseInt(safeGet('thousand-stars') ?? '0', 10) || 0;
document.getElementById('starCount').textContent = starCount.toLocaleString();

// If a name is already saved, skip straight to the app
const savedName = safeGet('thousand-name');
function openApp(name) {
    const appUrl = new URL('./app.html', window.location.href);
    // file:// storage is inconsistent between browsers and local HTML files.
    if (window.location.protocol === 'file:' && name) appUrl.searchParams.set('name', name);
    window.location.assign(appUrl.href);
}
if (savedName && !returningForName && !clearingData && !changingName) {
    openApp(savedName);
}

const startError = document.getElementById('startError');
if (returningForName) startError.hidden = false;

// Enable Start only once something is typed
const input = document.getElementById('nameInput');
const startBtn = document.getElementById('startBtn');

input.addEventListener('input', () => {
    startBtn.disabled = input.value.trim().length === 0;
});

document.getElementById('nameForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = input.value.trim();
    if (!name) return;
    const saved = safeSet('thousand-name', name) && safeGet('thousand-name') === name;
    if (!saved && window.location.protocol !== 'file:') {
        startError.hidden = false;
        startError.textContent = 'Your name could not be saved in this browser. Enable site storage and try again.';
        return;
    }
    openApp(name);
});
