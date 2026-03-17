// ============================================
// Promotional System - Footer Only
// מערכת פרסומת - רק הודעה בתחתית
// ============================================

const PROMO_CONFIG = {
    whatsappNumber: "972543336737", // אליהו - ללא 0 בהתחלה
    developerName: "אליהו סויסה",
    developerTitle: "פיתוח מערכות",
    popupMessage: "היי אליהו,\nראיתי את מערכת שיריון האולם ורציתי לשאול לגבי פיתוח מערכת לעסק שלי.\n\nהמספר שלי 0543336737"
};

// ============================================
// Initialize Promotional System
// ============================================
function initPromoSystem() {
    createStickyPromoFooter();
    adjustBodyPadding();
    handleWindowResize();
}

// ============================================
// Adjust Body Padding for Footer
// ============================================
function adjustBodyPadding() {
    const body = document.body;
    body.style.paddingBottom = '70px';
}

// ============================================
// Handle Window Resize
// ============================================
function handleWindowResize() {
    window.addEventListener('resize', () => {
        adjustBodyPadding();
    });
}

// ============================================
// Sticky Footer Banner
// ============================================
function createStickyPromoFooter() {
    // בדיקה שה-footer לא קיים כבר
    if (document.querySelector('.promo-sticky-footer')) {
        return;
    }

    const footer = document.createElement('div');
    footer.className = 'promo-sticky-footer';
    footer.innerHTML = `
        <div class="promo-footer-content">
            <div class="promo-footer-text">
                <span class="promo-footer-message">
                    אליהו סויסה פיתוח מערכות ואתרים לעסקים -
                    <strong onclick="openPromoWhatsAppFooter()" style="cursor:pointer; text-decoration:underline; color:inherit;">
                        כאן
                    </strong>
                </span>
            </div>
            <button class="promo-footer-close" onclick="closePromoFooter()" aria-label="סגור">✕</button>
        </div>
    `;

    document.body.appendChild(footer);
}

function openPromoWhatsAppFooter() {
    const message = encodeURIComponent(PROMO_CONFIG.popupMessage);
    const whatsappURL = `https://wa.me/${PROMO_CONFIG.whatsappNumber}?text=${message}`;
    window.open(whatsappURL, '_blank');
}

function closePromoFooter() {
    const footer = document.querySelector('.promo-sticky-footer');
    if (footer) {
        footer.style.opacity = '0';
        footer.style.transform = 'translateY(100%)';
        setTimeout(() => {
            footer.style.display = 'none';
            document.body.style.paddingBottom = '0';
        }, 300);
    }
}

// ============================================
// Initialize on DOM Ready
// ============================================
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        initPromoSystem();
    });
} else {
    initPromoSystem();
}