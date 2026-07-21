/* ============================================================
   siteManager.js — live admin panel for J-ANOS GRAPHIX
   ------------------------------------------------------------
   Press Ctrl+Shift+S to toggle the panel.
   Edits are saved to localStorage and applied in real-time.
   ============================================================ */

const STORAGE_KEY = 'janos-site-config';

/* ---- default site config ------------------------------------ */
const DEFAULTS = {
  brandName: 'J-ANOS//GRAPHIX',
  tagline: 'WE BUILD WORLDS FROM LIGHT AND GEOMETRY',
  crystal1Title: 'BRANDING PORTFOLIO',
  crystal1Subtitle: 'VISUAL IDENTITY & BRAND SYSTEMS',
  crystal1Link: 'https://ayensajurry11.wixstudio.com/jurry11',
  crystal2Title: '3D VISUALIZATION',
  crystal2Subtitle: 'ARCHITECTURAL & PRODUCT RENDERING',
  crystal2Link: 'https://ayensajurry11-lgtm.github.io/J-Anos/',
  facebookUrl: 'https://web.facebook.com/profile.php?id=61568439451882&sk=about',
  linkedinUrl: 'https://www.linkedin.com/in/jurry-anos-ba1103421',
  emailUrl: 'ayensajurry11@gmail.com',
  creditText: 'INSPIRED BY IGLOO.INC',
  creditUrl: 'https://igloo.inc',
};

/* ---- load saved config -------------------------------------- */
function loadConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

/* ---- save config -------------------------------------------- */
function saveConfig(cfg) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch { /* quota exceeded — ignore */ }
}

/* ---- apply config to DOM ------------------------------------ */
function applyConfig(cfg) {
  // Brand name
  const brandEl = document.querySelector('.corner__brand');
  if (brandEl) brandEl.textContent = cfg.brandName;

  // Tagline
  const taglineEl = document.querySelector('.corner__tagline');
  if (taglineEl) taglineEl.textContent = cfg.tagline;

  // Crystal labels (update hrefs + text)
  const crystalLinks = document.querySelectorAll('.crystal-label__link');
  crystalLinks.forEach((link, i) => {
    const titleEl = link.querySelector('.crystal-label__title');
    const subEl = link.querySelector('.crystal-label__sub');
    if (i === 0) {
      link.href = cfg.crystal1Link;
      if (titleEl) titleEl.dataset.fullText = cfg.crystal1Title;
      if (subEl) subEl.textContent = cfg.crystal1Subtitle;
    } else if (i === 1) {
      link.href = cfg.crystal2Link;
      if (titleEl) titleEl.dataset.fullText = cfg.crystal2Title;
      if (subEl) subEl.textContent = cfg.crystal2Subtitle;
    }
  });

  // Footer social links
  const footerLinks = document.querySelectorAll('.footer__links a');
  if (footerLinks[0]) footerLinks[0].href = cfg.facebookUrl;
  if (footerLinks[1]) footerLinks[1].href = cfg.linkedinUrl;
  if (footerLinks[2]) {
    footerLinks[2].href = `mailto:${cfg.emailUrl}`;
  }

  // Credit
  const creditEl = document.querySelector('.footer__credit');
  if (creditEl) {
    creditEl.innerHTML = `${cfg.creditText} <a href="${cfg.creditUrl}" target="_blank" rel="noopener">${cfg.creditUrl.replace('https://', '')}</a>`;
  }
}

