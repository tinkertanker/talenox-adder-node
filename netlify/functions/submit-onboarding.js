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

// Create job for employee based on employee type
const createJobForEmployee = async (employeeId, formData, hiredDate, resignDate) => {
  try {
    // Calculate job start and end dates based on employee type
    let jobStartDate, jobEndDate, jobTitle, amount, department;
    
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1); // First day of next month
    
    if (formData.employeeType === 'trainer') {
      jobTitle = 'Freelance Trainer';
      department = 'Tinkercademy';
      jobStartDate = hiredDate; // Same as hired date
      jobEndDate = resignDate; // Same as resign date
      amount = 0;
    } else if (formData.employeeType === 'intern_school' || formData.employeeType === 'intern_no_school') {
      jobTitle = 'Tinkertanker Intern';
      department = 'Internship';
      jobStartDate = nextMonth.toISOString().split('T')[0]; // Beginning of next month
      
      // End date 3 months later
      const threeMonthsLater = new Date(nextMonth);
      threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
      jobEndDate = threeMonthsLater.toISOString().split('T')[0];
      amount = 800;
    } else if (formData.employeeType === 'fulltime') {
      jobTitle = 'Tinkertanker Full-timer';
      department = 'Operations';
      jobStartDate = nextMonth.toISOString().split('T')[0]; // Beginning of next month
      // Set end date far in future for full-timers (required field)
      const farFuture = new Date(nextMonth);
      farFuture.setFullYear(farFuture.getFullYear() + 10);
      jobEndDate = farFuture.toISOString().split('T')[0];
      amount = 3000;
    }
    
    // Convert dates to DD/MM/YYYY format as shown in API docs
    const formatDate = (dateStr) => {
      const date = new Date(dateStr);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    };
    
    const jobData = {
      employee_id: parseInt(employeeId),
      title: jobTitle,
      job: {
        title: jobTitle,
        department: department,
        start_date: formatDate(jobStartDate),
        end_date: formatDate(jobEndDate),
        currency: 'SGD',
        amount: amount,
        rate_of_pay: 'Monthly',
        remarks: `Auto-created job for ${formData.employeeType}`
      }
    };
    
    console.log('Creating job for employee:', employeeId, 'with data:', jobData);
    
    const jobResponse = await fetch(`${process.env.TALENOX_API_URL}/jobs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.TALENOX_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(jobData)
    });
    
    if (jobResponse.ok) {
      const jobResult = await jobResponse.json();
      console.log('Job created successfully:', jobResult.id);
      return jobResult;
    } else {
      const errorText = await jobResponse.text();
      console.error('Job creation failed:', jobResponse.status, errorText);
      throw new Error(`Job creation failed: ${jobResponse.status}`);
    }
    
  } catch (error) {
    console.error('Error creating job:', error);
    throw error;
  }
};

// Get next employee ID by querying existing employees
const getNextEmployeeId = async () => {
  try {
    const response = await fetch(`${process.env.TALENOX_API_URL}/employees`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.TALENOX_API_KEY}`,
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      const employees = await response.json();
      console.log('Found', employees.length || 0, 'existing employees');
      
      // Log sample employee structure for debugging (first run only)
      if (employees && employees.length > 0 && Math.random() < 0.1) {
        console.log('Sample employee object:', JSON.stringify(employees[0], null, 2));
      }
      
      // Look for Employee ID field (not database ID) - try multiple field names
      let maxEmployeeId = 0;
      const employeeIds = [];
      
      if (employees && employees.length > 0) {
        employees.forEach((emp, index) => {
          // Try multiple possible field names for employee ID
          const possibleFields = [
            'employee_id', 'emp_id', 'employee_no', 'employee_number', 
            'staff_id', 'emp_no', 'employeeId', 'empId'
          ];
          
          let foundId = null;
          for (const field of possibleFields) {
            if (emp[field] && emp[field] !== emp.id) { // Make sure it's not the database ID
              foundId = emp[field];
              break;
            }
          }
          
          if (foundId) {
            employeeIds.push(foundId);
            const numericId = parseInt(foundId.toString().replace(/\D/g, ''), 10);
            if (!isNaN(numericId) && numericId > maxEmployeeId && numericId < 10000) { // Filter out large database IDs
              maxEmployeeId = numericId;
            }
          }
        });
      }
      
      console.log('Found employee IDs:', employeeIds);
      console.log('Highest employee ID found:', maxEmployeeId);
      
      if (maxEmployeeId > 0) {
        const nextId = maxEmployeeId + 1;
        console.log('Next employee ID should be:', nextId);
        return nextId.toString();
      } else {
        // If no employee IDs found, start from 301 (since you mentioned 300+)
        console.log('No existing employee IDs found, starting from 301');
        return '301';
      }
    }
  } catch (error) {
    console.log('Could not fetch existing employees:', error.message);
  }
  
  // Fallback: start from 301
  console.log('Fallback: starting from 301');
  return '301';
};

// Transform data for Talenox API
const transformForTalenox = async (formData) => {
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
  
  // Transform form data to Talenox API format
  return {
    // Core working fields
    first_name: formData.fullName,
    email: formData.email,
    gender: formData.gender.charAt(0).toUpperCase() + formData.gender.slice(1),
    nationality: nationalityMap[formData.nationality] || 'Foreigner',
    hired_date: hiredDate,
    resign_date: resignDate || null,
    birthdate: formData.dob,
    ssn: formData.nric,
    employee_id: await getNextEmployeeId(),
    
    // Banking information (nested structure)
    bank_account_attributes: {
      bank_type: formData.bank,
      account_name: formData.accountName,
      number: formData.accountNumber
    },
    
    // Job information
    job_title: formData.jobTitle,
    position: formData.jobTitle,
    
    // User account creation - automatically create and invite
    invite_user: true,
    
    // Additional metadata
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
    const talenoxData = await transformForTalenox(formData);
    
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
    console.log('Creating employee via Talenox API');
    console.log('Sending data:', redactSensitiveData(talenoxData));
    
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
    const employeeId = talenoxResult.id || talenoxResult.employee_id;
    console.log('Employee created successfully with ID:', employeeId);
    
    // Create job for the employee
    let jobResult = null;
    try {
      jobResult = await createJobForEmployee(employeeId, formData, talenoxData.hired_date, talenoxData.resign_date);
      console.log('Job created successfully for employee:', employeeId);
    } catch (jobError) {
      console.error('Job creation failed, but employee was created:', jobError);
      // Continue - employee creation succeeded even if job creation failed
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: jobResult ? 'Employee and job created successfully' : 'Employee created successfully (job creation failed)',
        employeeId: employeeId || 'Unknown',
        jobId: jobResult ? jobResult.id : null
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
        debug: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};