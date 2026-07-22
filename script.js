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

let currentMode = 'onboarding'; // 'onboarding' | 'update'
let updateCodeSent = false;

function validateForm() {
    let isValid = true;
    const requiredFields = ['fullName', 'email', 'nationality', 'citizenshipStatus', 'dob', 'gender', 'bank', 'accountName', 'accountNumber'];
    const checkboxes = [];

    if (currentMode === 'onboarding') {
        requiredFields.unshift('employeeType');
    }

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

    if (currentMode === 'update') {
        const updateNricField = document.getElementById('updateNric');
        const codeField = document.getElementById('verificationCode');

        if (!updateCodeSent) {
            showError(updateNricField, 'Please request a verification code first');
            isValid = false;
        }

        if (!updateNricField.value.trim()) {
            showError(updateNricField, 'Please provide NRIC/FIN number');
            isValid = false;
        } else {
            const nricError = validateNricField(updateNricField);
            if (nricError) {
                showError(updateNricField, nricError);
                isValid = false;
            }
        }

        if (!codeField.value.trim()) {
            showError(codeField, 'Please enter the verification code from your email');
            isValid = false;
        } else if (!/^\d{6}$/.test(codeField.value.trim())) {
            showError(codeField, 'Verification code must be 6 digits');
            isValid = false;
        }
    } else {
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

    // Date rules only apply to new onboarding
    if (currentMode === 'onboarding') {
        const employeeType = document.getElementById('employeeType').value;
        if (employeeType === 'intern_school') {
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

function validateEmailField(field) {
    const value = field.value.trim();
    if (!value) return null;
    if (!isValidEmail(value)) return 'Please enter a valid email address';
    return null;
}

function validateNricField(field) {
    const value = field.value.trim().toUpperCase();
    if (!value) return null;
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
    if (!value) return null;
    if (!/^\d+$/.test(value)) {
        return 'Account number must contain only digits';
    }
    if (isLikelyCardNumber(value)) {
        return 'This looks like a card number. Please enter your bank account number (usually 9-12 digits).';
    }
    return null;
}

function validateOnBlur(field, validator) {
    clearFieldError(field);
    const error = validator(field);
    if (error) {
        showError(field, error);
        return false;
    }
    return true;
}

function applyEmployeeTypeDateFields(employeeType) {
    const startDateGroup = document.getElementById('startDateGroup');
    const endDateGroup = document.getElementById('endDateGroup');
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');

    startDateGroup.style.display = 'none';
    endDateGroup.style.display = 'none';
    startDate.removeAttribute('required');
    endDate.removeAttribute('required');

    if (currentMode !== 'onboarding') {
        return;
    }

    switch (employeeType) {
        case 'trainer':
            break;
        case 'intern_school':
            startDateGroup.style.display = 'block';
            endDateGroup.style.display = 'block';
            startDate.setAttribute('required', 'true');
            endDate.setAttribute('required', 'true');
            break;
        case 'fulltime':
            startDateGroup.style.display = 'block';
            startDate.setAttribute('required', 'true');
            break;
    }
}

function resetUpdateVerification() {
    updateCodeSent = false;
    const updateNric = document.getElementById('updateNric');
    const verificationCode = document.getElementById('verificationCode');
    const codeSentNotice = document.getElementById('codeSentNotice');
    const verificationCodeGroup = document.getElementById('verificationCodeGroup');
    const sendCodeButton = document.getElementById('sendCodeButton');

    if (updateNric) {
        updateNric.value = '';
        updateNric.readOnly = false;
    }
    if (verificationCode) verificationCode.value = '';
    if (codeSentNotice) codeSentNotice.style.display = 'none';
    if (verificationCodeGroup) verificationCodeGroup.style.display = 'none';
    if (sendCodeButton) {
        sendCodeButton.disabled = false;
        sendCodeButton.textContent = 'Send Verification Code';
    }
}

function setMode(mode) {
    currentMode = mode;

    const onboardingBtn = document.getElementById('modeOnboarding');
    const updateBtn = document.getElementById('modeUpdate');
    const onboardingTypeSection = document.getElementById('onboardingTypeSection');
    const updateIntro = document.getElementById('updateIntro');
    const updateVerifySection = document.getElementById('updateVerifySection');
    const formDetails = document.getElementById('formDetails');
    const onboardingNricGroup = document.getElementById('onboardingNricGroup');
    const employeeType = document.getElementById('employeeType');
    const submitButton = document.getElementById('submitButton');
    const nricField = document.getElementById('nric');
    const pageTitle = document.getElementById('pageTitle');
    const pageSubtitle = document.getElementById('pageSubtitle');

    onboardingBtn.classList.toggle('active', mode === 'onboarding');
    updateBtn.classList.toggle('active', mode === 'update');
    onboardingBtn.setAttribute('aria-pressed', mode === 'onboarding' ? 'true' : 'false');
    updateBtn.setAttribute('aria-pressed', mode === 'update' ? 'true' : 'false');

    clearErrors();
    resetUpdateVerification();

    if (mode === 'update') {
        pageTitle.textContent = 'Update Personal Particulars';
        pageSubtitle.textContent = 'Already onboarded? Update your personal or bank details here.';
        onboardingTypeSection.style.display = 'none';
        updateIntro.style.display = 'block';
        updateVerifySection.style.display = 'block';
        formDetails.style.display = 'none';
        onboardingNricGroup.style.display = 'none';
        nricField.removeAttribute('required');
        employeeType.removeAttribute('required');
        employeeType.value = '';
        submitButton.textContent = 'Update Particulars';
        applyEmployeeTypeDateFields('');
    } else {
        pageTitle.textContent = 'Onboarding: Personal Particulars';
        pageSubtitle.textContent = "Welcome to Tinkercademy. We'll collect your information to get you paid.";
        onboardingTypeSection.style.display = 'block';
        updateIntro.style.display = 'none';
        updateVerifySection.style.display = 'none';
        onboardingNricGroup.style.display = 'block';
        nricField.setAttribute('required', 'true');
        employeeType.setAttribute('required', 'true');
        submitButton.textContent = 'Submit';
        formDetails.style.display = employeeType.value ? 'block' : 'none';
        applyEmployeeTypeDateFields(employeeType.value);
    }
}

async function requestVerificationCode() {
    const updateNricField = document.getElementById('updateNric');
    const sendCodeButton = document.getElementById('sendCodeButton');
    const codeSentNotice = document.getElementById('codeSentNotice');
    const codeSentMessage = document.getElementById('codeSentMessage');
    const verificationCodeGroup = document.getElementById('verificationCodeGroup');
    const formDetails = document.getElementById('formDetails');

    clearFieldError(updateNricField);

    if (!updateNricField.value.trim()) {
        showError(updateNricField, 'Please provide NRIC/FIN number');
        return;
    }

    const nricError = validateNricField(updateNricField);
    if (nricError) {
        showError(updateNricField, nricError);
        return;
    }

    const originalText = sendCodeButton.textContent;
    sendCodeButton.disabled = true;
    sendCodeButton.textContent = 'Sending...';

    try {
        const response = await fetch('/api/update-particulars/request-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nric: updateNricField.value.trim().toUpperCase() })
        });
        const result = await response.json();

        if (!response.ok) {
            const details = Array.isArray(result.details) ? result.details.join('\n') : (result.details || 'Please try again.');
            throw new Error(`${result.error || 'Could not send code'}\n\n${details}`);
        }

        updateCodeSent = true;
        updateNricField.readOnly = true;
        updateNricField.value = updateNricField.value.trim().toUpperCase();

        codeSentMessage.textContent = result.message ||
            'If this NRIC/FIN is on our records, a verification code has been sent to the email address we have on file. Check your inbox (and spam folder).';
        codeSentNotice.style.display = 'block';
        verificationCodeGroup.style.display = 'block';
        formDetails.style.display = 'block';

        sendCodeButton.textContent = 'Resend Code';
        sendCodeButton.disabled = false;

        setTimeout(() => {
            document.getElementById('verificationCode').focus();
        }, 100);
    } catch (error) {
        console.error('Request code error:', error);
        alert(error.message || 'Could not send verification code. Please try again.');
        sendCodeButton.textContent = originalText;
        sendCodeButton.disabled = false;
    }
}

function showSuccessMessage() {
    document.getElementById('onboardingForm').style.display = 'none';
    document.getElementById('successMessage').style.display = 'block';

    const onboardingDetails = document.getElementById('onboardingSuccessDetails');
    const updateDetails = document.getElementById('updateSuccessDetails');
    const successTitle = document.getElementById('successTitle');
    const successSubtitle = document.getElementById('successSubtitle');

    if (currentMode === 'update') {
        successTitle.textContent = 'Particulars Updated';
        successSubtitle.textContent = 'Your particulars have been updated successfully.';
        onboardingDetails.style.display = 'none';
        updateDetails.style.display = 'block';
    } else {
        successTitle.textContent = 'Thank You!';
        successSubtitle.textContent = 'Your information has been received and is being processed.';
        onboardingDetails.style.display = 'block';
        updateDetails.style.display = 'none';
    }

    window.scrollTo(0, 0);
}

function buildOnboardingPayload(data) {
    const employeeType = data.employeeType;

    if (employeeType === 'trainer' || employeeType === 'intern_school') {
        data.immigrationStatus = 'Contract (No CPF, No SDL)';
    } else if (employeeType === 'fulltime') {
        if (data.nationality === 'sg_citizen') {
            data.immigrationStatus = 'Singapore Citizen';
        } else if (data.nationality === 'sg_pr') {
            data.immigrationStatus = 'Singapore PR';
        } else {
            data.immigrationStatus = 'Work Pass Holder';
        }
    }

    if (employeeType === 'trainer') {
        data.jobTitle = 'Freelance Trainer';
    } else if (employeeType === 'intern_school') {
        data.jobTitle = 'Tinkercademy Intern';
    }

    if (employeeType === 'trainer') {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        lastMonth.setDate(1);
        data.startDate = lastMonth.toISOString().split('T')[0];

        const endDate = new Date(lastMonth);
        endDate.setDate(endDate.getDate() + 1);
        data.endDate = endDate.toISOString().split('T')[0];
        data.basicSalary = 0;
    }

    data.requiresSHG = employeeType === 'fulltime';
    return data;
}

// Track if submission is in progress to prevent multiple submissions
let isSubmitting = false;

const HTTP_STATUS = {
    OK: 200,
    ACCEPTED: 202
};

async function submitForm(data, endpoint) {
    if (isSubmitting) {
        console.log('Submission already in progress, ignoring duplicate request');
        return;
    }

    isSubmitting = true;

    const submitButton = document.getElementById('submitButton');
    const originalText = submitButton.textContent;
    submitButton.textContent = currentMode === 'update' ? 'Updating...' : 'Submitting...';
    submitButton.disabled = true;

    let result = null;

    const hardTimeoutId = setTimeout(() => {
        if (isSubmitting) {
            alert('Submission is taking longer than expected.\n\nYour submission may still be processing. Please check with HR if you are unsure.\n\nIf you don\'t receive confirmation within 5 minutes, please contact HR at hr.onboarding@tinkertanker.com');
            submitButton.textContent = originalText;
            submitButton.disabled = false;
            isSubmitting = false;
        }
    }, 90000);

    try {
        const controller = window.AbortController ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 60000) : null;

        const fetchOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        };

        if (controller) {
            fetchOptions.signal = controller.signal;
        }

        const response = await fetch(endpoint, fetchOptions);

        if (timeoutId) clearTimeout(timeoutId);
        clearTimeout(hardTimeoutId);

        result = await response.json();

        // Onboarding may return 202 (background); update particulars returns 200 after sync PUT
        if (!response.ok && response.status !== HTTP_STATUS.ACCEPTED) {
            throw new Error(result.error || 'Submission failed');
        }

        showSuccessMessage();
        isSubmitting = false;
    } catch (error) {
        console.error('Submission error:', error);
        clearTimeout(hardTimeoutId);

        if (error.name === 'AbortError') {
            alert('Submission timed out after 60 seconds.\n\nThis might mean your submission is still being processed. Please check with HR before trying again, or contact hr.onboarding@tinkertanker.com');
            submitButton.textContent = originalText;
            submitButton.disabled = false;
            isSubmitting = false;
            return;
        }

        let errorMessage = error.message;
        let errorDetails = 'Please try again or contact support.';

        if (result && result.details) {
            errorDetails = Array.isArray(result.details)
                ? result.details.join('\n')
                : result.details;
        }

        if (result && result.errorType === 'duplicate') {
            errorMessage = 'Already Registered';
            errorDetails = result.details || 'It looks like you\'re already in our system. Please contact HR at hr.onboarding@tinkertanker.com instead of resubmitting.';
        }

        alert(`${errorMessage}\n\n${errorDetails}`);

        submitButton.textContent = originalText;
        submitButton.disabled = false;
        isSubmitting = false;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const emailField = document.getElementById('email');
    const nricField = document.getElementById('nric');
    const updateNricField = document.getElementById('updateNric');
    const accountNumberField = document.getElementById('accountNumber');

    emailField.addEventListener('blur', () => validateOnBlur(emailField, validateEmailField));
    nricField.addEventListener('blur', () => validateOnBlur(nricField, validateNricField));
    updateNricField.addEventListener('blur', () => validateOnBlur(updateNricField, validateNricField));
    accountNumberField.addEventListener('blur', () => validateOnBlur(accountNumberField, validateAccountNumberField));

    document.getElementById('modeOnboarding').addEventListener('click', () => setMode('onboarding'));
    document.getElementById('modeUpdate').addEventListener('click', () => setMode('update'));
    document.getElementById('sendCodeButton').addEventListener('click', requestVerificationCode);

    // Honour ?mode=update deep link
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'update') {
        setMode('update');
    }
});

document.getElementById('employeeType').addEventListener('change', function() {
    const formDetails = document.getElementById('formDetails');

    if (this.value) {
        formDetails.style.display = 'block';
        setTimeout(() => {
            formDetails.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    } else {
        formDetails.style.display = 'none';
    }

    applyEmployeeTypeDateFields(this.value);
});

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

    if (currentMode === 'update') {
        data.nric = document.getElementById('updateNric').value.trim().toUpperCase();
        data.verificationCode = document.getElementById('verificationCode').value.trim();
        delete data.employeeType;
        delete data.startDate;
        delete data.endDate;
        delete data.updateNric;
        submitForm(data, '/api/update-particulars');
        return;
    }

    const payload = buildOnboardingPayload(data);
    console.log('Form Data with computed fields:', payload);
    submitForm(payload, '/api/submit-onboarding');
});
