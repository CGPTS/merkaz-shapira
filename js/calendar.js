// ============================================
// Calendar Manager — Enterprise Edition
// ============================================

'use strict';

class CalendarManager {
  constructor() {
    const now = new Date();
    this.currentMonth = now.getMonth();
    this.currentYear  = now.getFullYear();
    this.selectedDate = null;
    this.selectedSlot = null;

    /**
     * Two-level cache:
     *   _cache['YYYY-MM'] = { slots: { dateKey: string[] }, fetchedAt: Date }
     * Avoids redundant Firestore reads when navigating between months.
     */
    this._cache = new Map();
    this._CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

    this._init();
  }

  // ──────────────────────────────────────────
  // Initialization
  // ──────────────────────────────────────────

  _init() {
    document.getElementById('prevMonth')
      ?.addEventListener('click', () => this.changeMonth(-1));
    document.getElementById('nextMonth')
      ?.addEventListener('click', () => this.changeMonth(1));
  }

  // ──────────────────────────────────────────
  // Data Layer
  // ──────────────────────────────────────────

  /** Returns the cache key for a given year/month. */
  _cacheKey(year = this.currentYear, month = this.currentMonth) {
    return `${year}-${String(month + 1).padStart(2, '0')}`;
  }

  /** True if we have a fresh cache entry for this month. */
  _isCached(key) {
    if (!this._cache.has(key)) return false;
    const { fetchedAt } = this._cache.get(key);
    return (Date.now() - fetchedAt) < this._CACHE_TTL_MS;
  }

  /**
   * Load booked slots for the current month.
   * Uses cache if fresh; otherwise fetches from Firestore.
   * Pre-fetches the adjacent months in the background.
   */
  async loadBookedSlots() {
    const key = this._cacheKey();

    if (this._isCached(key)) {
      this._render(this._cache.get(key).slots);
      this._prefetchAdjacent();
      return;
    }

    this._setLoadingState(true);

    try {
      const slots = await this._fetchMonth(this.currentYear, this.currentMonth);
      this._cache.set(key, { slots, fetchedAt: Date.now() });
      this._render(slots);
      this._prefetchAdjacent();
    } catch (err) {
      console.error('❌ CalendarManager.loadBookedSlots:', err);
      // Render with empty slots so UI stays usable
      this._render({});
    } finally {
      this._setLoadingState(false);
    }
  }

  /**
   * Fetch booked slots for an arbitrary month from Firestore.
   * Queries only the relevant date range to minimise read cost.
   * @returns {Promise<Object>}  { [dateKey]: string[] }
   */
  async _fetchMonth(year, month) {
    const startKey = this._formatDateKey(new Date(year, month, 1));
    const endKey   = this._formatDateKey(new Date(year, month + 1, 0));

    const snapshot = await db.collection('bookings')
      .where('status',  'in',  ['pending', 'approved'])
      .where('dateKey', '>=', startKey)
      .where('dateKey', '<=', endKey)
      .get();

    const slots = {};
    snapshot.forEach(doc => {
      const { dateKey, slot } = doc.data();
      if (!slots[dateKey]) slots[dateKey] = [];
      slots[dateKey].push(slot);
    });

    return slots;
  }

  /** Silently pre-fetch prev/next months so navigation feels instant. */
  _prefetchAdjacent() {
    const prev = this._adjacentMonth(-1);
    const next = this._adjacentMonth(+1);

    [prev, next].forEach(({ year, month }) => {
      const key = this._cacheKey(year, month);
      if (!this._isCached(key)) {
        this._fetchMonth(year, month)
          .then(slots => this._cache.set(key, { slots, fetchedAt: Date.now() }))
          .catch(() => {/* silently ignore pre-fetch errors */});
      }
    });
  }

  _adjacentMonth(delta) {
    let month = this.currentMonth + delta;
    let year  = this.currentYear;
    if (month > 11) { month = 0;  year++; }
    if (month < 0)  { month = 11; year--; }
    return { year, month };
  }

  // ──────────────────────────────────────────
  // Navigation
  // ──────────────────────────────────────────

  changeMonth(delta) {
    const { year, month } = this._adjacentMonth(delta);
    this.currentYear  = year;
    this.currentMonth = month;
    this.loadBookedSlots();
  }

  // ──────────────────────────────────────────
  // Rendering — uses DocumentFragment for perf
  // ──────────────────────────────────────────

  _setLoadingState(loading) {
    const grid = document.getElementById('calendarGrid');
    if (!grid) return;
    grid.style.opacity = loading ? '0.4' : '1';
    grid.style.pointerEvents = loading ? 'none' : '';
  }

