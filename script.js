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
    if (!nricField.value.trim()) {
        showError(nricField, 'Please provide NRIC/FIN number');
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
    const startDateGroup = document.getElementById('startDateGroup');
    const endDateGroup = document.getElementById('endDateGroup');
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    
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

async function submitToNetlify(data) {
    // Show loading state
    const submitButton = document.querySelector('.btn-submit');
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Submitting...';
    submitButton.disabled = true;
    
    try {
        const response = await fetch('/.netlify/functions/submit-onboarding', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || 'Submission failed');
        }
        
        // Success - hide form and show success message
        document.getElementById('onboardingForm').style.display = 'none';
        document.getElementById('successMessage').style.display = 'block';
        
        // Scroll to top
        window.scrollTo(0, 0);
        
    } catch (error) {
        console.error('Submission error:', error);
        
        // Show error message
        alert('Error submitting form: ' + error.message + '\n\nPlease try again or contact support.');
        
        // Reset button
        submitButton.textContent = originalText;
        submitButton.disabled = false;
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