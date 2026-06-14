// ============================================
// Promotional System — Enterprise Edition
// ============================================

'use strict';

const PROMO_CONFIG = Object.freeze({
  whatsappNumber: '972543336737',
  developerName:  'אליהו סויסה',
  developerTitle: 'פיתוח מערכות',
  popupMessage:   'היי אליהו,\nראיתי את מערכת שיריון האולם ורציתי לשאול לגבי פיתוח מערכת לעסק שלי.\n\nהמספר שלי 0543336737',
  storageKey:     'promo_footer_closed',   // sessionStorage key
  showDelayMs:    1500,                    // slight delay so page feels settled
});

// ──────────────────────────────────────────
// Init
// ──────────────────────────────────────────

function initPromoSystem() {
  // Don't show again if user already closed it this session
  if (sessionStorage.getItem(PROMO_CONFIG.storageKey)) return;

  setTimeout(() => {
    _createStickyPromoFooter();
    _adjustBodyPadding();
  }, PROMO_CONFIG.showDelayMs);

  window.addEventListener('resize', _debounceResize(_adjustBodyPadding, 150));
}

// ──────────────────────────────────────────
// Footer DOM
// ──────────────────────────────────────────

function _createStickyPromoFooter() {
  if (document.querySelector('.promo-sticky-footer')) return;

  const footer = document.createElement('div');
  footer.className   = 'promo-sticky-footer';
  footer.setAttribute('role', 'banner');
  footer.innerHTML = `
    <div class="promo-footer-content">
      <div class="promo-footer-text">
        <span class="promo-footer-message">
          ${PROMO_CONFIG.developerName} — ${PROMO_CONFIG.developerTitle} לעסקים &nbsp;
          <strong
            onclick="openPromoWhatsAppFooter()"
            style="cursor:pointer;text-decoration:underline;color:var(--gold)"
            role="button"
            tabindex="0"
            onkeydown="if(event.key==='Enter')openPromoWhatsAppFooter()"
          >לחצו כאן</strong>
        </span>
      </div>
      <button
        class="promo-footer-close"
        onclick="closePromoFooter()"
        aria-label="סגור פרסומת"
      >✕</button>
    </div>`;

  document.body.appendChild(footer);
}

function _adjustBodyPadding() {
  const footer = document.querySelector('.promo-sticky-footer');
  document.body.style.paddingBottom = footer ? `${footer.offsetHeight + 8}px` : '0';
}

// ──────────────────────────────────────────
// Public actions (called from DOM)
// ──────────────────────────────────────────

function openPromoWhatsAppFooter() {
  const url = `https://wa.me/${PROMO_CONFIG.whatsappNumber}?text=${encodeURIComponent(PROMO_CONFIG.popupMessage)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function closePromoFooter() {
  const footer = document.querySelector('.promo-sticky-footer');
  if (!footer) return;

  // Remember choice for this session
  try { sessionStorage.setItem(PROMO_CONFIG.storageKey, '1'); } catch { /* private mode */ }

  footer.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
  footer.style.opacity    = '0';
  footer.style.transform  = 'translateY(100%)';

  setTimeout(() => {
    footer.remove();
    document.body.style.paddingBottom = '0';
  }, 320);
}

// ──────────────────────────────────────────
// Utility
// ──────────────────────────────────────────

function _debounceResize(fn, wait) {
  let t;
  return () => { clearTimeout(t); t = setTimeout(fn, wait); };
}

// ──────────────────────────────────────────
// Bootstrap
// ──────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPromoSystem);
} else {
  initPromoSystem();
}