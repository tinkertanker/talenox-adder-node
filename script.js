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
    if (emailField.value && !isValidEmail(emailField.value)) {
        showError(emailField, 'Please enter a valid email address');
        isValid = false;
    }
    
    const nricField = document.getElementById('nric');
    const nricValue = nricField.value.trim().toUpperCase();
    if (!nricValue) {
        showError(nricField, 'Please provide NRIC/FIN number');
        isValid = false;
    } else if (nricValue.length !== 9) {
        if (nricValue.length === 4 && /^\d{4}$/.test(nricValue)) {
            showError(nricField, 'Please enter your complete 9-character NRIC/FIN, not just the last 4 digits');
        } else {
            showError(nricField, 'NRIC/FIN must be exactly 9 characters (e.g., S1234567A)');
        }
        isValid = false;
    } else if (!/^[STFGM]\d{7}[A-Z]$/i.test(nricValue)) {
        showError(nricField, 'Invalid format. NRIC/FIN should start with S, T, F, G, or M followed by 7 digits and 1 letter');
        isValid = false;
    }
    
    checkboxes.forEach(checkboxId => {
        const checkbox = document.getElementById(checkboxId);
        if (!checkbox.checked) {
            const label = checkbox.parentElement;
            label.style.color = '#d93025';
            isValid = false;
        }
    });
    
    const accountNumber = document.getElementById('accountNumber').value;
    if (accountNumber && !/^\d+$/.test(accountNumber)) {
        showError(document.getElementById('accountNumber'), 'Account number must contain only digits');
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

function clearErrors() {
    document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
    document.querySelectorAll('.error-message').forEach(el => el.remove());
    document.querySelectorAll('.checkbox-group label').forEach(el => el.style.color = '');
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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
        
        const response = await fetch('/.netlify/functions/submit-onboarding-background', fetchOptions);
        
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