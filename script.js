// Detect credit/debit card numbers
function isLikelyCardNumber(number) {
    const digits = number.replace(/\D/g, '');

    // Card numbers are 15-16 digits
    if (digits.length < 15 || digits.length > 16) return false;

    // Check known card prefixes
    const cardPrefixes = [
        /^4/,           // Visa
        /^5[1-5]/,      // Mastercard
        /^3[47]/,       // Amex
        /^6(?:011|5)/,  // Discover
        /^36/,          // Diners
        /^2[2-7]/,      // Mastercard (2-series)
    ];

    const hasCardPrefix = cardPrefixes.some(p => p.test(digits));
    if (!hasCardPrefix) return false;

    // Luhn algorithm check
    let sum = 0;
    let isEven = false;
    for (let i = digits.length - 1; i >= 0; i--) {
        let digit = parseInt(digits[i], 10);
        if (isEven) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        isEven = !isEven;
    }
    return sum % 10 === 0;
}

function validateForm() {
    let isValid = true;
    const requiredFields = ['employeeType', 'fullName', 'email', 'nationality', 'dob', 'gender', 'bank', 'accountName', 'accountNumber'];
    const checkboxes = [];
    
    clearErrors();
    
    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!field.value.trim()) {
            showError(field, 'This field is required');
            isValid = false;
        }
    });
    
    const emailField = document.getElementById('email');
    const emailError = validateEmailField(emailField);
    if (emailError) {
        showError(emailField, emailError);
        isValid = false;
    }

    const nricField = document.getElementById('nric');
    if (!nricField.value.trim()) {
        showError(nricField, 'Please provide NRIC/FIN number');
        isValid = false;
    } else {
        const nricError = validateNricField(nricField);
        if (nricError) {
            showError(nricField, nricError);
            isValid = false;
        }
    }

    checkboxes.forEach(checkboxId => {
        const checkbox = document.getElementById(checkboxId);
        if (!checkbox.checked) {
            const label = checkbox.parentElement;
            label.style.color = '#d93025';
            isValid = false;
        }
    });

    const accountNumberField = document.getElementById('accountNumber');
    const accountError = validateAccountNumberField(accountNumberField);
    if (accountError) {
        showError(accountNumberField, accountError);
        isValid = false;
    }
    
    // Validate date fields based on employee type
    const employeeType = document.getElementById('employeeType').value;
    if (employeeType === 'intern_school' || employeeType === 'intern_no_school') {
        const startDate = document.getElementById('startDate');
        const endDate = document.getElementById('endDate');
        if (!startDate.value) {
            showError(startDate, 'Start date is required for interns');
            isValid = false;
        }
        if (!endDate.value) {
            showError(endDate, 'End date is required for interns');
            isValid = false;
        }
    } else if (employeeType === 'fulltime') {
        const startDate = document.getElementById('startDate');
        if (!startDate.value) {
            showError(startDate, 'Start date is required for full-time employees');
            isValid = false;
        }
    }
    
    return isValid;
}

function showError(field, message) {
    field.classList.add('error');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    field.parentElement.appendChild(errorDiv);
}

function clearFieldError(field) {
    field.classList.remove('error');
    const existingError = field.parentElement.querySelector('.error-message');
    if (existingError) existingError.remove();
}

