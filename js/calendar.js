// ============================================
// Calendar Manager
// ============================================

class CalendarManager {
    constructor() {
        this.currentDate = new Date();
        this.currentMonth = this.currentDate.getMonth();
        this.currentYear = this.currentDate.getFullYear();
        this.selectedDate = null;
        this.selectedSlot = null;
        this.bookedSlots = {};

        this.init();
    }

    init() {
        document.getElementById('prevMonth').addEventListener('click', () => this.changeMonth(-1));
        document.getElementById('nextMonth').addEventListener('click', () => this.changeMonth(1));
    }

    async loadBookedSlots() {
        try {
            const snapshot = await db.collection('bookings')
                .where('status', 'in', ['pending', 'approved'])
                .get();

            this.bookedSlots = {};

            snapshot.forEach(doc => {
                const data = doc.data();
                const dateKey = data.dateKey; // format: "YYYY-MM-DD"
                const slot = data.slot; // "morning", "evening", "weekend"

                if (!this.bookedSlots[dateKey]) {
                    this.bookedSlots[dateKey] = [];
                }
                this.bookedSlots[dateKey].push(slot);
            });

            this.render();
        } catch (error) {
            console.error('Error loading booked slots:', error);
            this.render();
        }
    }

    changeMonth(delta) {
        this.currentMonth += delta;
        if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        } else if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        }
        this.loadBookedSlots();
    }

render() {
    const grid = document.getElementById('calendarGrid');
    const monthTitle = document.getElementById('currentMonth');

    // Hebrew month display
    const monthDate = new Date(this.currentYear, this.currentMonth, 15);
    const hebrewMonth = HebrewDateConverter.getHebrewDate(monthDate);
    const gregMonth = HebrewDateConverter.getHebrewMonthName(this.currentMonth);

    monthTitle.textContent = `${gregMonth} ${this.currentYear} | ${hebrewMonth}`;

    // Clear previous days (keep headers)
    const headers = grid.querySelectorAll('.calendar-header-day');
    grid.innerHTML = '';
    headers.forEach(h => grid.appendChild(h));

    // First day of month
    const firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();
    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day empty';
        grid.appendChild(emptyCell);
    }

    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(this.currentYear, this.currentMonth, day);
        const dateKey = this.formatDateKey(date);
        const dayOfWeek = date.getDay();
        const isPast = date < today;

        const cell = document.createElement('div');
        cell.className = 'calendar-day';

        if (isPast) {
            cell.classList.add('past');
        }

        const hebrewDate = HebrewDateConverter.getHebrewDateShort(date);
        const bookedForDay = this.bookedSlots[dateKey] || [];

        let slotsHTML = '';

        if (dayOfWeek === 6) {
            // Saturday - part of weekend, no separate booking
            slotsHTML = '<span class="slot-indicator booked" style="background:#999;">סופ"ש</span>';
        } else if (dayOfWeek === 5) {
            // Friday - weekend event only
            const isWeekendBooked = bookedForDay.includes('weekend');
            
            if (isWeekendBooked) {
                slotsHTML = '<span class="slot-indicator booked">סופ"ש - תפוס</span>';
            } else {
                slotsHTML = '<span class="slot-indicator available">סופ"ש - פנוי</span>';
            }
        } else {
            // ✅ Sunday to Thursday - תצוגה מדויקת של זמינות
            const morningBooked = bookedForDay.includes('morning');
            const eveningBooked = bookedForDay.includes('evening');

            slotsHTML = `
                <span class="slot-indicator ${morningBooked ? 'booked' : 'available'}">
                    בוקר ${morningBooked ? '✗' : '✓'}
                </span>
                <span class="slot-indicator ${eveningBooked ? 'booked' : 'available'}">
                    ערב ${eveningBooked ? '✗' : '✓'}
                </span>
            `;
        }

        cell.innerHTML = `
            <div class="greg-date">${day}</div>
            <div class="heb-date">${hebrewDate}</div>
            <div class="day-slots">${slotsHTML}</div>
        `;

        if (this.selectedDate && dateKey === this.formatDateKey(this.selectedDate)) {
            cell.classList.add('selected');
        }

        if (!isPast && dayOfWeek !== 6) {
            cell.addEventListener('click', () => this.onDayClick(date, dayOfWeek, bookedForDay));
        }

        grid.appendChild(cell);
    }
}