  _render(bookedSlots) {
    const grid       = document.getElementById('calendarGrid');
    const monthTitle = document.getElementById('currentMonth');
    if (!grid || !monthTitle) return;

    // Update title
    const pivot      = new Date(this.currentYear, this.currentMonth, 15);
    const hebrewMon  = HebrewDateConverter.getHebrewDate(pivot);
    const gregMon    = HebrewDateConverter.getHebrewMonthName(this.currentMonth);
    monthTitle.textContent = `${gregMon} ${this.currentYear} | ${hebrewMon}`;

    // Preserve headers
    const headers = [...grid.querySelectorAll('.calendar-header-day')];
    grid.innerHTML = '';
    const fragment = document.createDocumentFragment();
    headers.forEach(h => fragment.appendChild(h));

    const firstDayOfWeek = new Date(this.currentYear, this.currentMonth, 1).getDay();
    const daysInMonth    = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
    const today          = new Date();
    today.setHours(0, 0, 0, 0);

    // Empty leading cells
    for (let i = 0; i < firstDayOfWeek; i++) {
      const empty = document.createElement('div');
      empty.className = 'calendar-day empty';
      fragment.appendChild(empty);
    }

    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
      const date      = new Date(this.currentYear, this.currentMonth, day);
      const dateKey   = this._formatDateKey(date);
      const dow       = date.getDay();
      const isPast    = date < today;
      const booked    = bookedSlots[dateKey] ?? [];
      const isSelected = this.selectedDate &&
        dateKey === this._formatDateKey(this.selectedDate);

      const cell = this._buildDayCell({ day, date, dateKey, dow, isPast, booked, isSelected });
      fragment.appendChild(cell);
    }

