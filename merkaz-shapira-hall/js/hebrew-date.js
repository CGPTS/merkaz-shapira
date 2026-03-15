// ============================================
// Hebrew Date Converter
// תאריכים עבריים מסורתיים עם אותיות
// ============================================

class HebrewDateConverter {

    // ---- מספר עברי לאותיות ----
    static numberToHebrewLetters(num) {
        const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
        const tens = ['', 'י', 'כ', 'ל'];

        if (num === 15) return 'ט"ו';
        if (num === 16) return 'ט"ז';

        if (num <= 9) {
            return ones[num] + "'";
        }

        const ten = Math.floor(num / 10);
        const one = num % 10;

        if (one === 0) {
            return tens[ten] + "'";
        }

        return tens[ten] + '"' + ones[one];
    }

    // ---- קבלת יום עברי כמספר ----
    static getHebrewDayNumber(date) {
        try {
            const formatter = new Intl.DateTimeFormat('en-u-ca-hebrew', {
                day: 'numeric'
            });
            return parseInt(formatter.format(date));
        } catch (e) {
            return 0;
        }
    }

    // ---- קבלת חודש עברי כמספר ----
    static getHebrewMonthNumber(date) {
        try {
            const formatter = new Intl.DateTimeFormat('en-u-ca-hebrew', {
                month: 'numeric'
            });
            return parseInt(formatter.format(date));
        } catch (e) {
            return 0;
        }
    }

    // ---- קבלת שנה עברית ----
    static getHebrewYear(date) {
        try {
            const formatter = new Intl.DateTimeFormat('en-u-ca-hebrew', {
                year: 'numeric'
            });
            return parseInt(formatter.format(date));
        } catch (e) {
            return 0;
        }
    }

    // ---- בדיקה אם שנה מעוברת ----
    static isHebrewLeapYear(hebrewYear) {
        return [3, 6, 8, 11, 14, 17, 19].includes(hebrewYear % 19);
    }

    // ---- שמות חודשים עבריים ----
    static getHebrewMonthNameByNumber(monthNum, hebrewYear) {
        const isLeap = this.isHebrewLeapYear(hebrewYear);

        const monthNames = {
            1: 'תשרי',
            2: 'חשוון',
            3: 'כסלו',
            4: 'טבת',
            5: 'שבט',
            6: isLeap ? 'אדר א\'' : 'אדר',
            7: isLeap ? 'אדר ב\'' : 'ניסן',
            8: isLeap ? 'ניסן' : 'אייר',
            9: isLeap ? 'אייר' : 'סיוון',
            10: isLeap ? 'סיוון' : 'תמוז',
            11: isLeap ? 'תמוז' : 'אב',
            12: isLeap ? 'אב' : 'אלול',
            13: isLeap ? 'אלול' : ''
        };

        return monthNames[monthNum] || '';
    }

    // ---- תאריך עברי מלא: "כ"ג אדר" ----
    static getHebrewDate(date) {
        try {
            const day = this.getHebrewDayNumber(date);
            const month = this.getHebrewMonthNumber(date);
            const year = this.getHebrewYear(date);

            const dayLetters = this.numberToHebrewLetters(day);
            const monthName = this.getHebrewMonthNameByNumber(month, year);

            return `${dayLetters} ${monthName}`;
        } catch (e) {
            return '';
        }
    }

    // ---- תאריך עברי קצר ללוח שנה: "כ"ג" ----
    static getHebrewDateShort(date) {
        try {
            const day = this.getHebrewDayNumber(date);
            return this.numberToHebrewLetters(day);
        } catch (e) {
            return '';
        }
    }

    // ---- שם יום בשבוע ----
    static getHebrewDayOfWeek(dayIndex) {
        const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
        return days[dayIndex];
    }

    // ---- שם חודש לועזי ----
    static getHebrewMonthName(monthIndex) {
        const months = [
            'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
            'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
        ];
        return months[monthIndex];
    }
}