// ============================================
// Main Application Logic
// מערכת שריון אולם מרכז שפירא
// ============================================

// ============================================
// EmailJS Configuration
// ============================================
const EMAILJS_PUBLIC_KEY = '_3WbbEanwh5vq-QX7';      // 🔴 Account → API Keys
const EMAILJS_SERVICE_ID = 'service_hosrbig';       // 🔴 Email Services → Service ID
const EMAILJS_TEMPLATE_ID = 'template_86xmh1t';     // 🔴 Email Templates → Template ID

// Initialize EmailJS
emailjs.init(EMAILJS_PUBLIC_KEY);

// ============================================
// Global Variables
// ============================================
let currentStep = 1;
let calendarManager;
let uploadedFile = null;
let uploadedFileBase64 = null;
let compressedFileBase64 = null;
let orderData = {};

// ============================================
// Image Compression
// ============================================
function compressImage(file, maxSizeKB = 40) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = function () {
                const canvas = document.createElement('canvas');

                let width = img.width;
                let height = img.height;
                const maxWidth = 600;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                let quality = 0.7;
                let result = canvas.toDataURL('image/jpeg', quality);

                while (result.length > maxSizeKB * 1024 && quality > 0.1) {
                    quality -= 0.1;
                    result = canvas.toDataURL('image/jpeg', quality);
                }

                if (result.length > maxSizeKB * 1024) {
                    const scale = 0.5;
                    canvas.width = Math.round(width * scale);
                    canvas.height = Math.round(height * scale);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    result = canvas.toDataURL('image/jpeg', 0.5);
                }

                console.log(`📸 Image compressed: ${Math.round(result.length / 1024)}KB (quality: ${quality.toFixed(1)})`);
                resolve(result);
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ============================================
// Event Day Document Generation
// ============================================
function generateEventDayDocument() {
    const calInfo = orderData.calendarInfo;
    const currentDate = new Date();
    const orderNumber = `MS-${Date.now().toString(36).toUpperCase()}`;
    
    const documentHTML = `
        <div class="event-document">
            <!-- Header -->
            <div class="doc-header">
                <div class="header-logo">🏛️</div>
                <div class="header-info">
                    <h1>דף יום האירוע</h1>
                    <h2>אחוזת אתרוג - מרכז שפיר��</h2>
                    <p class="doc-date">נוצר בתאריך: ${currentDate.toLocaleDateString('he-IL')}</p>
                </div>
            </div>
            
            <!-- Order Details -->
            <div class="doc-section">
                <h3>📋 פרטי ההזמנה</h3>
                <div class="details-grid">
                    <div class="detail-row">
                        <span class="label">מספר הזמנה:</span>
                        <span class="value">${orderNumber}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">שם מלא:</span>
                        <span class="value">${orderData.firstName} ${orderData.lastName}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">טלפון:</span>
                        <span class="value">${orderData.phone}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">סוג אירוע:</span>
                        <span class="value">${orderData.eventType}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">תאריך:</span>
                        <span class="value">יום ${calInfo.dayName} | ${calInfo.gregDate} | ${calInfo.hebrewDate}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">שעות:</span>
                        <span class="value">${calInfo.slotText} (${calInfo.hoursText})</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">סה"כ תשלום:</span>
                        <span class="value price">${orderData.price === 0 ? 'ללא עלות' : '₪' + orderData.price.toLocaleString()}</span>
                    </div>
                </div>
            </div>
            
            <!-- Event Day Procedures -->
            <div class="doc-section">
                <h3>📝 נהלים ליום האירוע</h3>
                
                <div class="procedure-section">
                    <h4>🕐 זמני הגעה ופינוי:</h4>
                    <ul>
                        <li><strong>הגעה:</strong> 30 דקות לפני תחילת האירוע לסידור</li>
                        <li><strong>פינוי:</strong> 30 דקות לאחר סיום לפינוי מלא</li>
                        <li><strong>חשוב:</strong> יש לעמוד בזמנים בדיוק למען הלקוח הבא</li>
                    </ul>
                </div>
                
                <div class="procedure-section">
                    <h4>💰 תשלומים ופיקדון:</h4>
                    <ul>
                        <li><strong>צ'ק פיקדון:</strong> 3,000 ₪ לפקודת "ועד מקומי מרכז שפירא"</li>
                        <li><strong>החזרת פיקדון:</strong> תתבצע לאחר פינוי מלא ובדיקת האולם</li>
                        <li><strong>תקנון:</strong> חתמתם על התקנון - אנא עמדו בו</li>
                    </ul>
                </div>
                
                <div class="procedure-section">
                    <h4>🧹 ניקיון ופינוי:</h4>
                    <ul>
                        <li><strong>פחים:</strong> פינוי כל הפחים לחוץ</li>
                        <li><strong>כיסאות ושולחנות:</strong> הרמה וסידור במקום המיועד</li>
                        <li><strong>רצפה:</strong> טיאוט כללי של שאריות</li>
                        <li><strong>ניקיון יסודי:</strong> על חשבון הוועד</li>
                    </ul>
                </div>
                
                <div class="procedure-section">
                    <h4>🍽️ מטבח וציוד:</h4>
                    <ul>
                        <li><strong>כלים:</strong> שטיפה והחזרה למקום</li>
                        <li><strong>מקררים:</strong> ניקוי והחזרת מוצרים אישיים</li>
                        <li><strong>פלטות וציוד:</strong> ניקוי לאחר שימוש</li>
                        <li><strong>נזקים:</strong> יש לדווח מיידית לאחראי</li>
                    </ul>
                </div>
                
                <div class="procedure-section">
                    <h4>📞 אנשי קשר:</h4>
                    <ul>
                        <li><strong>כרמית (רכזת אולם):</strong> 0523164187</li>
                        <li><strong>חירום:</strong> פנו למספר החירום המקומי</li>
                        <li><strong>בעיות טכניות:</strong> דווחו לוועד המקומי</li>
                    </ul>
                </div>
            </div>
            
            <!-- Footer -->
            <div class="doc-footer">
                <div class="footer-content">
                    <p><strong>שימו ❤️ באולם שלנו - שהוא גם שלכם!</strong></p>
                    <p>נוצר ע"י מערכת הזמנות אולם מרכז שפירא | ${new Date().getFullYear()}</p>
                </div>
            </div>
        </div>
    `;
    
    // Store for download
    window.eventDocumentHTML = documentHTML;
    window.currentOrderNumber = orderNumber;
}

// ============================================
// Document Actions
// ============================================
function downloadEventDocument() {
    if (!window.eventDocumentHTML) return;
    
    const fullHTML = `
        <!DOCTYPE html>
        <html lang="he" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>דף יום האירוע - ${window.currentOrderNumber}</title>
            <style>
                ${getDocumentCSS()}
            </style>
        </head>
        <body>
            ${window.eventDocumentHTML}
        </body>
        </html>
    `;
    
    const blob = new Blob([fullHTML], { type: 'text/html;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `דף_יום_האירוע_${window.currentOrderNumber}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
	
	    // ✅ עדכון ט��סט הכפתור אחרי ההורדה
    setTimeout(() => {
        const downloadBtn = document.querySelector('.btn-download');
        if (downloadBtn) {
            downloadBtn.innerHTML = '✅ הורדה הושלמה';
            downloadBtn.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
        }
    }, 500);
}

function printEventDocument() {
    if (!window.eventDocumentHTML) return;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="he" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>דף יום האירוע - ${window.currentOrderNumber}</title>
            <style>
                ${getDocumentCSS()}
                @media print {
                    body { margin: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            ${window.eventDocumentHTML}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
	    // ✅ עדכון טקסט הכפתור אחרי ההדפסה
    setTimeout(() => {
        const printBtn = document.querySelector('.btn-print');
        if (printBtn) {
            printBtn.innerHTML = '✅ הודפס בהצלחה';
            printBtn.style.background = 'linear-gradient(135deg, #2196F3, #1976D2)';
        }
    }, 1000);
}

function getDocumentCSS() {
    return `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Arial', sans-serif; direction: rtl; line-height: 1.6; color: #333; }
        .event-document { max-width: 800px; margin: 20px auto; padding: 20px; background: white; }
        .doc-header { text-align: center; border-bottom: 3px solid #302b63; padding-bottom: 20px; margin-bottom: 30px; }
        .header-logo { font-size: 50px; margin-bottom: 10px; }
        .header-info h1 { font-size: 28px; color: #302b63; margin-bottom: 5px; }
        .header-info h2 { font-size: 20px; color: #666; margin-bottom: 10px; }
        .doc-date { color: #999; font-size: 14px; }
        .doc-section { margin-bottom: 30px; padding: 20px; border: 2px solid #e0e0e0; border-radius: 10px; }
        .doc-section h3 { color: #302b63; margin-bottom: 20px; font-size: 20px; border-bottom: 2px solid #4CAF50; padding-bottom: 5px; }
        .details-grid { display: grid; gap: 10px; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .label { font-weight: 700; color: #555; }
        .value { color: #333; }
        .value.price { font-weight: 700; color: #4CAF50; font-size: 18px; }
        .procedure-section { margin-bottom: 25px; }
        .procedure-section h4 { color: #302b63; margin-bottom: 10px; font-size: 16px; }
        .procedure-section ul { padding-right: 20px; }
        .procedure-section li { margin-bottom: 8px; line-height: 1.7; }
        .doc-footer { text-align: center; border-top: 2px solid #4CAF50; padding-top: 20px; margin-top: 30px; }
        .footer-content p { margin-bottom: 5px; color: #666; }
        .footer-content p:first-child { font-size: 18px; color: #4CAF50; }
    `;
}

// ============================================
// Step Navigation
// ============================================
function nextStep(step) {
    if (!validateStep(step)) return;

    currentStep = step + 1;
    
    // ✅ Generate document when entering step 7
    if (currentStep === 7) {
        generateEventDayDocument();
    }
    
    showStep(currentStep);
    updateProgressBar();

    if (currentStep === 5) {
        if (!calendarManager) {
            calendarManager = new CalendarManager();
        }
        calendarManager.loadBookedSlots();
    }

    if (currentStep === 6) {
        populateSummary();
    }
}

function prevStep(step) {
    currentStep = step - 1;
    showStep(currentStep);
    updateProgressBar();
}

function showStep(step) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.getElementById(`step${step}`).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function nextStepDirect(step) {
    currentStep = step;
    showStep(step);
    updateProgressBar();

    if (step === 8) {
        document.getElementById('gentleReminder')?.classList.add('hidden');
    }
}

function updateProgressBar() {
    const progress = (currentStep / 8) * 100; // ✅ Updated to 8 steps
    document.getElementById('progressBar').style.width = `${progress}%`;

    document.querySelectorAll('.step-dot').forEach(dot => {
        const dotStep = parseInt(dot.dataset.step);
        dot.classList.remove('active', 'completed');
        if (dotStep === currentStep) {
            dot.classList.add('active');
        } else if (dotStep < currentStep) {
            dot.classList.add('completed');
        }
    });
}

// ============================================
// WhatsApp Integration - Enhanced Coordination
// ============================================
function openCoordinationWhatsApp(selectedDate = '', statusMessage = '') {
    const phoneNumber = "972523164187"; // ישראל + מספר ללא 0
    
    let message = "שלום רב, אני מעוניין לתאם אירוע באולם.";
    
    if (selectedDate && statusMessage) {
        message = `שלום רב, אני מעוניין לתאם אירוע באולם בתאריך ${selectedDate}.\n` +
                 `במערכת מוצג: ${statusMessage}.\n` +
                 `אנא בדקי זמינות והתאמה לוגיסטית לאירוע נוסף באותו יום.`;
    }
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappURL = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
    
    // סגירת המודאל ופתיחת וואטסאפ
    closeSlotModal();
    window.open(whatsappURL, '_blank');
}

// ============================================
// Document Confirmation Toggle
// ============================================
function toggleDocumentSubmit() {
    const checkbox = document.getElementById('documentConfirmation');
    const submitBtn = document.getElementById('step7SubmitBtn');
    
    if (checkbox && submitBtn) {
        if (checkbox.checked) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'שלח הזמנה ←';
            submitBtn.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
        } else {
            submitBtn.disabled = true;
            submitBtn.textContent = 'יש לאשר הורדת המסמך';
            submitBtn.style.background = '#ccc';
        }
    }
}

// ============================================
// Validation
// ============================================
function validateStep(step) {
    switch (step) {
        case 1:
            return true;

        case 2:
            if (!document.getElementById('takanonApproval').checked) {
                showAlert('⚠️ יש לאשר את התקנון כדי להמשיך');
                return false;
            }
            return true;

        case 3:
            const firstName = document.getElementById('firstName').value.trim();
            const lastName = document.getElementById('lastName').value.trim();
            const phone = document.getElementById('phone').value.trim();
            const eventType = document.getElementById('eventType').value;

            if (!firstName) {
                showAlert('⚠️ יש למלא שם פרטי');
                document.getElementById('firstName').focus();
                return false;
            }
            if (!lastName) {
                showAlert('⚠️ יש למלא שם משפחה');
                document.getElementById('lastName').focus();
                return false;
            }
            if (!phone) {
                showAlert('⚠️ יש למלא מספר טלפון');
                document.getElementById('phone').focus();
                return false;
            }

            const cleanPhone = phone.replace(/[\s\-]/g, '');
            const phoneRegex = /^0\d{8,9}$/;
            if (!phoneRegex.test(cleanPhone)) {
                showAlert('⚠️ מספר טלפון לא תקין. דוגמה: 0501234567');
                document.getElementById('phone').focus();
                return false;
            }

            if (!eventType) {
                showAlert('⚠️ יש לבחור סוג אירוע');
                document.getElementById('eventType').focus();
                return false;
            }

            return true;

        case 4:
            const residentCard = document.querySelector('.resident-card.selected');
            if (!residentCard) {
                showAlert('⚠️ יש לבחור סוג תושב');
                return false;
            }

            // רק עבור תושב ותושב חוץ - בדיקת תעריף
            const selectedPricing = document.querySelector('input[name="pricing"]:checked');
            if (!selectedPricing) {
                showAlert('⚠️ יש לבחור תעריף');
                return false;
            }

            return true;

        case 5:
            if (!calendarManager || !calendarManager.selectedDate || !calendarManager.selectedSlot) {
                showAlert('⚠️ יש לב��ור תאריך ומשבצת לאירוע');
                return false;
            }

            const pricingInput = document.querySelector('input[name="pricing"]:checked');
            if (pricingInput) {
                const pricingVal = pricingInput.value;
                const selectedSlot = calendarManager.selectedSlot;

                if (pricingVal.includes('weekend') && selectedSlot !== 'weekend') {
                    showAlert('⚠️ בחרתם תעריף סופ"ש - יש לבחור יום שישי בלוח השנה');
                    return false;
                }
                if (!pricingVal.includes('weekend') && selectedSlot === 'weekend') {
                    showAlert('⚠️ בחרתם תעריף יום חול - יש לבחור יום א\'-ה\' בלוח השנה');
                    return false;
                }
				return true;
            }
			
        case 7:
            const documentConfirmed = document.getElementById('documentConfirmation')?.checked;
            if (!documentConfirmed) {
                showAlert('⚠️ יש לאשר שהורדתם וקראתם את דף יום האירוע');
                return false;
            }
            return true;

        default:
            return true;
    }
}

// ============================================
// Alert Helper
// ============================================
function showAlert(message) {
    alert(message);
}

// ============================================
// Resident Type Selection (Step 4)
// ============================================
function selectResident(type) {
    document.querySelectorAll('.resident-card').forEach(card => {
        card.classList.remove('selected');
    });

    event.currentTarget.classList.add('selected');

    // איפוס בחירת תעריף
    document.querySelectorAll('input[name="pricing"]').forEach(r => {
        r.checked = false;
    });

    // הסתרת כל הסקציות
    document.getElementById('localPricing').style.display = 'none';
    document.getElementById('externalPricing').style.display = 'none';
    // ❌ הסרת השורה: document.getElementById('communityPricing').style.display = 'none';
    document.getElementById('addonSection').style.display = 'none';
    
    switch (type) {
        case 'local':
            document.getElementById('localPricing').style.display = 'block';
            document.getElementById('addonSection').style.display = 'block';
            break;
        case 'external':
            document.getElementById('externalPricing').style.display = 'block';
            document.getElementById('addonSection').style.display = 'block';
            break;
    }

    orderData.residentType = type;
}

// ============================================
// Slot Modal (Calendar)
// ============================================
function closeSlotModal() {
    document.getElementById('slotModal').style.display = 'none';
}

// ============================================
// Image Modal (Takanon)
// ============================================
function openImage(src) {
    const modal = document.getElementById('imageModal');
    document.getElementById('modalImage').src = src;
    modal.classList.add('show');
}

function closeImageModal() {
    document.getElementById('imageModal').classList.remove('show');
}

// ============================================
// File Upload - Updated to enable step 6 button
// ============================================
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
        showAlert('⚠️ ניתן להעלות תמונות בלבד (JPG, PNG, GIF, WebP)');
        event.target.value = '';
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        showAlert('⚠️ הקובץ גדול מדי. הגודל המקסימלי הוא 10MB');
        event.target.value = '';
        return;
    }

    uploadedFile = file;

    try {
        const reader = new FileReader();
        reader.onload = function (e) {
            uploadedFileBase64 = e.target.result;
            document.getElementById('receiptPreviewImg').src = uploadedFileBase64;
        };
        reader.readAsDataURL(file);

        compressedFileBase64 = await compressImage(file, 40);

        document.getElementById('fileName').textContent = file.name;
        document.getElementById('uploadPreview').style.display = 'block';
        
        // ✅ עדכון כפתור שלב 6 במקום submitBtn
        const step6NextBtn = document.getElementById('step6NextBtn');
        if (step6NextBtn) {
            step6NextBtn.disabled = false;
            step6NextBtn.textContent = 'המשך ←';
        }

        console.log('📎 File ready - Original:', Math.round(file.size / 1024) + 'KB',
            '| Compressed for email:', Math.round(compressedFileBase64.length / 1024) + 'KB');

    } catch (error) {
        console.error('Error processing file:', error);
        showAlert('❌ שגיאה בעיבוד הקובץ. נסו שוב.');
    }
}

// ============================================
// Populate Summary (Step 6) - Updated
// ============================================
function populateSummary() {
    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const eventType = document.getElementById('eventType').value;
    const notes = document.getElementById('notes').value.trim();

    let residentText = '';
    switch (orderData.residentType) {
        case 'local':
            residentText = 'תושב הישוב';
            break;
        case 'external':
            residentText = 'תושב חוץ';
            break;
        case 'community':
            residentText = 'אירוע קהילתי';
            break;
    }

    let price = 0;
    const pricingInput = document.querySelector('input[name="pricing"]:checked');
    if (pricingInput) {
        price = parseInt(pricingInput.dataset.price);
    }

    // Check projector addon
    const projectorChecked = document.getElementById('projectorAddon')?.checked || false;
    if (projectorChecked) {
        price += 200;
    }

    // Show/hide projector row in summary
    const projectorRow = document.getElementById('sumProjectorRow');
    if (projectorRow) {
        projectorRow.style.display = projectorChecked ? 'flex' : 'none';
    }

    const calInfo = calendarManager.getSelectedInfo();

    document.getElementById('sumName').textContent = `${firstName} ${lastName}`;
    document.getElementById('sumPhone').textContent = phone;
    document.getElementById('sumEventType').textContent = eventType;
    document.getElementById('sumResident').textContent = residentText;
    document.getElementById('sumDate').textContent = calInfo
        ? `יום ${calInfo.dayName} | ${calInfo.gregDate} | ${calInfo.hebrewDate}`
        : '';
    document.getElementById('sumHours').textContent = calInfo
        ? `${calInfo.slotText} (${calInfo.hoursText})`
        : '';
    document.getElementById('sumNotes').textContent = notes || 'אין';
    document.getElementById('sumTotal').textContent = price === 0
        ? 'ללא עלות'
        : `₪${price.toLocaleString()}`;

    // ✅ עדכון לוגיקת הכפתור
    const step6NextBtn = document.getElementById('step6NextBtn');
    
    if (orderData.residentType === 'community') {
        // אירוע קהילתי - לא צריך העלאת אסמכתא
        document.getElementById('paymentSection').style.display = 'none';
        step6NextBtn.disabled = false;
        step6NextBtn.textContent = 'המשך ←';
    } else {
        // אירועים רגילים - צריך אסמכתא
        document.getElementById('paymentSection').style.display = 'block';
        
        if (compressedFileBase64) {
            step6NextBtn.disabled = false;
            step6NextBtn.textContent = 'המשך ←';
        } else {
            step6NextBtn.disabled = true;
            step6NextBtn.textContent = 'יש להעלות אסמכתא';
        }
    }

    // שמירת הנתונים
    orderData = {
        ...orderData,
        firstName,
        lastName,
        phone,
        eventType,
        notes,
        price,
        residentText,
        projector: projectorChecked,
        calendarInfo: calInfo
    };
}
// ============================================
// Submit Order
// ============================================
async function submitOrder() {
    const loading = document.getElementById('loadingOverlay');
    loading.style.display = 'flex';

    try {
        const orderNumber = `MS-${Date.now().toString(36).toUpperCase()}`;
        const calInfo = orderData.calendarInfo;

        const priceText = orderData.price === 0
            ? 'ללא עלות'
            : `₪${orderData.price.toLocaleString()}`;

        // ---- Save to Firestore ----
        const bookingData = {
            orderNumber: orderNumber,
            firstName: orderData.firstName,
            lastName: orderData.lastName,
            fullName: `${orderData.firstName} ${orderData.lastName}`,
            phone: orderData.phone,
            eventType: orderData.eventType,
            notes: orderData.notes || '',
            residentType: orderData.residentType,
            residentText: orderData.residentText,
            price: orderData.price,
            dateKey: calInfo.dateKey,
            slot: calInfo.slot,
            slotText: calInfo.slotText,
            hoursText: calInfo.hoursText,
            gregDate: calInfo.gregDate,
            hebrewDate: calInfo.hebrewDate,
            dayName: calInfo.dayName,
            hasReceipt: !!compressedFileBase64,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('bookings').add(bookingData);
        console.log('💾 Booking saved to Firestore');

        // ---- Send email via EmailJS ----
        const emailParams = {
            order_number: orderNumber,
            full_name: `${orderData.firstName} ${orderData.lastName}`,
            phone: orderData.phone,
            event_type: orderData.eventType,
            resident_text: orderData.residentText,
            date_display: `יום ${calInfo.dayName} | ${calInfo.gregDate} | ${calInfo.hebrewDate}`,
            hours_display: `${calInfo.slotText} (${calInfo.hoursText})`,
            projector_text: orderData.projector ? 'כן (+₪200)' : 'לא',
            notes: orderData.notes || 'אין',
            total_price: priceText,
            receipt_image: compressedFileBase64 || ''
        };

        console.log(`📧 Email payload size: ${Math.round(JSON.stringify(emailParams).length / 1024)}KB`);

        const emailResult = await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            emailParams
        );

        console.log('📧 Email sent successfully!', emailResult.status);

        // ---- Show success ----
        document.getElementById('orderNumber').textContent = orderNumber;
        loading.style.display = 'none';
        nextStepDirect(8); // ✅ Updated to step 8

    } catch (error) {
        console.error('❌ Error submitting order:', error);
        loading.style.display = 'none';

        if (error.text && error.text.includes('size')) {
            console.log('⚠️ Image too large for email, resending without image...');
            await submitOrderWithoutImage();
        } else if (error.text) {
            showAlert(`❌ שגיאה בשליחת המייל: ${error.text}\nההזמנה נשמרה במערכת.`);
        } else if (error.code) {
            showAlert(`❌ שגיאה בשמירת ההזמנה: ${error.message}`);
        } else {
            showAlert('❌ אירעה שגיאה בשליחת ההזמנה. אנא נסו שוב.');
        }
    }
}

// ============================================
// Fallback: Send without image if too large
// ============================================
async function submitOrderWithoutImage() {
    try {
        const calInfo = orderData.calendarInfo;
        const orderNumber = document.getElementById('orderNumber')?.textContent ||
            `MS-${Date.now().toString(36).toUpperCase()}`;

        const priceText = orderData.price === 0
            ? 'ללא עלות'
            : `₪${orderData.price.toLocaleString()}`;

        const emailResult = await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            {
                order_number: orderNumber,
                full_name: `${orderData.firstName} ${orderData.lastName}`,
                phone: orderData.phone,
                event_type: orderData.eventType,
                resident_text: orderData.residentText,
                date_display: `יום ${calInfo.dayName} | ${calInfo.gregDate} | ${calInfo.hebrewDate}`,
                hours_display: `${calInfo.slotText} (${calInfo.hoursText})`,
                projector_text: orderData.projector ? 'כן (+₪200)' : 'לא',
                notes: orderData.notes || 'אין',
                total_price: priceText,
                receipt_image: ''
            }
        );

        console.log('📧 Email sent without image!', emailResult.status);
        document.getElementById('orderNumber').textContent = orderNumber;
        nextStepDirect(8); // ✅ Updated to step 8

    } catch (error) {
        console.error('❌ Fallback email also failed:', error);
        showAlert('⚠️ ההזמנה נשמרה במערכת בהצלחה!\nאך לא הצלחנו לשלוח מייל. נציג יצור איתכם קשר.');
        nextStepDirect(8); // ✅ Updated to step 8
    }
}

// ============================================
// Initialize App
// ============================================
document.addEventListener('DOMContentLoaded', function () {
    console.log('🏛️ מערכת שריון אולם מרכז שפירא - מופעלת');
    console.log('📧 EmailJS initialized');
    console.log('🔥 Firebase Firestore ready');
    updateProgressBar();

    // Warn user before leaving/refreshing the page
    window.addEventListener('beforeunload', function (e) {
        if (currentStep > 1 && currentStep < 8) { // ✅ Updated to 8
            e.preventDefault();
            e.returnValue = 'ההזמנה לא הושלמה! האם אתה בטוח שברצונך לצאת?';
            return e.returnValue;
        }
    });
});