/**
 * ui.js — Shared UI primitives
 * Toast notifications, theme control, dark-mode toggle, tab switching.
 * No game logic lives here.
 */

// ── Toast ─────────────────────────────────────────────────────────────────────

let _toastTimer = null;

export function showToast(message) {
  let el = document.getElementById('app-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'app-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.getElementById('app').appendChild(el);
  }
  el.textContent = message;
  el.classList.add('visible');

  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('visible'), 2500);
}

// ── Theme ─────────────────────────────────────────────────────────────────────

export function applyTheme(themeKey) {
  document.body.dataset.boardTheme = themeKey;
}

export function initThemeControls() {
  const sel = document.getElementById('board-theme-select');
  if (sel) {
    sel.addEventListener('change', (e) => {
      applyTheme(e.target.value);
      showToast(`Theme: ${e.target.options[e.target.selectedIndex].text}`);
    });
  }

  const toggle = document.getElementById('dark-mode-toggle');
  if (toggle) {
    toggle.addEventListener('change', (e) => {
      document.body.classList.toggle('light-mode', !e.target.checked);
      showToast(e.target.checked ? 'Dark mode on' : 'Light mode on');
    });
  }

  // default theme
  applyTheme('neon-cyber');
}

// ── Tabs (generic) ────────────────────────────────────────────────────────────

export function initTabs(containerSelector) {
  const tabs = document.querySelectorAll(`${containerSelector} .tab`);
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Show matching content panel if data-tab-target attribute is set
      const target = tab.dataset.tabTarget;
      if (target) {
        document.querySelectorAll('[data-tab-panel]').forEach(p => {
          p.classList.toggle('hidden', p.dataset.tabPanel !== target);
        });
      }
    });
  });
}

// ── Particles (splash) ───────────────────────────────────────────────────────

export function spawnParticles(containerId, count = 30) {
  const container = document.getElementById(containerId);
  if (!container) return;
  for (let i = 0; i < count; i += 1) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.setProperty('--x', `${Math.random() * 100}vw`);
    p.style.setProperty('--y', `${Math.random() * 100}vh`);
    p.style.setProperty('--size', `${Math.random() * 3 + 1}px`);
    p.style.setProperty('--opacity', `${Math.random() * 0.5 + 0.2}`);
    container.appendChild(p);
  }
}