onDayClick(date, dayOfWeek, bookedSlots) {
    const modal = document.getElementById('slotModal');
    const modalDate = document.getElementById('slotModalDate');
    const slotOptions = document.getElementById('slotOptions');

    const hebrewDate = HebrewDateConverter.getHebrewDate(date);
    const gregDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
    const dayName = HebrewDateConverter.getHebrewDayOfWeek(dayOfWeek);

    modalDate.textContent = `יום ${dayName} | ${gregDate} | ${hebrewDate}`;
    slotOptions.innerHTML = '';

    if (dayOfWeek === 5) {
        // Friday - weekend only
        const isBooked = bookedSlots.includes('weekend');
        if (isBooked) {
            // יום תפוס - הפנייה לתיאום עם כרמית
            this.showCoordinationMessage(slotOptions, date, dayOfWeek, bookedSlots);
        } else {
            const btn = document.createElement('button');
            btn.className = 'slot-btn';
            btn.textContent = `🌅 אירוע סופ"ש (שישי 10:00 - מוצאי שבת)`;
            btn.addEventListener('click', () => this.selectSlot(date, 'weekend'));
            slotOptions.appendChild(btn);
        }
    } else {
        // ✅ Weekday - לוגיקה מעודכנת
        const morningBooked = bookedSlots.includes('morning');
        const eveningBooked = bookedSlots.includes('evening');
        const hasAnyEvent = bookedSlots.length > 0;

        if (hasAnyEvent) {
            // ⚠️ יש אירוע ביום - הפנייה לתיאום עם כרמית
            this.showCoordinationMessage(slotOptions, date, dayOfWeek, bookedSlots);
        } else {
            // יום פנוי לחלוטין - אפשרות לבחור בוקר או ערב
            const selectedPricing = document.querySelector('input[name="pricing"]:checked');
            const pricingValue = selectedPricing ? selectedPricing.value : '';
            const isWeekendPricing = pricingValue.includes('weekend');

            if (isWeekendPricing) {
                const notice = document.createElement('p');
                notice.textContent = '⚠️ בחרתם תעריף סופ"ש - אנא בחרו יום שישי';
                notice.style.color = '#f44336';
                notice.style.fontWeight = '700';
                slotOptions.appendChild(notice);
            } else {
                // Morning button
                const morningBtn = document.createElement('button');
                morningBtn.className = 'slot-btn';
                morningBtn.textContent = `🌅 אירוע בוקר (06:00 - 12:00)`;
                morningBtn.addEventListener('click', () => this.selectSlot(date, 'morning'));
                slotOptions.appendChild(morningBtn);

                // Evening button
                const eveningBtn = document.createElement('button');
                eveningBtn.className = 'slot-btn';
                eveningBtn.textContent = `🌙 אירוע ערב (13:00 - 23:00)`;
                eveningBtn.addEventListener('click', () => this.selectSlot(date, 'evening'));
                slotOptions.appendChild(eveningBtn);
            }
        }
    }

    modal.style.display = 'flex';
}