    grid.appendChild(fragment);
  }

  /**
   * Build a single calendar day cell.
   * Extracted for clarity and testability.
   */
  _buildDayCell({ day, date, dow, isPast, booked, isSelected }) {
    const cell = document.createElement('div');
    const classes = ['calendar-day'];
    if (isPast)     classes.push('past');
    if (isSelected) classes.push('selected');
    cell.className = classes.join(' ');

    const hebShort = HebrewDateConverter.getHebrewDateShort(date);
    const slotsHTML = this._buildSlotsHTML(dow, booked);

    cell.innerHTML = `
      <div class="greg-date">${day}</div>
      <div class="heb-date">${hebShort}</div>
      <div class="day-slots">${slotsHTML}</div>
    `;

    if (!isPast && dow !== 6) {
      cell.addEventListener('click', () => this._onDayClick(date, dow, booked));
    }

    return cell;
  }

  _buildSlotsHTML(dow, booked) {
    if (dow === 6) {
      // Saturday — always part of weekend booking, not selectable
      return '<span class="slot-indicator booked" style="background:rgba(150,150,150,0.3)">שבת</span>';
    }
    if (dow === 5) {
      // Friday — weekend slot
      const taken = booked.includes('weekend');
      return `<span class="slot-indicator ${taken ? 'booked' : 'available'}">
        סופ"ש ${taken ? '✗' : '✓'}
      </span>`;
    }
    // Sun–Thu — morning + evening
    const am = booked.includes('morning');
    const pm = booked.includes('evening');
    return `
      <span class="slot-indicator ${am ? 'booked' : 'available'}">בוקר ${am ? '✗' : '✓'}</span>
      <span class="slot-indicator ${pm ? 'booked' : 'available'}">ערב  ${pm ? '✗' : '✓'}</span>
    `;
  }

  // ──────────────────────────────────────────
  // Day Click — Modal
  // ──────────────────────────────────────────

  _onDayClick(date, dow, booked) {
    const modal       = document.getElementById('slotModal');
    const modalDate   = document.getElementById('slotModalDate');
    const slotOptions = document.getElementById('slotOptions');
    if (!modal || !modalDate || !slotOptions) return;

    const heb     = HebrewDateConverter.getHebrewDate(date);
    const greg    = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
    const dayName = HebrewDateConverter.getHebrewDayOfWeek(dow);

    modalDate.textContent = `יום ${dayName} | ${greg} | ${heb}`;
    slotOptions.innerHTML = '';

    if (dow === 5) {
      booked.includes('weekend')
        ? this._showCoordinationMessage(slotOptions, date, dow, booked)
        : this._addSlotButton(slotOptions, '🌅 אירוע סופ"ש (שישי 10:00 — מוצאי שבת)', () => this._selectSlot(date, 'weekend'));
    } else {
      const isAnyBooked = booked.length > 0;
      if (isAnyBooked) {
        this._showCoordinationMessage(slotOptions, date, dow, booked);
      } else {
        const pricingValue = document.querySelector('input[name="pricing"]:checked')?.value ?? '';
        if (pricingValue.includes('weekend')) {
          const note = document.createElement('p');
          Object.assign(note.style, { color: '#e05c5c', fontWeight: '700', padding: '10px 0' });
          note.textContent = '⚠️ בחרתם תעריף סופ"ש — אנא בחרו יום שישי';
          slotOptions.appendChild(note);
        } else {
          this._addSlotButton(slotOptions, '🌅 אירוע בוקר (06:00 — 12:00)', () => this._selectSlot(date, 'morning'));
          this._addSlotButton(slotOptions, '🌙 אירוע ערב (13:00 — 23:00)',  () => this._selectSlot(date, 'evening'));
        }
      }
    }

    modal.style.display = 'flex';
  }

  _addSlotButton(container, label, onClick) {
    const btn = document.createElement('button');
    btn.className   = 'slot-btn';
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    container.appendChild(btn);
  }

  _showCoordinationMessage(container, date, dow, booked) {
    const heb     = HebrewDateConverter.getHebrewDate(date);
    const greg    = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
    const dayName = HebrewDateConverter.getHebrewDayOfWeek(dow);

    const { title, status, options } = this._coordinationCopy(dow, booked);

    const div = document.createElement('div');
    div.className = 'coordination-message';
    div.innerHTML = `
      <div class="coordination-content">
        <div class="date-header">יום ${dayName} | ${greg} | ${heb}</div>
        <h4>${title}</h4>
        <p class="status-message">${status}</p>
        <p class="available-options">${options}</p>
        <button class="whatsapp-coordination-btn"
          onclick="openCoordinationWhatsApp('${greg}', '${status}')">
          <span class="whatsapp-icon">📱</span>
          <strong>לתיאום האירוע</strong>
        </button>
      </div>`;
    container.appendChild(div);
  }

  _coordinationCopy(dow, booked) {
    if (dow === 5) {
      return {
        title:   '⚠️ אירוע סופ"ש כבר תפוס',
        status:  'אירוע סופ"ש תפוס',
        options: 'ניתן ליצור קשר כדי לבדוק תאריכים אחרים, או לבקש להכנס לרשימת ההמתנה.',
      };
    }
    const am = booked.includes('morning');
    const pm = booked.includes('evening');
    if (am && pm) return {
      title:   '⚠️ התאריך תפוס לחלוטין',
      status:  'אירועי בוקר וערב תפוסים',
      options: 'ניתן לבדוק אפשרויות חלופיות.',
    };
    if (am) return {
      title:   '⚠️ התאריך תפוס חלקית',
      status:  'אירוע בוקר תפוס',
      options: 'ניתן לתאם אירוע ערב, או לבקש להכנס לרשימת המתנה לאירוע הבוקר.',
    };
    return {
      title:   '⚠️ התאריך תפוס חלקית',
      status:  'אירוע ערב תפוס',
      options: 'ניתן לתאם אירוע בוקר, או לבקש להכנס לרשימת המתנה לאירוע הערב.',
    };
  }

  // ──────────────────────────────────────────
  // Slot Selection
  // ──────────────────────────────────────────

  _selectSlot(date, slot) {
    this.selectedDate = date;
    this.selectedSlot = slot;
    closeSlotModal();

    const meta    = SLOT_META[slot] ?? { text: slot, hours: '' };
    const greg    = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
    const heb     = HebrewDateConverter.getHebrewDate(date);
    const dayName = HebrewDateConverter.getHebrewDayOfWeek(date.getDay());

    const display = document.getElementById('selectedDateDisplay');
    if (display) {
      display.innerHTML = `
        ✅ נבחר: <strong>יום ${dayName} | ${greg} | ${heb}</strong><br>
        📋 ${meta.text} | ⏰ ${meta.hours}
      `;
      display.style.display = 'block';
    }

    // Invalidate current month cache so re-render reflects selection
    this._render(this._cache.get(this._cacheKey())?.slots ?? {});
  }

  // ──────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────

  /** @returns {{ date, dateKey, slot, slotText, hoursText, gregDate, hebrewDate, dayName } | null} */
  getSelectedInfo() {
    if (!this.selectedDate || !this.selectedSlot) return null;
    const date    = this.selectedDate;
    const meta    = SLOT_META[this.selectedSlot] ?? { text: this.selectedSlot, hours: '' };
    const greg    = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
    const heb     = HebrewDateConverter.getHebrewDate(date);
    const dayName = HebrewDateConverter.getHebrewDayOfWeek(date.getDay());

    return {
      date,
      dateKey:  this._formatDateKey(date),
      slot:     this.selectedSlot,
      slotText: meta.text,
      hoursText:meta.hours,
      gregDate: greg,
      hebrewDate: heb,
      dayName,
      displayText: `יום ${dayName} | ${greg} | ${heb} | ${meta.text} (${meta.hours})`,
    };
  }

  /** Invalidate the entire cache (e.g. after a booking is submitted). */
  invalidateCache() {
    this._cache.clear();
  }

  // ──────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────

  _formatDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}