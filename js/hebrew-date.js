// ============================================
// Hebrew Date Converter — Enterprise Edition
// Memoized, robust, fully static utility class
// ============================================

'use strict';

class HebrewDateConverter {

  // ──────────────────────────────────────────
  // Memoization caches (module-level Maps)
  // ──────────────────────────────────────────

  static #dayCache   = new Map();   // Date.toISOString() → number
  static #monthCache = new Map();
  static #yearCache  = new Map();
  static #shortCache = new Map();   // Date.toISOString() → string (letters)
  static #fullCache  = new Map();   // Date.toISOString() → string ("כ"ג אדר")

  /** Normalized cache key from a Date (day-level precision). */
  static #key(date) {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }

  // ──────────────────────────────────────────
  // Hebrew numeral → letters
  // ──────────────────────────────────────────

  static numberToHebrewLetters(num) {
    if (num === 15) return 'ט"ו';
    if (num === 16) return 'ט"ז';

    const ones = ['','א','ב','ג','ד','ה','ו','ז','ח','ט'];
    const tens = ['','י','כ','ל'];

    if (num <= 9) return `${ones[num]}'`;

    const ten = Math.floor(num / 10);
    const one = num % 10;
    return one === 0 ? `${tens[ten]}'` : `${tens[ten]}"${ones[one]}`;
  }

  // ──────────────────────────────────────────
  // Intl-backed extraction helpers (memoized)
  // ──────────────────────────────────────────

  static #intlDay(date) {
    const k = HebrewDateConverter.#key(date);
    if (HebrewDateConverter.#dayCache.has(k)) return HebrewDateConverter.#dayCache.get(k);

    try {
      const v = parseInt(
        new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric' }).format(date), 10
      );
      HebrewDateConverter.#dayCache.set(k, v);
      return v;
    } catch { return 0; }
  }

  static #intlMonth(date) {
    const k = HebrewDateConverter.#key(date);
    if (HebrewDateConverter.#monthCache.has(k)) return HebrewDateConverter.#monthCache.get(k);

    try {
      const v = parseInt(
        new Intl.DateTimeFormat('en-u-ca-hebrew', { month: 'numeric' }).format(date), 10
      );
      HebrewDateConverter.#monthCache.set(k, v);
      return v;
    } catch { return 0; }
  }

  static #intlYear(date) {
    const k = HebrewDateConverter.#key(date);
    if (HebrewDateConverter.#yearCache.has(k)) return HebrewDateConverter.#yearCache.get(k);

    try {
      const v = parseInt(
        new Intl.DateTimeFormat('en-u-ca-hebrew', { year: 'numeric' }).format(date), 10
      );
      HebrewDateConverter.#yearCache.set(k, v);
      return v;
    } catch { return 0; }
  }

  // ──────────────────────────────────────────
  // Calendar helpers
  // ──────────────────────────────────────────

  /** Returns true for a Hebrew leap year (has 13 months). */
  static isHebrewLeapYear(hebrewYear) {
    return [3, 6, 8, 11, 14, 17, 19].includes(hebrewYear % 19);
  }

  /** Returns the Hebrew month name given its ordinal (1-based) and the Hebrew year. */
  static getHebrewMonthNameByNumber(monthNum, hebrewYear) {
    const leap = HebrewDateConverter.isHebrewLeapYear(hebrewYear);

    const MONTHS = {
       1: 'תשרי',
       2: 'חשוון',
       3: 'כסלו',
       4: 'טבת',
       5: 'שבט',
       6: leap ? "אדר א'" : 'אדר',
       7: leap ? "אדר ב'" : 'ניסן',
       8: leap ? 'ניסן'   : 'אייר',
       9: leap ? 'אייר'   : 'סיוון',
      10: leap ? 'סיוון'  : 'תמוז',
      11: leap ? 'תמוז'   : 'אב',
      12: leap ? 'אב'     : 'אלול',
      13: leap ? 'אלול'   : '',
    };

    return MONTHS[monthNum] ?? '';
  }

  // ──────────────────────────────────────────
  // Public API — all results are memoized
  // ──────────────────────────────────────────

  /**
   * Full Hebrew date string, e.g. `כ"ג אדר`.
   * @param {Date} date
   * @returns {string}
   */
  static getHebrewDate(date) {
    const k = HebrewDateConverter.#key(date);
    if (HebrewDateConverter.#fullCache.has(k)) return HebrewDateConverter.#fullCache.get(k);

    try {
      const day       = HebrewDateConverter.#intlDay(date);
      const month     = HebrewDateConverter.#intlMonth(date);
      const year      = HebrewDateConverter.#intlYear(date);
      const letters   = HebrewDateConverter.numberToHebrewLetters(day);
      const monthName = HebrewDateConverter.getHebrewMonthNameByNumber(month, year);
      const result    = `${letters} ${monthName}`;
      HebrewDateConverter.#fullCache.set(k, result);
      return result;
    } catch { return ''; }
  }

  /**
   * Short Hebrew day number only, e.g. `כ"ג`.
   * Used in calendar grid cells.
   * @param {Date} date
   * @returns {string}
   */
  static getHebrewDateShort(date) {
    const k = HebrewDateConverter.#key(date);
    if (HebrewDateConverter.#shortCache.has(k)) return HebrewDateConverter.#shortCache.get(k);

    try {
      const result = HebrewDateConverter.numberToHebrewLetters(
        HebrewDateConverter.#intlDay(date)
      );
      HebrewDateConverter.#shortCache.set(k, result);
      return result;
    } catch { return ''; }
  }

  /**
   * Hebrew day-of-week name.
   * @param {number} dayIndex  0=Sunday … 6=Saturday
   * @returns {string}
   */
  static getHebrewDayOfWeek(dayIndex) {
    return ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'][dayIndex] ?? '';
  }

  /**
   * Gregorian month name in Hebrew.
   * @param {number} monthIndex  0-based
   * @returns {string}
   */
  static getHebrewMonthName(monthIndex) {
    return [
      'ינואר','פברואר','מרץ','אפריל','מאי','יוני',
      'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר',
    ][monthIndex] ?? '';
  }

  // ──────────────────────────────────────────
  // Cache management
  // ──────────────────────────────────────────

  /** Clear all memoization caches (useful if locale changes at runtime). */
  static clearCache() {
    HebrewDateConverter.#dayCache.clear();
    HebrewDateConverter.#monthCache.clear();
    HebrewDateConverter.#yearCache.clear();
    HebrewDateConverter.#shortCache.clear();
    HebrewDateConverter.#fullCache.clear();
  }
}