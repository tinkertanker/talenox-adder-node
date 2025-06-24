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
  
  // Based on the screenshots, these fields seem to be working:
  // - first_name (showing as "Testing")
  // - email (showing as "yjsoon@me.com") 
  // - hired_date/resign_date (showing May 1-2, 2025)
  // - gender (showing "Male")
  // - nationality (showing "Singaporean")
  // - immigration_status (showing "Contract (No CPF, No SDL)")
  
  // Combine working fields from before with new discoveries
  return {
    // Fields that definitely work (keep from before)
    first_name: formData.fullName, // This worked before
    email: formData.email,
    gender: formData.gender.charAt(0).toUpperCase() + formData.gender.slice(1),
    nationality: nationalityMap[formData.nationality] || 'Foreigner',
    hired_date: hiredDate, // This worked before
    resign_date: resignDate || null, // This worked before
    birthdate: formData.dob, // This worked before
    
    // NRIC field that works
    ssn: formData.nric, // This worked in the last test
    
    // Try additional field combinations
    name: formData.fullName, // Also try this
    last_name: '', // Always empty
    date_of_birth: formData.dob, // Also try this format
    employment_start_date: hiredDate,
    employment_end_date: resignDate || null,
    
    // Banking - try multiple field name variations
    bank_name: formData.bank,
    bank: formData.bank,
    account_holder_name: formData.accountName,
    account_name: formData.accountName,
    bank_account_name: formData.accountName,
    account_number: formData.accountNumber,
    bank_account_number: formData.accountNumber,
    bank_account_no: formData.accountNumber,
    
    // Job information - try multiple variations
    job_title: formData.jobTitle,
    position: formData.jobTitle,
    designation: formData.jobTitle,
    role: formData.jobTitle,
    
    // Additional info
    employee_type: formData.employeeType,
    requires_shg: formData.requiresSHG || false,
    country_id: 'SG'
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
    
    // Check if API key is configured
    if (!process.env.TALENOX_API_KEY || !process.env.TALENOX_API_URL) {
      console.error('Talenox API credentials not configured');
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'API configuration error',
          details: 'Talenox API is not properly configured. Please contact support.'
        })
      };
    }
    
    // Call Talenox API
    console.log('Calling Talenox API...');
    console.log('Sending data:', redactSensitiveData(talenoxData));
    console.log('API URL:', `${process.env.TALENOX_API_URL}/employees`);
    
    const talenoxResponse = await fetch(`${process.env.TALENOX_API_URL}/employees`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TALENOX_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(talenoxData)
    });
    
    if (!talenoxResponse.ok) {
      const errorText = await talenoxResponse.text();
      console.error('Talenox API error:', talenoxResponse.status, errorText);
      
      let errorMessage = 'Failed to create employee in Talenox';
      try {
        const errorData = JSON.parse(errorText);
        console.error('Error details:', errorData);
        if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch (e) {
        // Not JSON error response
      }
      
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: errorMessage,
          details: 'Please check the data and try again'
        })
      };
    }
    
    const talenoxResult = await talenoxResponse.json();
    console.log('Talenox API response:', JSON.stringify(talenoxResult, null, 2));
    console.log('Employee created successfully with ID:', talenoxResult.id || talenoxResult.employee_id);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Employee created successfully',
        employeeId: talenoxResult.id || talenoxResult.employee_id || 'Unknown'
      })
    };
    
  } catch (error) {
    console.error('Function error:', error);
    console.error('Error stack:', error.stack);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        details: 'An unexpected error occurred. Please try again.',
        debug: error.message // Add error message for debugging
      })
    };
  }
};