/* ---- build panel DOM ---------------------------------------- */
function buildPanel(cfg, onUpdate) {
  const panel = document.createElement('div');
  panel.id = 'site-manager';
  panel.innerHTML = `
    <div class="sm__header">
      <span class="sm__title">SITE MANAGER</span>
      <button class="sm__close" aria-label="Close">&times;</button>
    </div>
    <div class="sm__body">
      <div class="sm__group">
        <label class="sm__label">BRAND NAME</label>
        <input class="sm__input" data-key="brandName" value="${esc(cfg.brandName)}" />
      </div>
      <div class="sm__group">
        <label class="sm__label">TAGLINE</label>
        <input class="sm__input" data-key="tagline" value="${esc(cfg.tagline)}" />
      </div>

      <div class="sm__divider"></div>
      <div class="sm__section">CRYSTAL 1 — BRANDING</div>

      <div class="sm__group">
        <label class="sm__label">TITLE</label>
        <input class="sm__input" data-key="crystal1Title" value="${esc(cfg.crystal1Title)}" />
      </div>
      <div class="sm__group">
        <label class="sm__label">SUBTITLE</label>
        <input class="sm__input" data-key="crystal1Subtitle" value="${esc(cfg.crystal1Subtitle)}" />
      </div>
      <div class="sm__group">
        <label class="sm__label">LINK URL</label>
        <input class="sm__input" data-key="crystal1Link" value="${esc(cfg.crystal1Link)}" />
      </div>

      <div class="sm__divider"></div>
      <div class="sm__section">CRYSTAL 2 — 3D VIZ</div>

      <div class="sm__group">
        <label class="sm__label">TITLE</label>
        <input class="sm__input" data-key="crystal2Title" value="${esc(cfg.crystal2Title)}" />
      </div>
      <div class="sm__group">
        <label class="sm__label">SUBTITLE</label>
        <input class="sm__input" data-key="crystal2Subtitle" value="${esc(cfg.crystal2Subtitle)}" />
      </div>
      <div class="sm__group">
        <label class="sm__label">LINK URL</label>
        <input class="sm__input" data-key="crystal2Link" value="${esc(cfg.crystal2Link)}" />
      </div>

      <div class="sm__divider"></div>
      <div class="sm__section">SOCIAL LINKS</div>

      <div class="sm__group">
        <label class="sm__label">FACEBOOK URL</label>
        <input class="sm__input" data-key="facebookUrl" value="${esc(cfg.facebookUrl)}" />
      </div>
      <div class="sm__group">
        <label class="sm__label">LINKEDIN URL</label>
        <input class="sm__input" data-key="linkedinUrl" value="${esc(cfg.linkedinUrl)}" />
      </div>
      <div class="sm__group">
        <label class="sm__label">EMAIL</label>
        <input class="sm__input" data-key="emailUrl" value="${esc(cfg.emailUrl)}" />
      </div>

      <div class="sm__divider"></div>
      <div class="sm__section">CREDIT</div>

      <div class="sm__group">
        <label class="sm__label">TEXT</label>
        <input class="sm__input" data-key="creditText" value="${esc(cfg.creditText)}" />
      </div>
      <div class="sm__group">
        <label class="sm__label">URL</label>
        <input class="sm__input" data-key="creditUrl" value="${esc(cfg.creditUrl)}" />
      </div>

      <div class="sm__divider"></div>
      <div class="sm__actions">
        <button class="sm__btn sm__btn--save">SAVE & APPLY</button>
        <button class="sm__btn sm__btn--reset">RESET DEFAULTS</button>
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  // Event listeners
  panel.querySelector('.sm__close').addEventListener('click', () => togglePanel(false));

  panel.querySelector('.sm__btn--save').addEventListener('click', () => {
    const inputs = panel.querySelectorAll('.sm__input');
    inputs.forEach((input) => {
      cfg[input.dataset.key] = input.value;
    });
    saveConfig(cfg);
    applyConfig(cfg);
    onUpdate(cfg);
  });

  panel.querySelector('.sm__btn--reset').addEventListener('click', () => {
    Object.assign(cfg, loadConfig());
    const inputs = panel.querySelectorAll('.sm__input');
    inputs.forEach((input) => {
      input.value = cfg[input.dataset.key] || '';
    });
    localStorage.removeItem(STORAGE_KEY);
    applyConfig(cfg);
    onUpdate(cfg);
  });

  return panel;
}

/* ---- toggle panel ------------------------------------------- */
let panelEl = null;
let panelOpen = false;

function togglePanel(force) {
  if (!panelEl) return;
  panelOpen = force ?? !panelOpen;
  panelEl.classList.toggle('is-open', panelOpen);
}

/* ---- escape HTML for attributes ----------------------------- */
function esc(s) {
  return String(s).replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/* ---- PUBLIC API --------------------------------------------- */
export function createSiteManager() {
  const cfg = loadConfig();

  // Apply saved config on load
  applyConfig(cfg);

  // Build panel
  panelEl = buildPanel(cfg, () => {});

  // Keyboard shortcut: Ctrl+Shift+S
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      togglePanel();
    }
    // Escape closes
    if (e.key === 'Escape' && panelOpen) {
      togglePanel(false);
    }
  });

  return { cfg, applyConfig, togglePanel };
}
