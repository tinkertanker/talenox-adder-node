// Netlify Function to handle onboarding form submission and Talenox API integration

// Initialize Resend for email notifications
const { Resend } = require('resend');

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
  if (!data.citizenshipStatus) errors.push('Citizenship status is required');
  if (!data.dob) errors.push('Date of birth is required');
  if (!data.gender) errors.push('Gender is required');
  if (!data.bank) errors.push('Bank is required');
  if (!data.accountName) errors.push('Account name is required');
  if (!data.accountNumber) errors.push('Account number is required');
  
  // Validate NRIC format with specific error messages
  if (data.nric) {
    const nricValue = data.nric.trim();
    if (nricValue.length !== 9) {
      if (nricValue.length === 4 && /^\d{4}$/.test(nricValue)) {
        errors.push('Please enter your complete 9-character NRIC/FIN, not just the last 4 digits');
      } else {
        errors.push('NRIC/FIN must be exactly 9 characters (e.g., S1234567A)');
      }
    } else if (!validateNRIC(nricValue)) {
      errors.push('Invalid NRIC/FIN format. It should start with S, T, F, G, or M followed by 7 digits and 1 letter');
    }
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
const createJobForEmployee = async (employeeId, formData, hiredDate, resignDate, requestId = 'unknown') => {
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
    
    console.log(`[${requestId}] Creating job for employee:`, employeeId, 'with data:', jobData);
    
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
      console.log(`[${requestId}] Job created successfully:`, jobResult.id);
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

// Maximum employee ID to consider valid (filters out database IDs)
const MAX_VALID_EMPLOYEE_ID = 10000;

// Get next employee ID by querying existing employees
const getNextEmployeeId = async () => {
  try {
    // Fetch only recent employees to find the highest ID (faster)
    const response = await fetch(`${process.env.TALENOX_API_URL}/employees?per=50&sort=-created_at`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.TALENOX_API_KEY}`,
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      const employees = await response.json();
      console.log('Found', employees.length || 0, 'existing employees');
      
      // Log sample employee structure for debugging (only in development)
      if (employees && employees.length > 0 && process.env.NODE_ENV === 'development') {
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
            if (!isNaN(numericId) && numericId > maxEmployeeId && numericId < MAX_VALID_EMPLOYEE_ID) { // Filter out large database IDs
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

// Send HR notification email
const sendHRNotification = async (formData, talenoxEmployeeId, jobId, internalEmployeeId) => {
  // Check if Resend is configured
  if (!process.env.RESEND_API_KEY || !process.env.NOTIFY_EMAIL) {
    console.log('Resend not configured, skipping notification');
    return;
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    const employeeTypeText = {
      'trainer': 'Freelance Trainer',
      'intern_school': 'Intern with School Letter',
      'intern_no_school': 'Intern without School Letter',
      'fulltime': 'Full-time Employee'
    };

    const emailContent = `
New Employee Onboarding Submission

Employee Details:
- Name: ${formData.fullName}
- Employee Type: ${employeeTypeText[formData.employeeType] || formData.employeeType}
- Email: ${formData.email}
- Nationality: ${formData.nationality || 'Not specified'}
- Citizenship Status: ${formData.citizenshipStatus || 'Not specified'}

Talenox Integration:
- Internal Employee ID: ${internalEmployeeId}
- Talenox Database ID: ${talenoxEmployeeId}
- Job ID: ${jobId}
- Status: Successfully created with automatic user account invitation

Next Steps:
- Employee will receive Talenox account invitation email
- Review employee details in Talenox dashboard
- Confirm all information is correct

This is an automated notification from the Tinkercademy onboarding system.
    `.trim();

    await resend.emails.send({
      from: process.env.FROM_EMAIL || 'Tinkercademy Onboarding <hr.onboarding@tinkertanker.com>',
      to: [process.env.NOTIFY_EMAIL || 'hr.onboarding@tinkertanker.com'],
      subject: `New Employee: ${formData.fullName} (${employeeTypeText[formData.employeeType] || formData.employeeType})`,
      text: emailContent
    });

    console.log('Notification sent successfully');
  } catch (error) {
    console.error('Failed to send notification:', error);
    // Don't throw error - email failure shouldn't break the main flow
  }
};

// Send failure notification email
const sendFailureNotification = async (formData, errorType, errorDetails) => {
  // Check if Resend is configured
  if (!process.env.RESEND_API_KEY || !process.env.NOTIFY_EMAIL) {
    console.log('Resend not configured, skipping failure notification');
    return;
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    const employeeTypeText = {
      'trainer': 'Freelance Trainer',
      'intern_school': 'Intern with School Letter',
      'intern_no_school': 'Intern without School Letter',
      'fulltime': 'Full-time Employee'
    };

    const emailContent = `
FAILED Employee Onboarding Submission

Employee Details:
- Name: ${formData.fullName || 'Not provided'}
- Employee Type: ${employeeTypeText[formData.employeeType] || formData.employeeType || 'Unknown'}
- Email: ${formData.email || 'Not provided'}
- Nationality: ${formData.nationality || 'Not provided'}
- Citizenship Status: ${formData.citizenshipStatus || 'Not provided'}

Failure Details:
- Error Type: ${errorType}
- Error Message: ${errorDetails}
- Timestamp: ${new Date().toISOString()}

Action Required:
- Review the error details above
- Check if this requires manual intervention
- Contact the employee if needed to resubmit

This is an automated failure alert from the Tinkercademy onboarding system.
    `.trim();

    await resend.emails.send({
      from: process.env.FROM_EMAIL || 'Tinkercademy Onboarding <hr.onboarding@tinkertanker.com>',
      to: [process.env.NOTIFY_EMAIL || 'hr.onboarding@tinkertanker.com'],
      subject: `⚠️ FAILED Onboarding: ${formData.fullName || 'Unknown'} (${employeeTypeText[formData.employeeType] || 'Unknown'})`,
      text: emailContent
    });

    console.log('Failure notification sent successfully');
  } catch (error) {
    console.error('Failed to send failure notification:', error);
    // Don't throw error - failure notification failure shouldn't break anything
  }
};

// Transform data for Talenox API
const transformForTalenox = async (formData) => {
  // Nationality is defaulted to Singaporean for all employees
  
  // Map citizenship status based on employee type and citizenshipStatus
  const getCitizenshipStatus = (employeeType, citizenshipStatus) => {
    if (employeeType === 'trainer') {
      return 'Contract (No CPF, No SDL)';
    } else if (employeeType === 'intern_school') {
      return 'Contract (No CPF, No SDL)';
    } else if (employeeType === 'intern_no_school') {
      return 'Intern';
    } else if (employeeType === 'fulltime') {
      if (citizenshipStatus === 'sg_citizen') {
        return 'Singapore Citizen';
      } else if (citizenshipStatus === 'sg_pr') {
        return 'Singapore PR';
      } else {
        return 'Singapore Citizen'; // Default for full-timers
      }
    }
    return 'Contract (No CPF, No SDL)'; // Default fallback
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
    identification_full_name: formData.fullName,  // New field: full name as shown in identification
    email: formData.email,
    gender: formData.gender.charAt(0).toUpperCase() + formData.gender.slice(1),
    nationality: formData.nationality || 'Singaporean',
    hired_date: hiredDate,
    resign_date: resignDate || null,
    birthdate: formData.dob,
    ssn: formData.nric,
    employee_id: await getNextEmployeeId(),
    
    // Citizenship status based on employee type and citizenshipStatus
    citizenship: getCitizenshipStatus(formData.employeeType, formData.citizenshipStatus),
    
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

// Main handler function for background processing
exports.handler = async (event) => {
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
  
  // Only allow POST requests (after OPTIONS check)
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
  
  // Parse and validate quickly, then return 202 immediately
  try {
    const formData = JSON.parse(event.body);
    
    // Generate unique request ID for tracking
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    console.log(`[${requestId}] New submission request received`);
    
    // Quick validation before accepting
    const validationErrors = validateFormData(formData);
    if (validationErrors.length > 0) {
      console.log(`[${requestId}] Validation failed:`, validationErrors);
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          error: 'Validation failed', 
          details: validationErrors,
          requestId: requestId 
        })
      };
    }
    
    // Return 202 Accepted immediately for background processing
    console.log(`[${requestId}] Accepted submission for background processing:`, redactSensitiveData(formData));
    
    // Process in background after returning (this runs up to 15 minutes)
    processOnboarding(formData, requestId).catch(error => {
      console.error(`[${requestId}] Background processing failed:`, error);
      // Send failure notification
      sendFailureNotification(formData, 'Background Processing Error', error.message)
        .catch(err => console.error(`[${requestId}] Failed to send error notification:`, err));
    });
    
    // Return immediately - client gets this response right away
    return {
      statusCode: 202,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Your submission has been accepted and is being processed. You will receive a confirmation email shortly.',
        requestId: requestId
      })
    };
    
  } catch (error) {
    console.error('Request parsing error:', error);
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Invalid request',
        details: 'Could not parse request data'
      })
    };
  }
};

// Background processing function - runs after 202 response
async function processOnboarding(formData, requestId) {
  try {
    const startTime = Date.now();
    
    // Log request (with sensitive data redacted)
    console.log(`[${requestId}] Processing submission in background:`, redactSensitiveData(formData));
    
    // Transform data for Talenox (including employee ID generation)
    const transformStart = Date.now();
    const talenoxData = await transformForTalenox(formData);
    console.log(`[${requestId}] [Timing] Data transformation completed in ${Date.now() - transformStart}ms`);
    
    // Check if API key is configured
    if (!process.env.TALENOX_API_KEY || !process.env.TALENOX_API_URL) {
      console.error(`[${requestId}] Talenox API credentials not configured`);
      throw new Error('Talenox API is not properly configured');
    }
    
    // Call Talenox API
    console.log(`[${requestId}] Creating employee via Talenox API`);
    console.log(`[${requestId}] Sending data:`, redactSensitiveData(talenoxData));
    
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
      let errorDetails = errorText;
      let errorType = 'unknown';
      
      try {
        const errorData = JSON.parse(errorText);
        console.error('Talenox Error Response:', {
          status: talenoxResponse.status,
          data: errorData,
          headers: Object.fromEntries(talenoxResponse.headers.entries())
        });
        
        // Try to detect duplicate submissions based on common patterns
        const errorString = JSON.stringify(errorData).toLowerCase();
        if (errorString.includes('duplicate') || 
            errorString.includes('already exist') || 
            errorString.includes('has already been taken') ||
            errorString.includes('unique')) {
          errorType = 'duplicate';
          errorMessage = 'This employee may already be registered';
          errorDetails = 'If you\'ve already submitted this form, please contact HR at hr.onboarding@tinkertanker.com instead of resubmitting.';
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch (e) {
        // Not JSON error response
        console.error('Non-JSON error response:', errorText);
      }
      
      // Send failure notification for Talenox API errors
      await sendFailureNotification(
        formData, 
        `Talenox API Error (${errorType})`, 
        `${errorMessage} (Status: ${talenoxResponse.status})\nRaw Response: ${errorText.substring(0, 500)}`
      );
      
      throw new Error(`${errorMessage} - ${errorType}`);
    }
    
    const talenoxResult = await talenoxResponse.json();
    const employeeId = talenoxResult.id || talenoxResult.employee_id;
    console.log(`[${requestId}] Employee created successfully with ID:`, employeeId);
    console.log(`[${requestId}] [Timing] Employee creation completed in ${Date.now() - startTime}ms`);
    
    // Create job for the employee and send notification email in parallel
    const jobStart = Date.now();
    const [jobResult] = await Promise.allSettled([
      createJobForEmployee(employeeId, formData, talenoxData.hired_date, talenoxData.resign_date, requestId),
      sendHRNotification(formData, employeeId, null, talenoxData.employee_id).catch(err => 
        console.error('Failed to send HR notification:', err)
      )
    ]);
    
    console.log(`[${requestId}] [Timing] Job creation completed in ${Date.now() - jobStart}ms`);
    console.log(`[${requestId}] [Timing] Total execution time: ${Date.now() - startTime}ms`);
    
    // Check job result
    const jobCreated = jobResult.status === 'fulfilled';
    const jobId = jobCreated ? jobResult.value?.id : null;
    
    if (!jobCreated) {
      console.error(`[${requestId}] Job creation failed, but employee was created:`, jobResult.reason);
    } else {
      console.log(`[${requestId}] Job created successfully for employee:`, employeeId);
    }
    
    console.log(`[${requestId}] Background processing completed successfully`);
    return {
      success: true,
      employeeId: employeeId,
      jobId: jobId,
      jobCreated: jobCreated
    };
    
  } catch (error) {
    console.error(`[${requestId}] Background processing error:`, error);
    console.error(`[${requestId}] Error stack:`, error.stack);
    
    // Send failure notification for unexpected errors
    await sendFailureNotification(formData, 'System Error', `Unexpected error: ${error.message}`);
    
    throw error;
  }
}