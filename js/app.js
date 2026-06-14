// ============================================
// מערכת שריון אולם מרכז שפירא
// Enterprise Edition
// ============================================

'use strict';

// ============================================
// Constants — single source of truth
// ============================================
const CONFIG = Object.freeze({
  // Web3Forms — sends the committee-notification email through Web3Forms' own
  // infrastructure (no personal Gmail/OAuth that expires weekly like EmailJS did).
  // This access key is public by design (safe to ship in client code). Get yours
  // at https://web3forms.com — it is tied to the committee's receiving email.
  WEB3FORMS_ACCESS_KEY: 'c2e5c22e-7f69-481d-8cf3-f56646549d53',
  TOTAL_STEPS:         8,
  MAX_FILE_SIZE_MB:    10,
  COMPRESS_TARGET_KB:  40,
  COMPRESS_MAX_WIDTH:  600,
  ORDER_PREFIX:        'MS',
  WHATSAPP_MANAGER:    '972523164187',
  DRAFT_STORAGE_KEY:   'ms-hall-booking-draft-v1',
  DRAFT_VERSION:       1,
  DRAFT_MAX_AGE_MS:    12 * 60 * 60 * 1000,
  ALLOWED_FILE_TYPES:  ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
});

const RESIDENT_LABELS = Object.freeze({
  local:     'תושב הישוב',
  external:  'תושב חוץ',
  community: 'אירוע קהילתי',
});
const MEMORIAL_EVENT_TYPE = 'אזכרה';
const MEMORIAL_EVENT_PRICE = 500;

const SLOT_META = Object.freeze({
  morning: { text: 'אירוע בוקר',   hours: '06:00 - 12:00' },
  evening: { text: 'אירוע ערב',    hours: '13:00 - 23:00' },
  weekend: { text: 'אירוע סופ"ש', hours: 'יום שישי 10:00 - מוצאי שבת' },
});


// ============================================
// Logger — structured, leveled console output
// ============================================
const Logger = Object.freeze({
  _fmt: (level, msg, data) => {
    const tag = { info: '📘', warn: '⚠️', error: '❌', success: '✅', perf: '⚡' }[level] || '📌';
    if (data !== undefined) {
      console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](`${tag} [${level.toUpperCase()}] ${msg}`, data);
    } else {
      console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](`${tag} [${level.toUpperCase()}] ${msg}`);
    }
  },
  info:    (msg, data) => Logger._fmt('info',    msg, data),
  warn:    (msg, data) => Logger._fmt('warn',    msg, data),
  error:   (msg, data) => Logger._fmt('error',   msg, data),
  success: (msg, data) => Logger._fmt('success', msg, data),
  perf:    (msg, data) => Logger._fmt('perf',    msg, data),
});


// ============================================
// Toast Notification System
// replaces all alert() / confirm() calls
// ============================================
const Toast = (() => {
  let _container = null;

  /** Lazily create or retrieve the container. */
  function _getContainer() {
    if (_container) return _container;
    _container = document.createElement('div');
    _container.id = 'toast-container';
    _container.setAttribute('role', 'region');
    _container.setAttribute('aria-live', 'polite');
    _container.setAttribute('aria-label', 'הודעות מערכת');
    Object.assign(_container.style, {
      position: 'fixed', top: '90px', left: '50%',
      transform: 'translateX(-50%)',
      zIndex: '9999', display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: '10px', width: 'min(440px, 90vw)',
      pointerEvents: 'none',
    });
    document.body.appendChild(_container);
    return _container;
  }

  /**
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'} type
   * @param {number} [duration=4000]  ms before auto-dismiss (0 = persistent)
   */
  function show(message, type = 'info', duration = 4000) {
    const container = _getContainer();

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const colors = {
      success: { bg: 'rgba(78,200,122,0.12)', border: 'rgba(78,200,122,0.4)',  text: '#4ec87a' },
      error:   { bg: 'rgba(224,92,92,0.12)',  border: 'rgba(224,92,92,0.45)',  text: '#e05c5c' },
      warning: { bg: 'rgba(201,165,76,0.12)', border: 'rgba(201,165,76,0.4)',  text: '#c9a84c' },
      info:    { bg: 'rgba(62,184,194,0.12)', border: 'rgba(62,184,194,0.4)',  text: '#3eb8c2' },
    };
    const c = colors[type] || colors.info;

    const toast = document.createElement('div');
    toast.setAttribute('role', 'alert');
    Object.assign(toast.style, {
      pointerEvents: 'auto',
      background:    c.bg,
      border:        `1px solid ${c.border}`,
      borderRadius:  '12px',
      padding:       '14px 18px',
      display:       'flex',
      alignItems:    'flex-start',
      gap:           '10px',
      backdropFilter:'blur(20px)',
      width:         '100%',
      boxShadow:     '0 8px 32px rgba(0,0,0,0.4)',
      animation:     'toastIn 0.3s cubic-bezier(0.4,0,0.2,1)',
      direction:     'rtl',
    });
    toast.innerHTML = `
      <span style="font-size:18px;flex-shrink:0;margin-top:1px">${icons[type]}</span>
      <span style="flex:1;font-family:Heebo,sans-serif;font-size:14px;line-height:1.6;color:${c.text};font-weight:500">${message}</span>
      <button onclick="this.parentElement.remove()" style="
        background:none;border:none;color:${c.text};cursor:pointer;
        font-size:16px;opacity:.6;padding:0;flex-shrink:0;line-height:1;margin-top:1px
      " aria-label="סגור">✕</button>
    `;

    // Inject keyframes once
    if (!document.getElementById('toast-styles')) {
      const s = document.createElement('style');
      s.id = 'toast-styles';
      s.textContent = `
        @keyframes toastIn  { from{opacity:0;transform:translateY(-12px)} to{opacity:1;transform:none} }
        @keyframes toastOut { from{opacity:1;transform:none} to{opacity:0;transform:translateY(-8px)} }
      `;
      document.head.appendChild(s);
    }

    container.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => {
        toast.style.animation = 'toastOut 0.25s ease forwards';
        setTimeout(() => toast.remove(), 260);
      }, duration);
    }

    return toast;
  }

  return Object.freeze({
    success: (msg, ms)  => show(msg, 'success', ms),
    error:   (msg, ms)  => show(msg, 'error',   ms ?? 6000),
    warning: (msg, ms)  => show(msg, 'warning', ms),
    info:    (msg, ms)  => show(msg, 'info',    ms),
  });
})();


// ============================================
// Utility helpers
// ============================================

/**
 * Returns a debounced version of fn.
 * @param {Function} fn
 * @param {number} wait  ms
 */
function debounce(fn, wait) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

/**
 * Retry an async operation with exponential back-off.
 * @param {Function} fn          async function to call
 * @param {number}   retries     max attempts (default 3)
 * @param {number}   baseDelay   initial delay ms (doubles each retry)
 */
