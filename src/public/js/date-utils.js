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
 * Show SweetAlert date picker with dd.MM.yyyy format
 * @param {string} title
 * @param {string} defaultDate - in yyyy-mm-dd format
 * @returns {Promise<string|null>} - returns yyyy-mm-dd format or null if cancelled
 */
async function showDatePicker(title, defaultDate) {
    const displayDate = isoToDisplay(defaultDate || new Date().toISOString().split('T')[0]);

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

            // Add input mask for dd.MM.yyyy
            input.addEventListener('input', function(e) {
                let value = e.target.value.replace(/\D/g, '');
                if (value.length >= 2) {
                    value = value.substring(0, 2) + '.' + value.substring(2);
                }
                if (value.length >= 5) {
                    value = value.substring(0, 5) + '.' + value.substring(5);
                }
                if (value.length > 10) {
                    value = value.substring(0, 10);
                }
                e.target.value = value;
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
        return displayToIso(result.value);
    }
    return null;
}
