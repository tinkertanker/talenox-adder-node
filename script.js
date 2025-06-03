let currentPage = 1;

function updateProgressBar() {
    const progressBar = document.getElementById('progressBar');
    progressBar.style.width = currentPage === 1 ? '50%' : '100%';
}

function nextPage() {
    if (validatePage1()) {
        document.getElementById('page1').style.display = 'none';
        document.getElementById('page2').style.display = 'block';
        currentPage = 2;
        updateProgressBar();
        window.scrollTo(0, 0);
    }
}

function prevPage() {
    document.getElementById('page2').style.display = 'none';
    document.getElementById('page1').style.display = 'block';
    currentPage = 1;
    updateProgressBar();
    window.scrollTo(0, 0);
}

function validatePage1() {
    let isValid = true;
    const requiredFields = ['fullName', 'email', 'employeeId'];
    const checkboxes = ['understandLastName', 'fillEverything', 'completedTalenox'];
    
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
    const eligibleCheckbox = document.getElementById('eligibleWork');
    if (!nricField.value.trim() && !eligibleCheckbox.checked) {
        showError(nricField, 'Please provide NRIC or confirm eligibility');
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
    
    return isValid;
}

function validatePage2() {
    let isValid = true;
    const requiredFields = ['dob', 'bank', 'accountName', 'accountNumber'];
    
    clearErrors();
    
    requiredFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!field.value.trim()) {
            showError(field, 'This field is required');
            isValid = false;
        }
    });
    
    const accountNumber = document.getElementById('accountNumber').value;
    if (accountNumber && !/^\d+$/.test(accountNumber)) {
        showError(document.getElementById('accountNumber'), 'Account number must contain only digits');
        isValid = false;
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

document.getElementById('eligibleWork').addEventListener('change', function() {
    const nricField = document.getElementById('nric');
    if (this.checked) {
        nricField.removeAttribute('required');
        nricField.value = '';
        nricField.disabled = true;
        nricField.style.backgroundColor = '#f5f5f5';
    } else {
        nricField.setAttribute('required', 'true');
        nricField.disabled = false;
        nricField.style.backgroundColor = '';
    }
});

document.getElementById('onboardingForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    if (!validatePage2()) {
        return;
    }
    
    const formData = new FormData(this);
    const data = {};
    
    for (let [key, value] of formData.entries()) {
        data[key] = value;
    }
    
    console.log('Form Data:', data);
    
    alert('Form submitted successfully! In a real implementation, this would send data to your server.');
});

updateProgressBar();