// ✅ פונקציה מעודכנת להצגת הודעת תיאום דינמית
showCoordinationMessage(container, date, dayOfWeek, bookedSlots) {
    const hebrewDate = HebrewDateConverter.getHebrewDate(date);
    const gregDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
    const dayName = HebrewDateConverter.getHebrewDayOfWeek(dayOfWeek);
    
    // ✅ זיהוי מה תפוס ומה פנוי
    let statusMessage = '';
    let availableOptions = '';
    
    if (dayOfWeek === 5) {
        // יום שישי - סופ"ש תפוס
        statusMessage = 'אירוע סופ"ש תפוס';
        availableOptions = 'ניתן לתאם מראש אירוע בוקר או ערב';
    } else {
        // ימי חול
        const morningBooked = bookedSlots.includes('morning');
        const eveningBooked = bookedSlots.includes('evening');
        
        if (morningBooked && eveningBooked) {
            statusMessage = 'אירועי בוקר וערב תפוסים';
            availableOptions = 'ניתן לבדוק אפשרויות חלופיות';
        } else if (morningBooked) {
            statusMessage = 'אירוע בוקר תפוס';
            availableOptions = 'ניתן לתאם מראש אירוע ערב';
        } else if (eveningBooked) {
            statusMessage = 'אירוע ערב תפוס';
            availableOptions = 'ניתן לתאם מראש אירוע בוקר';
        }
    }
    
    const coordinationDiv = document.createElement('div');
    coordinationDiv.className = 'coordination-message';
    coordinationDiv.innerHTML = `
        <div class="coordination-content">
            <div class="date-header">
                יום ${dayName} | ${gregDate} | ${hebrewDate}
            </div>
            <h4>⚠️ התאריך תפוס חלקית</h4>
            <p class="status-message">${statusMessage}</p>
            <p class="available-options">${availableOptions}</p>
            <button class="whatsapp-coordination-btn" onclick="openCoordinationWhatsApp('${gregDate}', '${statusMessage}')">
                <span class="whatsapp-icon">📱</span>
                <div>
                    <strong>לתאום האירוע</strong>
                </div>
            </button>
        </div>
    `;
    
    container.appendChild(coordinationDiv);
}
    selectSlot(date, slot) {
        this.selectedDate = date;
        this.selectedSlot = slot;

        closeSlotModal();

        const display = document.getElementById('selectedDateDisplay');
        const gregDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
        const hebrewDate = HebrewDateConverter.getHebrewDate(date);
        const dayName = HebrewDateConverter.getHebrewDayOfWeek(date.getDay());

        let slotText = '';
        let hoursText = '';
        switch (slot) {
            case 'morning':
                slotText = 'אירוע בוקר';
                hoursText = '06:00 - 12:00';
                break;
            case 'evening':
                slotText = 'אירוע ערב';
                hoursText = '13:00 - 23:00';
                break;
            case 'weekend':
                slotText = 'אירוע סופ"ש';
                hoursText = 'יום שישי 10:00 - מוצאי שבת';
                break;
        }

        display.innerHTML = `
            ✅ נבחר: <strong>יום ${dayName} | ${gregDate} | ${hebrewDate}</strong><br>
            📋 ${slotText} | ⏰ ${hoursText}
        `;
        display.style.display = 'block';

        this.render();
    }

    formatDateKey(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    getSelectedInfo() {
        if (!this.selectedDate || !this.selectedSlot) return null;

        const date = this.selectedDate;
        const gregDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
        const hebrewDate = HebrewDateConverter.getHebrewDate(date);
        const dayName = HebrewDateConverter.getHebrewDayOfWeek(date.getDay());

        let slotText = '';
        let hoursText = '';
        switch (this.selectedSlot) {
            case 'morning':
                slotText = 'אירוע בוקר';
                hoursText = '06:00 - 12:00';
                break;
            case 'evening':
                slotText = 'אירוע ערב';
                hoursText = '13:00 - 23:00';
                break;
            case 'weekend':
                slotText = 'אירוע סופ"ש';
                hoursText = 'יום שישי 10:00 - מוצאי שבת';
                break;
        }

        return {
            date: this.selectedDate,
            dateKey: this.formatDateKey(date),
            slot: this.selectedSlot,
            slotText: slotText,
            hoursText: hoursText,
            gregDate: gregDate,
            hebrewDate: hebrewDate,
            dayName: dayName,
            displayText: `יום ${dayName} | ${gregDate} | ${hebrewDate} | ${slotText} (${hoursText})`
        };
    }
}