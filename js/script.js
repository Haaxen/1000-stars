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
    } catch (e) {
        /* ignore */
    }
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
if (savedName) {
    window.location.href = 'app.html';
}

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
    safeSet('thousand-name', name);
    window.location.href = 'app.html';
});