async function withRetry(fn, retries = 3, baseDelay = 800) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        Logger.warn(`Retry ${attempt}/${retries} after ${delay}ms — ${err.message}`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Cryptographically-strong random suffix (10 hex chars = 40 bits).
 * Falls back gracefully so it can never throw and block a submission.
 * @returns {string}
 */
function _orderSuffix() {
  try {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
  } catch (_) { /* randomUUID unavailable — try getRandomValues */ }
  try {
    return Array.from(crypto.getRandomValues(new Uint8Array(5)))
      .map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  } catch (_) { /* no Web Crypto — last-resort, still better than the old suffix */ }
  return (Date.now().toString(36) + Math.random().toString(36).slice(2)).slice(-10).toUpperCase();
}

/**
 * Generate a unique order number, e.g. "MS-2026-3B12F1A4".
 *
 * The old suffix was Date.now().toString(36).slice(-4) — derived purely from the
 * clock, it repeated roughly every 28 minutes. Two bookings sharing an order
 * number, combined with the slot-lock idempotency check in submitOrder
 * (slotSnap.orderNumber === orderNumber → "our own lock"), could make a second
 * user's booking be silently skipped while they still saw "success". A strong
 * 32-bit random suffix makes such a cross-user collision effectively impossible.
 */
function generateOrderNumber() {
  const year = new Date().getFullYear();
  return `${CONFIG.ORDER_PREFIX}-${year}-${_orderSuffix()}`;
}

/**
 * Format a price for display.
 * @param {number} amount
 */
function formatPrice(amount) {
  return amount === 0 ? 'ללא עלות' : `₪${amount.toLocaleString('he-IL')}`;
}

/**
 * Normalize event type labels to canonical values expected by backend rules.
 * Keeps backward compatibility with old typo "אירוע קהלתי".
 * @param {string} eventType
 * @returns {string}
 */
function normalizeEventType(eventType) {
  const v = (eventType || '').trim();
  if (v === 'אירוע קהלתי') return 'אירוע קהילתי';
  // התפריט מציג "אירוסין/נישואין", אך חוקי Firestore והאדמין מצפים ל"אירוס/שידוך"
  if (v === 'אירוסין/נישואין') return 'אירוס/שידוך';
  return v;
}

/**
 * Normalize a phone number to the digits-only form the Firestore rules accept
 * (^0\d{8,9}$). The user may type dashes/spaces (the placeholder even shows
 * "050-0000000"); without stripping them the final write is rejected with
 * permission-denied after the whole wizard is filled out. Single source of
 * truth — used by validation AND by the value that gets persisted.
 * @param {string} phone
 * @returns {string}
 */
function normalizePhone(phone) {
  return (phone || '').replace(/[\s\-]/g, '').trim();
}

/**
 * True when the selected event type is a community event.
 * @returns {boolean}
 */
function isCommunityEventSelected() {
  const eventType = normalizeEventType(document.getElementById('eventType')?.value ?? '');
  return eventType === 'אירוע קהילתי';
}

function isMemorialEventSelected() {
  const eventType = normalizeEventType(document.getElementById('eventType')?.value ?? '');
  return eventType === MEMORIAL_EVENT_TYPE;
}

function syncMemorialPricingOptions() {
  const memorialSelected = isMemorialEventSelected();
  document.querySelectorAll('input[name="pricing"]').forEach((input) => {
    const basePrice = parseInt(input.dataset.basePrice || input.dataset.price || '0', 10) || 0;
    input.dataset.basePrice = String(basePrice);
    input.dataset.price = String(memorialSelected ? MEMORIAL_EVENT_PRICE : basePrice);

    const amountEl = input.closest('.pricing-card')?.querySelector('.pricing-amount');
    if (amountEl) {
      const shownAmount = memorialSelected ? MEMORIAL_EVENT_PRICE : basePrice;
      amountEl.textContent = `₪${shownAmount.toLocaleString('he-IL')}`;
    }
  });
}

function syncStep4PricingUI() {
  syncMemorialPricingOptions();
  const selectedCard = document.querySelector('.resident-card.selected');
  if (!selectedCard) {
    ['localPricing', 'externalPricing', 'addonSection', 'communityPricingNote'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    return;
  }
  const residentType = selectedCard.dataset.residentType || AppState.getOrder().residentType || orderData.residentType;
  if (!residentType) return;
  selectResident(residentType, selectedCard);
}


// ============================================
// Inline Field Validation
// ============================================
const FieldValidator = Object.freeze({

  /**
   * Mark a field as invalid and show an inline error message.
   * @param {string} fieldId
   * @param {string} message
   */
  setError(fieldId, message) {
    const el = document.getElementById(fieldId);
    if (!el) return;

    el.style.borderColor = 'rgba(224,92,92,0.7)';
    el.style.boxShadow   = '0 0 0 3px rgba(224,92,92,0.12)';

    let hint = el.parentElement.querySelector('.field-error');
    if (!hint) {
      hint = document.createElement('span');
      hint.className = 'field-error';
      Object.assign(hint.style, {
        display: 'block', fontSize: '12px', color: '#e05c5c',
        marginTop: '5px', fontFamily: 'Heebo,sans-serif', fontWeight: '500',
      });
      el.parentElement.appendChild(hint);
    }
    hint.textContent = message;
    el.focus();
  },

  /** Remove the error state from a field. */
  clearError(fieldId) {
    const el = document.getElementById(fieldId);
    if (!el) return;
    el.style.borderColor = '';
    el.style.boxShadow   = '';
    const hint = el.parentElement.querySelector('.field-error');
    if (hint) hint.remove();
  },

  /** Clear all field errors in the document. */
  clearAll() {
    document.querySelectorAll('.field-error').forEach(e => e.remove());
    document.querySelectorAll('[data-validated]').forEach(el => {
      el.style.borderColor = '';
      el.style.boxShadow   = '';
    });
  },
});


// ============================================
// Application State — single source of truth
// ============================================
const AppState = (() => {
  const _state = {
    currentStep:         1,
    isSubmitting:        false,    // concurrency guard
    bookingSaved:        false,    // true once the booking is committed to Firestore
    uploadedFile:        null,
    uploadedFileBase64:  null,
    compressedFileBase64:null,
    order: {
      firstName:    '',
      lastName:     '',
      phone:        '',
      eventType:    '',
      notes:        '',
      residentType: '',
      residentText: '',
      price:        0,
      projector:    false,
      calendarInfo: null,
    },
  };

  return Object.freeze({
    get(key)        { return key ? _state[key] : { ..._state }; },
    getOrder()      { return { ..._state.order }; },
    set(key, value) { _state[key] = value; },
    setOrder(patch) { Object.assign(_state.order, patch); },
    reset() {
      _state.isSubmitting         = false;
      _state.bookingSaved         = false;
      _state.uploadedFile         = null;
      _state.uploadedFileBase64   = null;
      _state.compressedFileBase64 = null;
      _state.order = {
        firstName:'',lastName:'',phone:'',eventType:'',notes:'',
        residentType:'',residentText:'',price:0,projector:false,calendarInfo:null,
      };
    },
  });
})();

// Legacy globals — kept for backward-compat with existing HTML onclick handlers
// They are proxies into AppState.
let currentStep    = 1;
let calendarManager;
let uploadedFile   = null;
let uploadedFileBase64   = null;
let compressedFileBase64 = null;
let orderData      = {};
let autoSubmitAfterDownloadStarted = false;


// ============================================
// Draft Recovery
// ============================================
function _storageGet(key) {
  try {
    const v = sessionStorage.getItem(key);
    if (v) return v;
  } catch (_) { /* private mode */ }
  try { return localStorage.getItem(key); }
  catch (_) { return null; }
}

function _storageSet(key, value) {
  try { sessionStorage.setItem(key, value); }
  catch (_) { /* private mode / quota */ }
  try { localStorage.setItem(key, value); }
  catch (_) { /* private mode / quota */ }
}

function _storageRemove(key) {
  try { sessionStorage.removeItem(key); }
  catch (_) { /* private mode */ }
  try { localStorage.removeItem(key); }
  catch (_) { /* private mode */ }
}

function _serializeCalendarInfo(calInfo) {
  if (!calInfo) return null;
  return {
    dateKey:     calInfo.dateKey,
    slot:        calInfo.slot,
    slotText:    calInfo.slotText,
    hoursText:   calInfo.hoursText,
    gregDate:    calInfo.gregDate,
    hebrewDate:  calInfo.hebrewDate,
    dayName:     calInfo.dayName,
    displayText: calInfo.displayText,
  };
}

function _dateFromKey(dateKey) {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function _calendarInfoFromDraft(saved) {
  if (!saved?.dateKey || !isValidDraftSlot(saved.slot)) return null;

  const date = _dateFromKey(saved.dateKey);
  if (!date) return null;

  const meta    = SLOT_META[saved.slot] ?? { text: saved.slot, hours: '' };
  const greg    = saved.gregDate   || `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  const heb     = saved.hebrewDate || HebrewDateConverter.getHebrewDate(date);
  const dayName = saved.dayName    || HebrewDateConverter.getHebrewDayOfWeek(date.getDay());

  return {
    date,
    dateKey:     saved.dateKey,
    slot:        saved.slot,
    slotText:    saved.slotText  || meta.text,
    hoursText:   saved.hoursText || meta.hours,
    gregDate:    greg,
    hebrewDate:  heb,
    dayName,
    displayText: saved.displayText || `יום ${dayName} | ${greg} | ${heb} | ${meta.text} (${meta.hours})`,
  };
}

function isValidDraftSlot(slot) {
  return ['morning', 'evening', 'weekend'].includes(slot);
}

function _currentCalendarInfo() {
  return calendarManager?.getSelectedInfo?.()
    ?? AppState.getOrder().calendarInfo
    ?? orderData.calendarInfo
    ?? null;
}

function _hasMeaningfulDraft(draft) {
  const f = draft?.fields ?? {};
  return (draft?.currentStep ?? 1) > 1 ||
    !!draft?.takanonApproval ||
    !!draft?.residentType ||
    !!draft?.pricing ||
    !!draft?.calendarInfo ||
    !!draft?.receipt?.compressedFileBase64 ||
    ['firstName', 'lastName', 'phone', 'eventType', 'notes'].some(k => !!f[k]);
}

function collectDraftData() {
  const step = AppState.get('currentStep') || currentStep || 1;
  const receipt = compressedFileBase64 || AppState.get('compressedFileBase64')
    ? {
        compressedFileBase64: compressedFileBase64 || AppState.get('compressedFileBase64') || '',
        previewBase64:        uploadedFileBase64   || AppState.get('uploadedFileBase64')   || '',
        fileName:             uploadedFile?.name    || AppState.get('uploadedFile')?.name   || '',
      }
    : null;

  return {
    version:     CONFIG.DRAFT_VERSION,
    savedAt:     Date.now(),
    currentStep: step,
    fields: {
      firstName: document.getElementById('firstName')?.value ?? '',
      lastName:  document.getElementById('lastName')?.value  ?? '',
      phone:     document.getElementById('phone')?.value     ?? '',
      eventType: document.getElementById('eventType')?.value ?? '',
      notes:     document.getElementById('notes')?.value     ?? '',
    },
    takanonApproval: !!document.getElementById('takanonApproval')?.checked,
    residentType:    document.querySelector('.resident-card.selected')?.dataset.residentType
                  || AppState.getOrder().residentType
                  || orderData.residentType
                  || '',
    pricing:         document.querySelector('input[name="pricing"]:checked')?.value || '',
    projector:       !!document.getElementById('projectorAddon')?.checked,
    calendarInfo:    _serializeCalendarInfo(_currentCalendarInfo()),
    receipt,
  };
}

function saveDraft() {
  if ((AppState.get('currentStep') || currentStep) >= CONFIG.TOTAL_STEPS || AppState.get('bookingSaved')) {
    clearDraft();
    return;
  }

  const draft = collectDraftData();
  if (!_hasMeaningfulDraft(draft)) {
    clearDraft();
    return;
  }

  _storageSet(CONFIG.DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

const saveDraftDebounced = debounce(saveDraft, 250);

function clearDraft() {
  _storageRemove(CONFIG.DRAFT_STORAGE_KEY);
}

function getSavedDraft() {
  const raw = _storageGet(CONFIG.DRAFT_STORAGE_KEY);
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw);
    if (draft?.savedAt && Date.now() - draft.savedAt > CONFIG.DRAFT_MAX_AGE_MS) {
      clearDraft();
      return null;
    }
    return draft?.version === CONFIG.DRAFT_VERSION && _hasMeaningfulDraft(draft) ? draft : null;
  } catch (_) {
    clearDraft();
    return null;
  }
}

function _setFieldValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? '';
}

function _restoreSelectedDateDisplay(calInfo) {
  const display = document.getElementById('selectedDateDisplay');
  if (!display || !calInfo) return;
  display.innerHTML = `
    ✅ נבחר: <strong>יום ${calInfo.dayName} | ${calInfo.gregDate} | ${calInfo.hebrewDate}</strong><br>
    📋 ${calInfo.slotText} | ⏰ ${calInfo.hoursText}
  `;
  display.style.display = 'block';
}

function _restoreCalendarState(calInfo) {
  if (!calInfo) return;
  if (!calendarManager) calendarManager = new CalendarManager();
  calendarManager.selectedDate = calInfo.date;
  calendarManager.selectedSlot = calInfo.slot;
  calendarManager.currentMonth = calInfo.date.getMonth();
  calendarManager.currentYear  = calInfo.date.getFullYear();
  _restoreSelectedDateDisplay(calInfo);
  calendarManager.loadBookedSlots();
}

function restoreDraft(draft) {
  const f = draft.fields ?? {};
  _setFieldValue('firstName', f.firstName);
  _setFieldValue('lastName',  f.lastName);
  _setFieldValue('phone',     f.phone);
  _setFieldValue('eventType', f.eventType);
  _setFieldValue('notes',     f.notes);

  const takanon = document.getElementById('takanonApproval');
  if (takanon) takanon.checked = !!draft.takanonApproval;

  syncMemorialPricingOptions();

  if (draft.residentType) {
    const card = document.querySelector(`.resident-card[data-resident-type="${draft.residentType}"]`);
    selectResident(draft.residentType, card);
  }

  const pricing = draft.pricing
    ? document.querySelector(`input[name="pricing"][value="${draft.pricing}"]`)
    : null;
  if (pricing) pricing.checked = true;

  const projector = document.getElementById('projectorAddon');
  if (projector) projector.checked = !!draft.projector;

  const calInfo = _calendarInfoFromDraft(draft.calendarInfo);
  const normalizedEventType = normalizeEventType(f.eventType);
  const residentText = RESIDENT_LABELS[draft.residentType] ?? draft.residentType ?? '';

  AppState.setOrder({
    firstName: f.firstName || '',
    lastName:  f.lastName  || '',
    phone:     normalizePhone(f.phone || ''),
    eventType: normalizedEventType,
    notes:     f.notes || '',
    residentType: draft.residentType || '',
    residentText,
    projector: !!draft.projector,
    calendarInfo: calInfo,
  });
  Object.assign(orderData, AppState.getOrder());

  if (draft.receipt?.compressedFileBase64) {
    compressedFileBase64 = draft.receipt.compressedFileBase64;
    uploadedFileBase64   = draft.receipt.previewBase64 || draft.receipt.compressedFileBase64;
    AppState.set('compressedFileBase64', compressedFileBase64);
    AppState.set('uploadedFileBase64', uploadedFileBase64);

    const previewImg = document.getElementById('receiptPreviewImg');
    if (previewImg) previewImg.src = uploadedFileBase64;
    const fileNameEl = document.getElementById('fileName');
    if (fileNameEl) fileNameEl.textContent = draft.receipt.fileName || 'אסמכתא שנשמרה בטיוטה';
    const preview = document.getElementById('uploadPreview');
    if (preview) preview.style.display = 'flex';
  }

  currentStep = Math.min(Math.max(parseInt(draft.currentStep, 10) || 2, 2), 6);
  AppState.set('currentStep', currentStep);
  showStep(currentStep);
  updateProgressBar();

  if (currentStep === 4) syncStep4PricingUI();
  if (currentStep === 5) _restoreCalendarState(calInfo);
  if (currentStep === 6) populateSummary();

  saveDraft();
  Toast.success('הטיוטה שוחזרה. אפשר להמשיך מאיפה שעצרתם.');
}

function _draftStepName(step) {
  return ({
    2: 'תקנון',
    3: 'פרטים אישיים',
    4: 'סוג תושב ותעריפים',
    5: 'בחירת תאריך',
    6: 'סיכום ותשלום',
    7: 'דף יום האירוע',
  })[step] || 'תהליך ההזמנה';
}

function _relativeDraftTime(savedAt) {
  if (!savedAt) return '';
  const mins = Math.max(0, Math.round((Date.now() - savedAt) / 60000));
  if (mins < 1) return 'נשמרה עכשיו';
  if (mins === 1) return 'נשמרה לפני דקה';
  if (mins < 60) return `נשמרה לפני ${mins} דקות`;
  const hours = Math.round(mins / 60);
  return hours === 1 ? 'נשמרה לפני כשעה' : `נשמרה לפני כ-${hours} שעות`;
}

function showDraftRecoveryPrompt(draft) {
  if (document.getElementById('draftRecoveryModal')) return;

  const modal = document.createElement('div');
  modal.id = 'draftRecoveryModal';
  modal.className = 'draft-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'draftRecoveryTitle');
  modal.innerHTML = `
    <div class="draft-modal-card">
      <div class="draft-modal-icon" aria-hidden="true">↻</div>
      <h2 id="draftRecoveryTitle">מצאנו הזמנה שלא הושלמה</h2>
      <p>נראה שהייתם באמצע תהליך שריון האולם. אפשר להמשיך מאיפה שעצרתם, או למחוק את הטיוטה ולהתחיל מחדש.</p>
      <div class="draft-modal-meta"></div>
      <div class="draft-modal-actions">
        <button type="button" class="btn draft-modal-secondary" id="draftClearBtn">התחל מחדש</button>
        <button type="button" class="btn btn-next draft-modal-primary" id="draftRestoreBtn">המשך מהטיוטה</button>
      </div>
    </div>
  `;

  const meta = modal.querySelector('.draft-modal-meta');
  if (meta) {
    meta.textContent = `${_draftStepName(draft.currentStep)} · ${_relativeDraftTime(draft.savedAt)}`;
  }

  modal.querySelector('#draftRestoreBtn')?.addEventListener('click', () => {
    modal.remove();
    restoreDraft(draft);
  });
  modal.querySelector('#draftClearBtn')?.addEventListener('click', () => {
    clearDraft();
    modal.remove();
    Toast.info('הטיוטה נמחקה. אפשר להתחיל הזמנה חדשה.');
  });

  document.body.appendChild(modal);
  setTimeout(() => modal.querySelector('#draftRestoreBtn')?.focus(), 0);
}

function maybeShowDraftRecoveryPrompt() {
  const draft = getSavedDraft();
  if (draft) showDraftRecoveryPrompt(draft);
}


// ============================================
// Committee notification email (Web3Forms)
// ============================================
/**
 * Send the new-booking notification to the committee via Web3Forms.
 * Throws on any non-success so the caller's WhatsApp fallback kicks in.
 * @param {Object} fields  flat key→value map; keys become the email's labels
 * @returns {Promise<Object>}  Web3Forms response JSON
 */
async function sendCommitteeEmail(fields) {
  const res = await fetch('https://api.web3forms.com/submit', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ access_key: CONFIG.WEB3FORMS_ACCESS_KEY, ...fields }),
  });
  let data = {};
  try { data = await res.json(); } catch (_) { /* non-JSON body */ }
  if (!res.ok || !data.success) {
    throw new Error(`Web3Forms ${res.status}: ${data.message || 'send failed'}`);
  }
  return data;
}


// ============================================
// Image Compression — unchanged logic, cleaner style
// ============================================
/**
 * Compress an image File to a base64 JPEG under maxSizeKB.
 * @param {File}   file
 * @param {number} maxSizeKB
 * @returns {Promise<string>}  base64 data-URL
 */
function compressImage(file, maxSizeKB = CONFIG.COMPRESS_TARGET_KB) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.onload  = ({ target: { result } }) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Image decode failed'));
      img.onload  = () => {
        const canvas = document.createElement('canvas');
        let   { width, height } = img;
        const maxW = CONFIG.COMPRESS_MAX_WIDTH;

        if (width > maxW) {
          height = Math.round((height * maxW) / width);
          width  = maxW;
        }

        canvas.width  = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);

        let quality   = 0.7;
        let dataUrl   = canvas.toDataURL('image/jpeg', quality);
        const limitB  = maxSizeKB * 1024;

        while (dataUrl.length > limitB && quality > 0.1) {
          quality -= 0.1;
          dataUrl  = canvas.toDataURL('image/jpeg', quality);
        }

        // Last-resort: halve dimensions
        if (dataUrl.length > limitB) {
          canvas.width  = Math.round(width  * 0.5);
          canvas.height = Math.round(height * 0.5);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          dataUrl = canvas.toDataURL('image/jpeg', 0.5);
        }

        Logger.perf(`Image compressed → ${Math.round(dataUrl.length / 1024)}KB (q=${quality.toFixed(1)})`);
        resolve(dataUrl);
      };
      img.src = result;
    };

    reader.readAsDataURL(file);
  });
}


// ============================================
// Document Generation
// ============================================
function generateEventDayDocument() {
  const order = AppState.getOrder();
  const calInfo = order.calendarInfo || orderData.calendarInfo;
  if (!calInfo) { Logger.warn('generateEventDayDocument: no calendarInfo'); return; }

  const orderNumber = generateOrderNumber();
  const now         = new Date().toLocaleDateString('he-IL');
  const priceStr    = formatPrice(order.price ?? orderData.price ?? 0);

  const html = /* html */`
  <div class="event-document">
    <div class="doc-header">
      <div class="header-info">
        <h1>דף יום האירוע</h1>
        <h2>אחוזת אתרוג — מרכז שפירא</h2>
        <p class="doc-date">נוצר בתאריך: ${now}</p>
      </div>
    </div>

    <div class="doc-columns">
      <div class="doc-section order-section">
        <h3 class="section-title">📋 סיכום ההזמנה</h3>
        <div class="details-grid">
          ${_docRow('מספר הזמנה',   orderNumber)}
          ${_docRow('שם מלא',       `${order.firstName || orderData.firstName} ${order.lastName || orderData.lastName}`)}
          ${_docRow('טלפון',        order.phone || orderData.phone)}
          ${_docRow('סוג אירוע',    order.eventType || orderData.eventType)}
          ${_docRow('תאריך',        `יום ${calInfo.dayName} | ${calInfo.gregDate} | ${calInfo.hebrewDate}`)}
          ${_docRow('שעות האירוע',  `${calInfo.slotText} (${calInfo.hoursText})`)}
          <div class="detail-row total">
            <span class="label">סה״כ תשלום</span>
            <span class="value price">${priceStr}</span>
          </div>
        </div>
      </div>

      <div class="doc-section procedures-section">
        <h3 class="section-title">📜 אישור שיריון – אולם האירועים "אחוזת אתרוג"</h3>
        <p class="sub-note">(השיריון מותנה בתשלום הפיקדון)</p>

        <div class="procedure-section">
          <h4>1. פרטי ההזמנה</h4>
          <p>פרטי ההזמנה כפי שמופיעים בטופס ההזמנה.</p>
          <p><strong>שימו לב:</strong><br>
            האולם שוריין עבורכם באופן ראשוני בלבד.
            על מנת לאשר את ההזמנה באופן סופי, יש להעביר את תשלום הפיקדון עד שבועיים לפני מועד האירוע.
          </p>
          <p>תשלום הפיקדון יוחזר עד יומיים לאחר האירוע, בכפוף לכך שהאולם הוחזר במצב תקין וללא נזקים.</p>
          <p>במקרה של נזק לאולם או לציוד, יתבצע תיקון על ידי היישוב והחזר הפיקדון יהיה בהפחתת עלות התיקון בהתאם להצגת אסמכתא.</p>
        </div>

        <div class="procedure-section">
          <h4>2. נוהל ביטול הזמנה</h4>
          <ul>
            <li>ביטול עד שבועיים לפני האירוע – החזר כספי מלא.</li>
            <li>ביטול עד שבוע לפני האירוע – החזר של 50% מדמי ההזמנה.</li>
            <li>ביטול פחות משבוע לפני האירוע – ללא החזר.</li>
          </ul>
        </div>

        <div class="procedure-section">
          <h4>3. הנחיות ליום האירוע</h4>
          <p><strong>קבלת האולם</strong></p>
          <p>הוועד מתחייב לאפשר כניסה לאולם בהתאם לשעות המצוינות בהזמנה. גמישות בשעות הכניסה תתאפשר במידת האפשר, בכפוף לכך שאין אירועים נוספים באולם.</p>
          <p>במידה והוזמן שימוש במערכת ההגברה, יש לפנות למשרדי הוועד לצורך קבלת הנחיות ומפתחות.</p>
          <p><strong>ניקיון ופינוי האולם</strong></p>
          <ol>
            <li>לקפל ולהחזיר את השולחנות והכיסאות לקצה האולם.</li>
            <li>לטאטא את האולם מפסולת גסה.</li>
            <li>להשליך את האשפה לפח המוטמן שמחוץ לאולם.</li>
          </ol>
          <p>במידה והפח מלא ניתן להשתמש בפח המוטמן שבמרכז המסחרי. אין להשאיר שקיות אשפה מחוץ לפחים.</p>
        </div>

        <div class="procedure-section">
          <h4>4. הנחיית בטיחות חשובה</h4>
          <p>אין להוציא שולחנות וכיסאות במהלך האירוע למסדרון החירום של בית הכנסת.</p>
        </div>

        <div class="procedure-section confirmation">
          <p><strong>שימו לב:</strong><br>
            בעת הזמנת האולם הנכם מאשרים כי קראתם והתחייבתם לפעול בהתאם לתקנון האולם ולכל הנהלים המפורטים בו.
          </p>
          <p class="thanks">נשמח אם תקפידו על הנהלים ותנהגו באחריות, כדי שנוכל להמשיך להעניק שירות איכותי לכלל תושבי היישוב ♥️</p>
        </div>
      </div>
    </div>
  </div>`;

  window.eventDocumentHTML   = html;
  window.currentOrderNumber  = orderNumber;
  AppState.set('bookingSaved', false);   // fresh order number → not yet persisted
}

function _docRow(label, value) {
  return `<div class="detail-row"><span class="label">${label}</span><span class="value">${value}</span></div>`;
}


// ============================================
// Document Download
// ============================================
function getDocumentCSS() {
  return `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;direction:rtl;line-height:1.6;color:#333}
    .event-document{max-width:800px;margin:20px auto;padding:20px;background:white}
    .doc-header{text-align:center;border-bottom:3px solid #302b63;padding-bottom:20px;margin-bottom:30px}
    .header-info h1{font-size:28px;color:#302b63;margin-bottom:5px}
    .header-info h2{font-size:20px;color:#666;margin-bottom:10px}
    .doc-date{color:#999;font-size:14px}
    .doc-columns{display:grid;grid-template-columns:40% 60%;gap:20px;margin-top:20px}
    .doc-section{margin-bottom:30px;padding:20px;border:2px solid #e0e0e0;border-radius:10px}
    .section-title{color:#302b63;margin-bottom:15px;font-size:18px;border-bottom:2px solid #4CAF50;padding-bottom:5px}
    .details-grid{display:flex;flex-direction:column;gap:8px}
    .detail-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee}
    .detail-row.total{font-weight:bold;font-size:16px;margin-top:8px}
    .label{font-weight:700;color:#555}
    .value{color:#333}
    .price{color:#4CAF50;font-weight:700}
    .procedures-section{font-size:12px;line-height:1.5}
    .procedure-section{margin-bottom:20px}
    .procedure-section h4{color:#302b63;margin-bottom:8px}
    .procedure-section ul,.procedure-section ol{padding-right:18px;margin:6px 0}
    .procedure-section li{margin-bottom:4px}
    .sub-note{font-size:12px;color:#666;margin-bottom:10px}
    .confirmation{border-top:1px solid #ddd;padding-top:10px;margin-top:10px}
    .thanks{margin-top:6px;font-weight:500}
    @media print{body{margin:0}.event-document{box-shadow:none}}
  `;
}

async function downloadEventDocumentAndUnlock() {
  if (!window.eventDocumentHTML) {
    Toast.warning('המסמך עדיין לא נוצר. נסו שוב.');
    return;
  }
  if (autoSubmitAfterDownloadStarted || AppState.get('isSubmitting')) {
    Toast.info('השליחה כבר מתבצעת, אנא המתינו...');
    return;
  }

  const downloadBtn = document.getElementById('downloadBtn');
  const successMsg  = document.getElementById('downloadSuccess');
  const submitBtn   = document.getElementById('step7SubmitBtn');
  autoSubmitAfterDownloadStarted = true;

  if (downloadBtn) {
    downloadBtn.disabled = true;
    downloadBtn.innerHTML = '⏳ מוריד מסמך...';
    downloadBtn.style.opacity = '0.85';
    downloadBtn.style.cursor = 'default';
  }

  const fullHTML = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>דף יום האירוע — ${window.currentOrderNumber}</title>
  <style>${getDocumentCSS()}</style>
</head>
<body>${window.eventDocumentHTML}</body>
</html>`;

  const blob = new Blob([fullHTML], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), {
    href:     url,
    download: `דף_יום_האירוע_${window.currentOrderNumber}.html`,
  });
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  if (downloadBtn) {
    downloadBtn.innerHTML = '✅ המסמך הורד בהצלחה';
    downloadBtn.style.opacity = '0.7';
  }
  if (successMsg) {
    successMsg.style.display = 'block';
    successMsg.innerHTML = '<p class="success-message">✅ המסמך הורד בהצלחה! שולחים את ההזמנה אוטומטית...</p>';
  }
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'שולח הזמנה...';
  }

  const wasSubmitted = await submitOrder();
  if (!wasSubmitted) {
    autoSubmitAfterDownloadStarted = false;
    if (successMsg) {
      successMsg.style.display = 'block';
      successMsg.innerHTML = '<p class="success-message">⚠️ ההורדה הושלמה, אבל השליחה האוטומטית נכשלה. אפשר ללחוץ על הכפתור כדי לנסות שוב.</p>';
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'נסה שוב שליחה ←';
      submitBtn.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
    }
  }
}


// ============================================
// Step Navigation
// ============================================
function nextStep(step) {
  if (!validateStep(step)) return;
  currentStep = step + 1;
  AppState.set('currentStep', currentStep);

  if (currentStep === 7) {
    autoSubmitAfterDownloadStarted = false;
    generateEventDayDocument();
  }

  showStep(currentStep);
  updateProgressBar();

  if (currentStep === 4) {
    syncStep4PricingUI();
  }

  if (currentStep === 5) {
    if (!calendarManager) calendarManager = new CalendarManager();
    calendarManager.loadBookedSlots();
  }
  if (currentStep === 6) populateSummary();
  saveDraft();
}

function prevStep(step) {
  FieldValidator.clearAll();
  currentStep = step - 1;
  AppState.set('currentStep', currentStep);
  showStep(currentStep);
  updateProgressBar();
  saveDraft();
}

function showStep(step) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(`step${step}`);
  if (target) target.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function nextStepDirect(step) {
  currentStep = step;
  AppState.set('currentStep', currentStep);
  showStep(step);
  updateProgressBar();
  if (step >= CONFIG.TOTAL_STEPS) clearDraft();
  else saveDraft();
}

function updateProgressBar() {
  const pct = (currentStep / CONFIG.TOTAL_STEPS) * 100;
  const bar = document.getElementById('progressBar');
  if (bar) bar.style.width = `${pct}%`;

  document.querySelectorAll('.step-dot').forEach(dot => {
    const n = parseInt(dot.dataset.step, 10);
    dot.classList.toggle('active',    n === currentStep);
    dot.classList.toggle('completed', n < currentStep);
  });
}


// ============================================
// WhatsApp
// ============================================
function openCoordinationWhatsApp(selectedDate = '', statusMessage = '') {
  const msg = selectedDate
    ? `שלום רב, אני מעוניין לתאם אירוע באולם בתאריך ${selectedDate}.\n` +
      `במערכת מוצג: ${statusMessage}.\n` +
      `אנא בדקי זמינות והתאמה לוגיסטית לאירוע נוסף באותו יום.`
    : 'שלום רב, אני מעוניין לתאם אירוע באולם.';

  closeSlotModal();
  window.open(`https://wa.me/${CONFIG.WHATSAPP_MANAGER}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
}


// ============================================
// Validation — with inline field errors
// ============================================
function validateStep(step) {
  FieldValidator.clearAll();

  switch (step) {
    case 1: return true;

    case 2: {
      if (!document.getElementById('takanonApproval')?.checked) {
        Toast.warning('יש לאשר את התקנון כדי להמשיך');
        return false;
      }
      return true;
    }

    case 3: {
      const first = document.getElementById('firstName')?.value.trim() ?? '';
      const last  = document.getElementById('lastName')?.value.trim()  ?? '';
      const phone = document.getElementById('phone')?.value.trim()     ?? '';
      const event = document.getElementById('eventType')?.value        ?? '';

      let valid = true;

      if (!first) {
        FieldValidator.setError('firstName', 'שדה חובה');
        valid = false;
      }
      if (!last) {
        FieldValidator.setError('lastName', 'שדה חובה');
        valid = false;
      }
      if (!phone) {
        FieldValidator.setError('phone', 'שדה חובה');
        valid = false;
      } else {
        const clean = normalizePhone(phone);
        if (!/^0\d{8,9}$/.test(clean)) {
          FieldValidator.setError('phone', 'פורמט לא תקין — דוגמה: 0501234567');
          valid = false;
        }
      }
      if (!event) {
        FieldValidator.setError('eventType', 'יש לבחור סוג אירוע');
        valid = false;
      }

      if (!valid) Toast.warning('יש לתקן את השדות המסומנים');
      return valid;
    }

    case 4: {
      if (!document.querySelector('.resident-card.selected')) {
        Toast.warning('יש לבחור סוג תושב');
        return false;
      }
      if (isCommunityEventSelected()) {
        return true;
      }
      if (!document.querySelector('input[name="pricing"]:checked')) {
        Toast.warning('יש לבחור תעריף');
        return false;
      }
      return true;
    }

    case 5: {
      if (!calendarManager?.selectedDate || !calendarManager?.selectedSlot) {
        Toast.warning('יש לבחור תאריך ומשבצת לאירוע');
        return false;
      }
      if (isCommunityEventSelected()) {
        return true;
      }
      const pricing     = document.querySelector('input[name="pricing"]:checked');
      if (!pricing) return true;
      const isWeekendP  = pricing.value.includes('weekend');
      const slot        = calendarManager.selectedSlot;

      if (isWeekendP && slot !== 'weekend') {
        Toast.warning('בחרתם תעריף סופ"ש — יש לבחור יום שישי בלוח השנה');
        return false;
      }
      if (!isWeekendP && slot === 'weekend') {
        Toast.warning('בחרתם תעריף יום חול — יש לבחור יום א\'–ה\' בלוח השנה');
        return false;
      }
      return true;
    }

    case 6: return true;  // button is disabled until receipt uploaded

    case 7: return true;  // button is disabled until download completed

    default: return true;
  }
}


// ============================================
// Resident / Pricing Selection
// ============================================
function selectResident(type, element) {
  document.querySelectorAll('.resident-card').forEach(c => c.classList.remove('selected'));
  if (element) element.classList.add('selected');

  // Reset pricing radios
  document.querySelectorAll('input[name="pricing"]').forEach(r => { r.checked = false; });
  const projectorAddon = document.getElementById('projectorAddon');
  if (projectorAddon) projectorAddon.checked = false;

  // Hide all sections
  ['localPricing', 'externalPricing', 'addonSection', 'communityPricingNote'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const isCommunity = isCommunityEventSelected();
  if (isCommunity) {
    const note = document.getElementById('communityPricingNote');
    if (note) note.style.display = 'block';
  } else if (type === 'local') {
    document.getElementById('localPricing').style.display = 'block';
    document.getElementById('addonSection').style.display = 'block';
  } else if (type === 'external') {
    document.getElementById('externalPricing').style.display = 'block';
    document.getElementById('addonSection').style.display = 'block';
  }

  AppState.setOrder({ residentType: type });
  orderData.residentType = type;
  saveDraft();
}


// ============================================
// Calendar Modal
// ============================================
function closeSlotModal() {
  const m = document.getElementById('slotModal');
  if (m) m.style.display = 'none';
}


// ============================================
// Image Modal
// ============================================
function openImage(src) {
  const modal = document.getElementById('imageModal');
  const img   = document.getElementById('modalImage');
  if (modal && img) { img.src = src; modal.classList.add('show'); }
}

function closeImageModal() {
  document.getElementById('imageModal')?.classList.remove('show');
}


// ============================================
// File Upload
// ============================================
async function handleFileUpload(evt) {
  const file = evt.target.files[0];
  if (!file) return;

  // Type check
  if (!CONFIG.ALLOWED_FILE_TYPES.includes(file.type)) {
    Toast.error('ניתן להעלות תמונות בלבד (JPG, PNG, GIF, WebP)');
    evt.target.value = '';
    return;
  }

  // Size check
  if (file.size > CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024) {
    Toast.error(`הקובץ גדול מדי — מקסימום ${CONFIG.MAX_FILE_SIZE_MB}MB`);
    evt.target.value = '';
    return;
  }

  try {
    // Show preview immediately from original
    const reader = new FileReader();
    reader.onload = ({ target: { result } }) => {
      uploadedFileBase64 = result;
      AppState.set('uploadedFileBase64', result);
      const previewImg = document.getElementById('receiptPreviewImg');
      if (previewImg) previewImg.src = result;
    };
    reader.readAsDataURL(file);

    // Compress in parallel
    const compressed = await compressImage(file, CONFIG.COMPRESS_TARGET_KB);
    compressedFileBase64 = compressed;
    AppState.set('compressedFileBase64', compressed);
    uploadedFile = file;
    AppState.set('uploadedFile', file);

    // Update UI
    const fileNameEl = document.getElementById('fileName');
    if (fileNameEl) fileNameEl.textContent = file.name;

    const preview = document.getElementById('uploadPreview');
    if (preview) preview.style.display = 'flex';

    const btn = document.getElementById('step6NextBtn');
    if (btn) {
      btn.disabled    = false;
      btn.textContent = 'המשך ←';
    }

    saveDraft();
    Logger.success(`File ready: ${file.name} → ${Math.round(compressed.length / 1024)}KB compressed`);

  } catch (err) {
    Logger.error('File processing failed', err);
    Toast.error('שגיאה בעיבוד הקובץ — נסו שוב');
  }
}


// ============================================
// Populate Summary (Step 6)
// ============================================
function populateSummary() {
  const firstName  = document.getElementById('firstName')?.value.trim()  ?? '';
  const lastName   = document.getElementById('lastName')?.value.trim()   ?? '';
  const phone      = normalizePhone(document.getElementById('phone')?.value ?? '');
  const eventType  = normalizeEventType(document.getElementById('eventType')?.value ?? '');
  const notes      = document.getElementById('notes')?.value.trim()      ?? '';
  const isCommunityEvent = eventType === 'אירוע קהילתי';
  const isMemorialEvent = eventType === MEMORIAL_EVENT_TYPE;

  const residentType = AppState.getOrder().residentType || orderData.residentType || '';
  const residentText = RESIDENT_LABELS[residentType] ?? residentType;

  let price = 0;
  const pricingInput = document.querySelector('input[name="pricing"]:checked');
  if (isMemorialEvent) {
    price = MEMORIAL_EVENT_PRICE;
  } else if (!isCommunityEvent && pricingInput) {
    price = parseInt(pricingInput.dataset.price, 10) || 0;
  }

  const projector = !isCommunityEvent && (document.getElementById('projectorAddon')?.checked ?? false);
  if (projector) {
    price += 200;
  }

  const projectorRow = document.getElementById('sumProjectorRow');
  if (projectorRow) projectorRow.style.display = projector ? 'flex' : 'none';

  const calInfo = _currentCalendarInfo();

  // Fill DOM
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('sumName',      `${firstName} ${lastName}`);
  set('sumPhone',     phone);
  set('sumEventType', eventType);
  set('sumResident',  residentText);
  set('sumDate',      calInfo ? `יום ${calInfo.dayName} | ${calInfo.gregDate} | ${calInfo.hebrewDate}` : '—');
  set('sumHours',     calInfo ? `${calInfo.slotText} (${calInfo.hoursText})` : '—');
  set('sumNotes',     notes || 'אין');
  set('sumTotal',     formatPrice(price));

  // Community events don't need receipt
  const paymentSection = document.getElementById('paymentSection');
  const step6NextBtn   = document.getElementById('step6NextBtn');

  if (isCommunityEvent) {
    if (paymentSection) paymentSection.style.display = 'none';
    if (step6NextBtn)   { step6NextBtn.disabled = false; step6NextBtn.textContent = 'המשך ←'; }
  } else {
    if (paymentSection) paymentSection.style.display = 'block';
    const hasReceipt = !!(compressedFileBase64 || AppState.get('compressedFileBase64'));
    if (step6NextBtn) {
      step6NextBtn.disabled    = !hasReceipt;
      step6NextBtn.textContent = hasReceipt ? 'המשך ←' : 'יש להעלות אסמכתא';
    }
  }

  // Sync to both state containers
  const patch = { firstName, lastName, phone, eventType, notes, price, residentText, projector, calendarInfo: calInfo };
  AppState.setOrder(patch);
  Object.assign(orderData, { ...patch, residentType });
}


// ============================================
// Submit Order — with concurrency guard + retry
// ============================================
async function submitOrder() {
  // Prevent double-submit
  if (AppState.get('isSubmitting')) {
    Toast.warning('ההזמנה נשלחת, אנא המתינו...');
    return false;
  }

  const order   = AppState.getOrder();
  const calInfo = order.calendarInfo || orderData.calendarInfo;

  if (!calInfo) {
    Toast.error('שגיאה: פרטי התאריך חסרים. חזרו לשלב הלוח ובחרו תאריך.');
    return false;
  }

  // A single stable order number drives both the Firestore save and the
  // idempotency check on retries.
  const orderNumber = window.currentOrderNumber || generateOrderNumber();
  window.currentOrderNumber = orderNumber;

  const mergedOrder = { ...orderData, ...order };
  const normalizedEventType = normalizeEventType(mergedOrder.eventType);
  const priceText   = formatPrice(mergedOrder.price ?? 0);
  const receipt     = compressedFileBase64 || AppState.get('compressedFileBase64') || '';

  AppState.set('isSubmitting', true);
  const loading = document.getElementById('loadingOverlay');
  if (loading) loading.style.display = 'flex';

  try {
    // ── Phase 1: persist the booking (idempotent, atomic) ───────────
    // The booking is the source of truth. Once committed, the slot is
    // reserved — a failure in the *email* step (phase 2) must never undo it
    // or block a retry. We remember that the booking is already saved so a
    // retry skips straight to the email.
    if (!AppState.get('bookingSaved')) {
      const bookingData = {
        orderNumber,
        firstName:    mergedOrder.firstName,
        lastName:     mergedOrder.lastName,
        fullName:     `${mergedOrder.firstName} ${mergedOrder.lastName}`,
        phone:        mergedOrder.phone,
        eventType:    normalizedEventType,
        notes:        mergedOrder.notes || '',
        residentType: mergedOrder.residentType,
        residentText: mergedOrder.residentText,
        price:        mergedOrder.price,
        dateKey:      calInfo.dateKey,
        slot:         calInfo.slot,
        slotText:     calInfo.slotText,
        hoursText:    calInfo.hoursText,
        gregDate:     calInfo.gregDate,
        hebrewDate:   calInfo.hebrewDate,
        dayName:      calInfo.dayName,
        hasReceipt:   !!receipt,
        receipt_image: receipt,
        projector:    mergedOrder.projector || false,
        status:       'pending',
        createdAt:    firebase.firestore.FieldValue.serverTimestamp(),
      };

      // ── Atomic slot lock: prevents double-booking under concurrent users ──
      // booked_slots/{dateKey}_{slot} acts as a mutex document. The transaction
      // reads it first. If it already exists *for a different order* the slot is
      // genuinely taken and we throw. If it already belongs to THIS order
      // (a previous attempt committed but its ack was lost, or a retry after an
      // email failure) we treat it as a no-op — keeping the save idempotent and
      // never producing a false "SLOT_TAKEN".
      const slotDocId  = `${calInfo.dateKey}_${calInfo.slot}`;
      const slotRef    = db.collection('booked_slots').doc(slotDocId);
      const bookingRef = db.collection('bookings').doc();

      Logger.info('Saving booking (atomic)…', { orderNumber, slotDocId });
      try {
        await withRetry(() => db.runTransaction(async (tx) => {
          const slotSnap = await tx.get(slotRef);
          if (slotSnap.exists) {
            if (slotSnap.data()?.orderNumber === orderNumber) return; // our own lock
            throw new Error('SLOT_TAKEN');
          }
          tx.set(bookingRef, bookingData);
          tx.set(slotRef, {
            dateKey:     calInfo.dateKey,
            slot:        calInfo.slot,
            orderNumber,
            createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
          });
        }));
      } catch (saveError) {
        // Nothing was committed (or the slot genuinely belongs to someone
        // else) — a retry is safe and necessary.
        Logger.error('submitOrder: booking save failed', saveError);
        Toast.error(_friendlyError(saveError), 8000);
        return false;
      }

      AppState.set('bookingSaved', true);
      if (calendarManager) calendarManager.invalidateCache();
      Logger.success(`Booking saved — order ${orderNumber}`);
    } else {
      Logger.info('Booking already saved — skipping Firestore, retrying email only.');
    }

    // ── Phase 2: notify the committee by email (booking already safe) ──
    // The receipt image itself is NOT emailed (it is stored on the booking and
    // viewable in the admin panel) — keeps the message light and reliable.
    const emailParams = {
      subject:               `הזמנה חדשה לאולם — ${orderNumber}`,
      from_name:             'שריון אולם מרכז שפירא',
      'מספר הזמנה':          orderNumber,
      'שם מלא':              `${mergedOrder.firstName} ${mergedOrder.lastName}`,
      'טלפון':               mergedOrder.phone,
      'סוג אירוע':           normalizedEventType,
      'סיווג':               mergedOrder.residentText,
      'תאריך':               `יום ${calInfo.dayName} | ${calInfo.gregDate} | ${calInfo.hebrewDate}`,
      'שעות':                `${calInfo.slotText} (${calInfo.hoursText})`,
      'הגברה + מסך ומקרן':   mergedOrder.projector ? 'כן (+₪200)' : 'לא',
      'הערות':               mergedOrder.notes || 'אין',
      'סה"כ לתשלום':         priceText,
      'אסמכתת תשלום':        receipt ? 'הועלתה — לצפייה בפאנל הניהול' : 'לא הועלתה',
    };

    const el = document.getElementById('orderNumber');
    if (el) el.textContent = orderNumber;

    try {
      Logger.info('Sending email…');
      await withRetry(() => sendCommitteeEmail(emailParams));
      Logger.success('Email sent (Web3Forms)');
      Toast.success(`ההזמנה נקלטה בהצלחה! מספר הזמנה: ${orderNumber}`);
    } catch (emailError) {
      // The reservation IS saved; only the automatic committee email failed.
      // Don't lose the booking and don't trap the user — confirm the order and
      // offer a WhatsApp fallback so the committee is still notified.
      Logger.error('submitOrder: email failed (booking already saved)', emailError);
      showCommitteeWhatsAppFallback({ orderNumber, mergedOrder, calInfo, priceText, eventType: normalizedEventType });
      Toast.warning('ההזמנה נשמרה בהצלחה, אך לא הצלחנו לשלוח התראה אוטומטית לוועד. שלחו את הסיכום בוואטסאפ כדי שהוועד יקבל אותו.', 9000);
    }

    clearDraft();
    nextStepDirect(8);
    return true;

  } finally {
    if (loading) loading.style.display = 'none';
    AppState.set('isSubmitting', false);
  }
}

/** Map technical errors to Hebrew user messages. */
function _friendlyError(err) {
  const m = err?.message ?? '';
  if (m === 'SLOT_TAKEN')
    return 'המשבצת הזו נתפסה זה עתה על ידי מישהו אחר — אנא חזרו ללוח השנה ובחרו תאריך/שעה אחרים';
  if (m.includes('network') || m.includes('offline'))
    return 'בעיית חיבור לאינטרנט — בדקו את החיבור ונסו שוב';
  if (m.includes('permission-denied'))
    return 'שגיאת הרשאות — פנו לוועד';
  if (m.includes('quota'))
    return 'המערכת עמוסה — נסו שוב בעוד כמה דקות';
  if (m.includes('Firebase') || m.includes('firestore'))
    return 'שגיאה בשמירת ההזמנה — נסו שוב';
  return `שגיאה בשליחת ההזמנה — נסו שוב (${m.slice(0, 60)})`;
}

/**
 * Build the WhatsApp fallback message sent to the committee when the
 * automatic email could not be delivered (the booking is already saved).
 */
function _buildCommitteeFallbackMessage(orderNumber, o, calInfo, priceText, eventType) {
  return [
    'שלום, נקלטה הזמנה חדשה לאולם (שליחת המייל האוטומטי נכשלה):',
    `מספר הזמנה: ${orderNumber}`,
    `שם: ${o.firstName || ''} ${o.lastName || ''}`.trim(),
    `טלפון: ${o.phone || ''}`,
    `סוג אירוע: ${eventType}`,
    o.residentText ? `סיווג: ${o.residentText}` : '',
    `תאריך: יום ${calInfo.dayName} | ${calInfo.gregDate} | ${calInfo.hebrewDate}`,
    `שעות: ${calInfo.slotText} (${calInfo.hoursText})`,
    o.projector ? 'הגברה + מסך ומקרן: כן (+₪200)' : '',
    `סה"כ לתשלום: ${priceText}`,
    o.notes ? `הערות: ${o.notes}` : '',
  ].filter(Boolean).join('\n');
}

/**
 * Reveal the committee WhatsApp fallback on the success screen and wire its
 * button to a pre-filled message. Used when the email (phase 2) fails but the
 * booking is already saved, so the committee is still notified.
 */
function showCommitteeWhatsAppFallback({ orderNumber, mergedOrder, calInfo, priceText, eventType }) {
  const box = document.getElementById('committeeFallback');
  const btn = document.getElementById('committeeWhatsAppBtn');
  const msg = _buildCommitteeFallbackMessage(orderNumber, mergedOrder, calInfo, priceText, eventType);
  const url = `https://wa.me/${CONFIG.WHATSAPP_MANAGER}?text=${encodeURIComponent(msg)}`;

  if (btn) btn.onclick = () => window.open(url, '_blank', 'noopener,noreferrer');
  if (box) box.style.display = 'block';
}

// Kept for backward compat
async function submitOrderWithoutImage() {
  compressedFileBase64 = '';
  AppState.set('compressedFileBase64', '');
  await submitOrder();
}


// ============================================
// Init
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  Logger.info('🏛️ מערכת שריון אולם מרכז שפירא — Enterprise Edition');
  updateProgressBar();
  maybeShowDraftRecoveryPrompt();

  // Guard against accidental navigation mid-flow
  window.addEventListener('beforeunload', e => {
    saveDraft();
    const step = AppState.get('currentStep') || currentStep;
    if (step > 1 && step < CONFIG.TOTAL_STEPS) {
      e.preventDefault();
      // Modern browsers intentionally ignore custom text here, and many mobile
      // browsers skip this dialog entirely. Draft recovery below covers that.
      return (e.returnValue = 'ההזמנה לא הושלמה! האם אתה בטוח שברצונך לצאת?');
    }
  });

  window.addEventListener('pagehide', saveDraft);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveDraft();
  });

  // Clear field errors on input
  document.addEventListener('input', e => {
    if (e.target.id) FieldValidator.clearError(e.target.id);
    saveDraftDebounced();
  });

  document.addEventListener('change', saveDraftDebounced);

  // Keep step 4 pricing UI in sync when event type changes.
  document.getElementById('eventType')?.addEventListener('change', () => {
    syncMemorialPricingOptions();
    const step = AppState.get('currentStep') || currentStep;
    if (step >= 4) {
      syncStep4PricingUI();
    }
  });

  syncMemorialPricingOptions();

  // Keyboard: Escape closes modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeSlotModal(); closeImageModal(); }
  });

  // Keyboard activation for non-native clickable elements (role="button").
  // Lets keyboard / screen-reader users trigger resident cards, gallery &
  // takanon images, and calendar day cells via Enter or Space — one handler
  // for all of them instead of inline onkeydown on each element.
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    const el = e.target;
    if (el && el.tagName !== 'BUTTON' &&
        el.getAttribute('role') === 'button' && el.tabIndex === 0) {
      e.preventDefault();   // Space must not scroll the page
      el.click();
    }
  });
});

// Legacy showAlert → Toast
function showAlert(msg) {
  if (msg.startsWith('✅') || msg.startsWith('ה')) Toast.success(msg);
  else if (msg.startsWith('❌'))                   Toast.error(msg);
  else                                             Toast.warning(msg);
}