function clearErrors() {
    document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
    document.querySelectorAll('.error-message').forEach(el => el.remove());
    document.querySelectorAll('.checkbox-group label').forEach(el => el.style.color = '');
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Individual field validators - return error message or null
function validateEmailField(field) {
    const value = field.value.trim();
    if (!value) return null; // Don't show required error on blur, only on submit
    if (!isValidEmail(value)) return 'Please enter a valid email address';
    return null;
}

function validateNricField(field) {
    const value = field.value.trim().toUpperCase();
    if (!value) return null; // Don't show required error on blur
    if (value.length === 4 && /^\d{4}$/.test(value)) {
        return 'Please enter your complete 9-character NRIC/FIN, not just the last 4 digits';
    }
    if (value.length !== 9) {
        return 'NRIC/FIN must be exactly 9 characters (e.g., S1234567A)';
    }
    if (!/^[STFGM]\d{7}[A-Z]$/i.test(value)) {
        return 'Invalid format. NRIC/FIN should start with S, T, F, G, or M followed by 7 digits and 1 letter';
    }
    return null;
}

function validateAccountNumberField(field) {
    const value = field.value.trim();
    if (!value) return null; // Don't show required error on blur
    if (!/^\d+$/.test(value)) {
        return 'Account number must contain only digits';
    }
    if (isLikelyCardNumber(value)) {
        return 'This looks like a card number. Please enter your bank account number (usually 9-12 digits).';
    }
    return null;
}

// Blur validation handler
function validateOnBlur(field, validator) {
    clearFieldError(field);
    const error = validator(field);
    if (error) {
        showError(field, error);
        return false;
    }
    return true;
}

// Set up blur listeners
document.addEventListener('DOMContentLoaded', function() {
    const emailField = document.getElementById('email');
    const nricField = document.getElementById('nric');
    const accountNumberField = document.getElementById('accountNumber');

    emailField.addEventListener('blur', () => validateOnBlur(emailField, validateEmailField));
    nricField.addEventListener('blur', () => validateOnBlur(nricField, validateNricField));
    accountNumberField.addEventListener('blur', () => validateOnBlur(accountNumberField, validateAccountNumberField));
});

// Handle employee type changes
document.getElementById('employeeType').addEventListener('change', function() {
    const formDetails = document.getElementById('formDetails');
    const startDateGroup = document.getElementById('startDateGroup');
    const endDateGroup = document.getElementById('endDateGroup');
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    
    // Show the rest of the form when employee type is selected
    if (this.value) {
        formDetails.style.display = 'block';
        // Smooth scroll to the newly revealed section
        setTimeout(() => {
            formDetails.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    } else {
        formDetails.style.display = 'none';
    }
    
    // Reset fields
    startDateGroup.style.display = 'none';
    endDateGroup.style.display = 'none';
    startDate.removeAttribute('required');
    endDate.removeAttribute('required');
    
    switch(this.value) {
        case 'trainer':
            // Trainers don't fill dates, we auto-fill 1st of last month
            break;
        case 'intern_school':
        case 'intern_no_school':
            // Interns need both start and end dates
            startDateGroup.style.display = 'block';
            endDateGroup.style.display = 'block';
            startDate.setAttribute('required', 'true');
            endDate.setAttribute('required', 'true');
            break;
        case 'fulltime':
            // Full-timers only need start date
            startDateGroup.style.display = 'block';
            startDate.setAttribute('required', 'true');
            break;
    }
});

// Track if submission is in progress to prevent multiple submissions
let isSubmitting = false;

// HTTP status code constants
const HTTP_STATUS = {
    OK: 200,
    ACCEPTED: 202
};

async function submitToNetlify(data) {
    // Prevent multiple submissions
    if (isSubmitting) {
        console.log('Submission already in progress, ignoring duplicate request');
        return;
    }
    
    isSubmitting = true;
    
    // Show loading state
    const submitButton = document.querySelector('.btn-submit');
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Submitting...';
    submitButton.disabled = true;
    
    // Add a hard timeout failsafe
    const hardTimeoutId = setTimeout(() => {
        if (isSubmitting) {
            alert('Submission is taking longer than expected.\n\nYour submission may still be processing. Please check your email for confirmation.\n\nIf you don\'t receive confirmation within 5 minutes, please contact HR at hr.onboarding@tinkertanker.com');
            submitButton.textContent = originalText;
            submitButton.disabled = false;
            isSubmitting = false;
        }
    }, 90000); // 90 seconds hard timeout
    
    try {
        // Add timeout to prevent hanging (60 seconds)
        const controller = window.AbortController ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 60000) : null;
        
        const fetchOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        };
        
        // Only add signal if AbortController is supported
        if (controller) {
            fetchOptions.signal = controller.signal;
        }
        
        const response = await fetch('/api/submit-onboarding', fetchOptions);
        
        // Clear timeouts
        if (timeoutId) clearTimeout(timeoutId);
        clearTimeout(hardTimeoutId);
        
        const result = await response.json();
        
        // Accept both 200 (compatibility) and 202 (background processing)
        if (!response.ok && response.status !== HTTP_STATUS.ACCEPTED) {
            throw new Error(result.error || 'Submission failed');
        }
        
        // Success - hide form and show success message
        document.getElementById('onboardingForm').style.display = 'none';
        document.getElementById('successMessage').style.display = 'block';
        
        // Scroll to top
        window.scrollTo(0, 0);
        
        // Reset submission flag
        isSubmitting = false;
        
    } catch (error) {
        console.error('Submission error:', error);
        
        // Clear hard timeout
        clearTimeout(hardTimeoutId);
        
        // Handle timeout specifically
        if (error.name === 'AbortError') {
            alert('Submission timed out after 60 seconds.\n\nThis might mean your submission is still being processed. Please check your email for confirmation before trying again, or contact HR at hr.onboarding@tinkertanker.com');
            submitButton.textContent = originalText;
            submitButton.disabled = false;
            isSubmitting = false;
            return;
        }
        
        // Try to get more specific error info from the response
        let errorMessage = error.message;
        let errorDetails = 'Please try again or contact support.';
        
        if (result && result.details) {
            errorDetails = result.details;
        }
        
        if (result && result.errorType === 'duplicate') {
            errorMessage = 'Already Registered';
            errorDetails = result.details || 'It looks like you\'re already in our system. Please contact HR at hr.onboarding@tinkertanker.com instead of resubmitting.';
        }
        
        // Show error message with better formatting
        alert(`${errorMessage}\n\n${errorDetails}`);
        
        // Reset button
        submitButton.textContent = originalText;
        submitButton.disabled = false;
        isSubmitting = false;
    }
}

document.getElementById('onboardingForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    if (!validateForm()) {
        return;
    }
    
    const formData = new FormData(this);
    const data = {};
    
    for (let [key, value] of formData.entries()) {
        data[key] = value;
    }
    
    // Add computed fields based on employee type
    const employeeType = data.employeeType;
    
    // Set immigration status
    if (employeeType === 'trainer' || employeeType === 'intern_school') {
        data.immigrationStatus = 'Contract (No CPF, No SDL)';
    } else if (employeeType === 'intern_no_school' || employeeType === 'fulltime') {
        if (data.nationality === 'sg_citizen') {
            data.immigrationStatus = 'Singapore Citizen';
        } else if (data.nationality === 'sg_pr') {
            data.immigrationStatus = 'Singapore PR';
        } else {
            data.immigrationStatus = 'Work Pass Holder';
        }
    }
    
    // Set job title
    if (employeeType === 'trainer') {
        data.jobTitle = 'Freelance Trainer';
    } else if (employeeType === 'intern_school' || employeeType === 'intern_no_school') {
        data.jobTitle = 'Tinkercademy Intern';
    }
    
    // Set dates for trainers
    if (employeeType === 'trainer') {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        lastMonth.setDate(1);
        data.startDate = lastMonth.toISOString().split('T')[0];
        
        // Set end date as the day after start date
        const endDate = new Date(lastMonth);
        endDate.setDate(endDate.getDate() + 1);
        data.endDate = endDate.toISOString().split('T')[0];
    }
    
    // Set basic salary (0 for freelancers)
    if (employeeType === 'trainer') {
        data.basicSalary = 0;
    }
    
    // Determine SHG requirement
    if (employeeType === 'intern_no_school' || employeeType === 'fulltime') {
        data.requiresSHG = true;
    } else {
        data.requiresSHG = false;
    }
    
    console.log('Form Data with computed fields:', data);
    
    // Submit to Netlify Function
    submitToNetlify(data);
});