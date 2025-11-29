// ===================================
// MegaDent POS - Client-side Validation
// ===================================

// Validation Rules
const ValidationRules = {
    required: (value) => value.trim() !== '',
    email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    phone: (value) => /^\+?[0-9]{9,15}$/.test(value.replace(/[\s-]/g, '')),
    number: (value) => !isNaN(value) && value.trim() !== '',
    positiveNumber: (value) => !isNaN(value) && parseFloat(value) > 0,
    min: (value, min) => parseFloat(value) >= parseFloat(min),
    max: (value, max) => parseFloat(value) <= parseFloat(max),
    minLength: (value, length) => value.length >= length,
    maxLength: (value, length) => value.length <= length
};

// Error Messages
const ErrorMessages = {
    required: 'This field is required',
    email: 'Please enter a valid email address',
    phone: 'Please enter a valid phone number',
    number: 'Please enter a valid number',
    positiveNumber: 'Please enter a positive number',
    min: (min) => `Minimum value is ${min}`,
    max: (max) => `Maximum value is ${max}`,
    minLength: (length) => `Minimum length is ${length} characters`,
    maxLength: (length) => `Maximum length is ${length} characters`
};

// Validate Single Field
function validateField(field) {
    const value = field.value;
    const rules = field.dataset.validate ? field.dataset.validate.split('|') : [];
    let isValid = true;
    let errorMessage = '';

    for (const rule of rules) {
        const [ruleName, ruleValue] = rule.split(':');

        if (ruleName === 'required' && !ValidationRules.required(value)) {
            isValid = false;
            errorMessage = ErrorMessages.required;
            break;
        }

        if (value && ruleName === 'email' && !ValidationRules.email(value)) {
            isValid = false;
            errorMessage = ErrorMessages.email;
            break;
        }

        if (value && ruleName === 'phone' && !ValidationRules.phone(value)) {
            isValid = false;
            errorMessage = ErrorMessages.phone;
            break;
        }

        if (value && ruleName === 'number' && !ValidationRules.number(value)) {
            isValid = false;
            errorMessage = ErrorMessages.number;
            break;
        }

        if (value && ruleName === 'positiveNumber' && !ValidationRules.positiveNumber(value)) {
            isValid = false;
            errorMessage = ErrorMessages.positiveNumber;
            break;
        }

        if (value && ruleName === 'min' && !ValidationRules.min(value, ruleValue)) {
            isValid = false;
            errorMessage = ErrorMessages.min(ruleValue);
            break;
        }

        if (value && ruleName === 'max' && !ValidationRules.max(value, ruleValue)) {
            isValid = false;
            errorMessage = ErrorMessages.max(ruleValue);
            break;
        }

        if (value && ruleName === 'minLength' && !ValidationRules.minLength(value, ruleValue)) {
            isValid = false;
            errorMessage = ErrorMessages.minLength(ruleValue);
            break;
        }

        if (value && ruleName === 'maxLength' && !ValidationRules.maxLength(value, ruleValue)) {
            isValid = false;
            errorMessage = ErrorMessages.maxLength(ruleValue);
            break;
        }
    }

    // Update field state
    const errorElement = field.parentElement.querySelector('.form-error');

    if (isValid) {
        field.classList.remove('invalid');
        if (errorElement) errorElement.style.display = 'none';
    } else {
        field.classList.add('invalid');
        if (errorElement) {
            errorElement.textContent = errorMessage;
            errorElement.style.display = 'block';
        }
    }

    return isValid;
}

// Validate Form
function validateForm(form) {
    const fields = form.querySelectorAll('[data-validate]');
    let isValid = true;

    fields.forEach(field => {
        if (!validateField(field)) {
            isValid = false;
        }
    });

    return isValid;
}

// Initialize Validation
function initializeValidation() {
    // Real-time validation on blur
    document.querySelectorAll('[data-validate]').forEach(field => {
        field.addEventListener('blur', function() {
            validateField(this);
        });

        field.addEventListener('input', function() {
            if (this.classList.contains('invalid')) {
                validateField(this);
            }
        });
    });

    // Form submission validation
    document.querySelectorAll('form[data-validate-form]').forEach(form => {
        form.addEventListener('submit', function(e) {
            if (!validateForm(this)) {
                e.preventDefault();
                alert('Please fix the errors in the form');
            }
        });
    });
}

// Auto-format phone numbers
function formatPhone(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.startsWith('998')) {
        value = '+' + value;
    }
    input.value = value;
}

// Initialize on DOM load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeValidation);
} else {
    initializeValidation();
}
