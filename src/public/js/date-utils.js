// Date utility functions for consistent formatting

/**
 * Format date to dd.MM.yyyy
 * @param {Date|string} date
 * @returns {string}
 */
function formatDate(date) {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
}

/**
 * Parse date from dd.MM.yyyy to Date object
 * @param {string} dateStr
 * @returns {Date}
 */
function parseDate(dateStr) {
    if (!dateStr) return new Date();
    const parts = dateStr.split('.');
    if (parts.length === 3) {
        return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return new Date(dateStr);
}

/**
 * Convert yyyy-mm-dd to dd.MM.yyyy
 * @param {string} isoDate
 * @returns {string}
 */
function isoToDisplay(isoDate) {
    if (!isoDate) return '';
    const parts = isoDate.split('-');
    if (parts.length === 3) {
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return isoDate;
}

/**
 * Convert dd.MM.yyyy to yyyy-mm-dd
 * @param {string} displayDate
 * @returns {string}
 */
function displayToIso(displayDate) {
    if (!displayDate) return '';
    const parts = displayDate.split('.');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return displayDate;
}

/**
 * Get last input date from session storage
 * @returns {string|null} - yyyy-mm-dd format or null
 */
function getLastInputDate() {
    return sessionStorage.getItem('lastInputDate');
}

/**
 * Set last input date in session storage
 * @param {string} date - yyyy-mm-dd format
 */
function setLastInputDate(date) {
    sessionStorage.setItem('lastInputDate', date);
}

/**
 * Show SweetAlert date picker with dd.MM.yyyy format
 * Uses session storage for last input date
 * @param {string} title
 * @param {boolean} useSession - if true, uses session date instead of API date
 * @returns {Promise<string|null>} - returns yyyy-mm-dd format or null if cancelled
 */
async function showDatePicker(title, useSession = true) {
    // Use session date if available and requested, otherwise use today
    let defaultDate;
    if (useSession) {
        defaultDate = getLastInputDate() || new Date().toISOString().split('T')[0];
    } else {
        defaultDate = new Date().toISOString().split('T')[0];
    }

    const displayDate = isoToDisplay(defaultDate);

    const result = await Swal.fire({
        title: title,
        html: `
            <input id="swal-date-input" type="text" class="swal2-input"
                   value="${displayDate}"
                   placeholder="DD.MM.YYYY"
                   style="font-size: 1.2em; text-align: center;">
            <small style="display: block; margin-top: 10px; color: #666;">Format: DD.MM.YYYY</small>
        `,
        showCancelButton: true,
        confirmButtonText: 'Tasdiqlash',
        cancelButtonText: 'Bekor qilish',
        didOpen: () => {
            const input = document.getElementById('swal-date-input');
            input.focus();
            // Select all text for easy replacement
            input.select();

            // Add input mask for dd.MM.yyyy
            input.addEventListener('input', function(e) {
                let cursorPosition = e.target.selectionStart;
                let value = e.target.value.replace(/\D/g, '');

                // Format: DD.MM.YYYY
                let formatted = '';
                if (value.length > 0) {
                    formatted = value.substring(0, 2);
                }
                if (value.length >= 3) {
                    formatted += '.' + value.substring(2, 4);
                }
                if (value.length >= 5) {
                    formatted += '.' + value.substring(4, 8);
                }

                // Limit to 10 characters (DD.MM.YYYY)
                if (formatted.length > 10) {
                    formatted = formatted.substring(0, 10);
                }

                const oldLength = e.target.value.length;
                e.target.value = formatted;
                const newLength = formatted.length;

                // Fix cursor position
                if (newLength > oldLength) {
                    // Dots were added automatically
                    if (formatted[cursorPosition] === '.') {
                        cursorPosition++;
                    }
                }

                e.target.setSelectionRange(cursorPosition, cursorPosition);
            });

            // Allow enter key to confirm
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    Swal.clickConfirm();
                }
            });
        },
        preConfirm: () => {
            const value = document.getElementById('swal-date-input').value;
            if (!value) {
                Swal.showValidationMessage('Sana kiritilishi kerak!');
                return false;
            }

            // Validate date format
            const parts = value.split('.');
            if (parts.length !== 3) {
                Swal.showValidationMessage('Noto\'g\'ri format! DD.MM.YYYY formatida kiriting');
                return false;
            }

            const day = parseInt(parts[0]);
            const month = parseInt(parts[1]);
            const year = parseInt(parts[2]);

            if (day < 1 || day > 31) {
                Swal.showValidationMessage('Kun 1-31 oralig\'ida bo\'lishi kerak');
                return false;
            }
            if (month < 1 || month > 12) {
                Swal.showValidationMessage('Oy 1-12 oralig\'ida bo\'lishi kerak');
                return false;
            }
            if (year < 2000 || year > 2100) {
                Swal.showValidationMessage('Yil 2000-2100 oralig\'ida bo\'lishi kerak');
                return false;
            }

            return value;
        }
    });

    if (result.isConfirmed && result.value) {
        const isoDate = displayToIso(result.value);
        // Save to session storage
        setLastInputDate(isoDate);
        return isoDate;
    }
    return null;
}
