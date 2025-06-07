// Netlify Function to handle onboarding form submission and Talenox API integration

// Helper function to redact sensitive data for logging
const redactSensitiveData = (data) => {
  const redacted = { ...data };
  if (redacted.nric) redacted.nric = redacted.nric.substring(0, 1) + '****' + redacted.nric.slice(-1);
  if (redacted.accountNumber) redacted.accountNumber = '****' + redacted.accountNumber.slice(-4);
  return redacted;
};

// Validate NRIC/FIN format (Singapore specific)
const validateNRIC = (nric) => {
  // Basic format check - starts with S, T, F, G, or M followed by 7 digits and 1 letter
  const nricRegex = /^[STFGM]\d{7}[A-Z]$/i;
  return nricRegex.test(nric);
};

// Validate required fields based on employee type
const validateFormData = (data) => {
  const errors = [];
  
  // Required for all
  if (!data.employeeType) errors.push('Employee type is required');
  if (!data.fullName) errors.push('Full name is required');
  if (!data.email) errors.push('Email is required');
  if (!data.nric) errors.push('NRIC/FIN is required');
  if (!data.nationality) errors.push('Nationality is required');
  if (!data.dob) errors.push('Date of birth is required');
  if (!data.gender) errors.push('Gender is required');
  if (!data.bank) errors.push('Bank is required');
  if (!data.accountName) errors.push('Account name is required');
  if (!data.accountNumber) errors.push('Account number is required');
  
  // Validate NRIC format
  if (data.nric && !validateNRIC(data.nric)) {
    errors.push('Invalid NRIC/FIN format');
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (data.email && !emailRegex.test(data.email)) {
    errors.push('Invalid email format');
  }
  
  // Validate dates based on employee type
  if (data.employeeType === 'intern_school' || data.employeeType === 'intern_no_school') {
    if (!data.startDate) errors.push('Start date is required for interns');
    if (!data.endDate) errors.push('End date is required for interns');
    
    // Check that end date is after start date
    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      if (end <= start) {
        errors.push('End date must be after start date');
      }
    }
  } else if (data.employeeType === 'fulltime') {
    if (!data.startDate) errors.push('Start date is required for full-time employees');
  }
  
  // Validate account number (digits only)
  if (data.accountNumber && !/^\d+$/.test(data.accountNumber)) {
    errors.push('Account number must contain only digits');
  }
  
  return errors;
};

// Transform data for Talenox API
const transformForTalenox = (formData) => {
  // Map nationality to Talenox format
  const nationalityMap = {
    'sg_citizen': 'Singaporean',
    'sg_pr': 'Singapore PR',
    'other': 'Foreigner'
  };
  
  // For trainers, calculate 1st of last month if no start date provided
  let hiredDate = formData.startDate;
  let resignDate = formData.endDate;
  
  if (formData.employeeType === 'trainer') {
    if (!hiredDate) {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      lastMonth.setDate(1);
      hiredDate = lastMonth.toISOString().split('T')[0];
    }
    
    // Always set resign date as day after hired date for trainers
    const endDate = new Date(hiredDate);
    endDate.setDate(endDate.getDate() + 1);
    resignDate = endDate.toISOString().split('T')[0];
  }
  
  return {
    // Personal Information
    first_name: formData.fullName,
    last_name: '', // Always empty per Talenox requirement
    email: formData.email,
    identification_number: formData.nric,
    date_of_birth: formData.dob,
    gender: formData.gender.charAt(0).toUpperCase() + formData.gender.slice(1),
    nationality: nationalityMap[formData.nationality] || 'Foreigner',
    
    // Employment Information
    immigration_status: formData.immigrationStatus,
    hired_date: hiredDate,
    resign_date: resignDate || null,
    job_title: formData.jobTitle,
    basic_salary: formData.basicSalary || 0,
    
    // Banking Information
    bank_name: formData.bank,
    bank_account_name: formData.accountName,
    bank_account_number: formData.accountNumber,
    
    // Additional fields that might be required
    employee_type: formData.employeeType,
    requires_shg: formData.requiresSHG || false
  };
};

// Main handler function
exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }
  
  try {
    // Parse request body
    const formData = JSON.parse(event.body);
    
    // Log request (with sensitive data redacted)
    console.log('Received submission:', redactSensitiveData(formData));
    
    // Validate form data
    const validationErrors = validateFormData(formData);
    if (validationErrors.length > 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          error: 'Validation failed', 
          details: validationErrors 
        })
      };
    }
    
    // Transform data for Talenox
    const talenoxData = transformForTalenox(formData);
    
    // TODO: Call Talenox API
    // This is where you'll add the actual API call once you have credentials
    if (!process.env.TALENOX_API_KEY) {
      console.log('Talenox API key not configured - skipping API call');
      console.log('Would send to Talenox:', redactSensitiveData(talenoxData));
      
      // For now, simulate success
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          message: 'Form submitted successfully (API integration pending)',
          employeeId: 'DEMO-' + Date.now()
        })
      };
    }
    
    // Actual Talenox API call (when credentials are available)
    const talenoxResponse = await fetch(`${process.env.TALENOX_API_URL}/employees`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TALENOX_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(talenoxData)
    });
    
    if (!talenoxResponse.ok) {
      const errorData = await talenoxResponse.json();
      console.error('Talenox API error:', errorData);
      
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Failed to create employee in Talenox',
          details: 'Please try again or contact support'
        })
      };
    }
    
    const talenoxResult = await talenoxResponse.json();
    console.log('Employee created successfully:', talenoxResult.id);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Employee created successfully',
        employeeId: talenoxResult.id
      })
    };
    
  } catch (error) {
    console.error('Function error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        details: 'An unexpected error occurred. Please try again.'
      })
    };
  }
};