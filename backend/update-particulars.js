// Handler for updating existing employee particulars in Talenox

const { Resend } = require('resend');

const redactSensitiveData = (data) => {
  const redacted = { ...data };
  if (redacted.nric) redacted.nric = redacted.nric.substring(0, 1) + '****' + redacted.nric.slice(-1);
  if (redacted.accountNumber) redacted.accountNumber = '****' + redacted.accountNumber.slice(-4);
  return redacted;
};

const validateNRIC = (nric) => {
  const nricRegex = /^[STFGM]\d{7}[A-Z]$/i;
  return nricRegex.test(nric);
};

const validateUpdateFormData = (data) => {
  const errors = [];

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

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (data.email && !emailRegex.test(data.email)) {
    errors.push('Invalid email format');
  }

  if (data.accountNumber && !/^\d+$/.test(data.accountNumber)) {
    errors.push('Account number must contain only digits');
  }

  return errors;
};

const mapCitizenshipStatus = (citizenshipStatus) => {
  if (citizenshipStatus === 'sg_citizen') return 'Singapore Citizen';
  if (citizenshipStatus === 'sg_pr') return 'Singapore PR';
  return null; // Preserve existing Talenox value for "other"
};

const MAX_PAGES = 50;
const PAGE_SIZE = 100;

const findEmployeeByNric = async (nric, requestId = 'unknown') => {
  const normalisedNric = nric.trim().toUpperCase();
  let page = 1;

  while (page <= MAX_PAGES) {
    const response = await fetch(
      `${process.env.TALENOX_API_URL}/employees?per=${PAGE_SIZE}&page=${page}&sort=-created_at`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.TALENOX_API_KEY}`,
          Accept: 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${requestId}] Failed to search employees:`, response.status, errorText);
      throw new Error('Unable to search for your employee record');
    }

    const employees = await response.json();
    const list = Array.isArray(employees) ? employees : (employees.data || employees.employees || []);

    if (!list.length) {
      break;
    }

    const match = list.find((emp) => {
      const ssn = (emp.ssn || emp.identification_number || '').toString().trim().toUpperCase();
      return ssn === normalisedNric;
    });

    if (match) {
      console.log(`[${requestId}] Found employee by NRIC on page ${page}: Talenox ID ${match.id}`);
      return match;
    }

    if (list.length < PAGE_SIZE) {
      break;
    }

    page += 1;
  }

  return null;
};

const buildUpdatePayload = (formData, existingEmployee) => {
  const payload = {
    first_name: formData.fullName,
    identification_full_name: formData.fullName,
    email: formData.email,
    gender: formData.gender.charAt(0).toUpperCase() + formData.gender.slice(1),
    nationality: formData.nationality,
    birthdate: formData.dob,
    bank_account_attributes: {
      bank_type: formData.bank,
      account_name: formData.accountName,
      number: formData.accountNumber
    }
  };

  const citizenship = mapCitizenshipStatus(formData.citizenshipStatus);
  if (citizenship) {
    payload.citizenship = citizenship;
  }

  // Include existing bank account id when available so Talenox updates rather than duplicates
  const existingBank =
    existingEmployee.bank_account ||
    existingEmployee.bank_account_attributes ||
    null;
  if (existingBank && existingBank.id) {
    payload.bank_account_attributes.id = existingBank.id;
  }

  return payload;
};

const sendUpdateHRNotification = async (formData, talenoxEmployeeId, internalEmployeeId) => {
  if (!process.env.RESEND_API_KEY || !process.env.NOTIFY_EMAIL) {
    console.log('Resend not configured, skipping update notification');
    return;
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const emailContent = `
Employee Particulars Update

Employee Details:
- Name: ${formData.fullName}
- Email: ${formData.email}
- Nationality: ${formData.nationality || 'Not specified'}
- Citizenship Status: ${formData.citizenshipStatus || 'Not specified'}
- Bank: ${formData.bank || 'Not specified'}

Talenox Record:
- Internal Employee ID: ${internalEmployeeId || 'Unknown'}
- Talenox Database ID: ${talenoxEmployeeId}
- Status: Particulars updated successfully

Next Steps:
- Review the updated details in Talenox
- Confirm bank and contact information are correct

This is an automated notification from the Tinkercademy onboarding system.
    `.trim();

    await resend.emails.send({
      from: process.env.FROM_EMAIL || 'Tinkercademy Onboarding <hr.onboarding@tinkertanker.com>',
      to: [process.env.NOTIFY_EMAIL || 'hr.onboarding@tinkertanker.com'],
      subject: `Particulars Updated: ${formData.fullName}`,
      text: emailContent
    });

    console.log('Update notification sent successfully');
  } catch (error) {
    console.error('Failed to send update notification:', error);
  }
};

const sendUpdateFailureNotification = async (formData, errorType, errorDetails) => {
  if (!process.env.RESEND_API_KEY || !process.env.NOTIFY_EMAIL) {
    console.log('Resend not configured, skipping update failure notification');
    return;
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const emailContent = `
FAILED Employee Particulars Update

Employee Details:
- Name: ${formData.fullName || 'Not provided'}
- Email: ${formData.email || 'Not provided'}

Failure Details:
- Error Type: ${errorType}
- Error Message: ${errorDetails}
- Timestamp: ${new Date().toISOString()}

Action Required:
- Review the error details above
- Contact the employee if they need to resubmit

This is an automated failure alert from the Tinkercademy onboarding system.
    `.trim();

    await resend.emails.send({
      from: process.env.FROM_EMAIL || 'Tinkercademy Onboarding <hr.onboarding@tinkertanker.com>',
      to: [process.env.NOTIFY_EMAIL || 'hr.onboarding@tinkertanker.com'],
      subject: `⚠️ FAILED Particulars Update: ${formData.fullName || 'Unknown'}`,
      text: emailContent
    });

    console.log('Update failure notification sent successfully');
  } catch (error) {
    console.error('Failed to send update failure notification:', error);
  }
};

exports.handler = async (event) => {
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

  try {
    const formData = JSON.parse(event.body);
    const requestId = `upd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    console.log(`[${requestId}] New particulars update request received`);

    const validationErrors = validateUpdateFormData(formData);
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
          requestId
        })
      };
    }

    if (!process.env.TALENOX_API_KEY || !process.env.TALENOX_API_URL) {
      console.error(`[${requestId}] Talenox API credentials not configured`);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Configuration error',
          details: 'Talenox API is not properly configured'
        })
      };
    }

    // Look up the employee before accepting so we can return a clear not-found error
    let existingEmployee;
    try {
      existingEmployee = await findEmployeeByNric(formData.nric, requestId);
    } catch (lookupError) {
      console.error(`[${requestId}] Employee lookup failed:`, lookupError);
      return {
        statusCode: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Lookup failed',
          details: 'Unable to search for your employee record. Please try again shortly.',
          requestId
        })
      };
    }

    if (!existingEmployee) {
      console.log(`[${requestId}] No employee found for provided NRIC`);
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Employee not found',
          details: 'No employee record matched that NRIC/FIN. Please check your details or contact HR at hr.onboarding@tinkertanker.com.',
          requestId
        })
      };
    }

    console.log(`[${requestId}] Accepted update for background processing:`, redactSensitiveData(formData));

    processParticularsUpdate(formData, existingEmployee, requestId).catch((error) => {
      console.error(`[${requestId}] Background update processing failed:`, error);
      sendUpdateFailureNotification(formData, 'Background Processing Error', error.message)
        .catch((err) => console.error(`[${requestId}] Failed to send error notification:`, err));
    });

    return {
      statusCode: 202,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Your particulars update has been accepted and is being processed.',
        requestId
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

async function processParticularsUpdate(formData, existingEmployee, requestId) {
  try {
    const startTime = Date.now();
    console.log(`[${requestId}] Processing particulars update:`, redactSensitiveData(formData));

    const talenoxId = existingEmployee.id;
    const internalEmployeeId = existingEmployee.employee_id;
    const updatePayload = buildUpdatePayload(formData, existingEmployee);

    console.log(`[${requestId}] Updating employee ${talenoxId}:`, redactSensitiveData(updatePayload));

    const updateResponse = await fetch(`${process.env.TALENOX_API_URL}/employees/${talenoxId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${process.env.TALENOX_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(updatePayload)
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error(`[${requestId}] Talenox update error:`, updateResponse.status, errorText);
      await sendUpdateFailureNotification(
        formData,
        'Talenox API Error',
        `${errorText.substring(0, 500)} (Status: ${updateResponse.status})`
      );
      throw new Error(`Failed to update employee particulars (${updateResponse.status})`);
    }

    console.log(`[${requestId}] Employee ${talenoxId} updated successfully in ${Date.now() - startTime}ms`);

    await sendUpdateHRNotification(formData, talenoxId, internalEmployeeId).catch((err) =>
      console.error(`[${requestId}] Failed to send HR notification:`, err)
    );

    console.log(`[${requestId}] Background update processing completed successfully`);
    return {
      success: true,
      employeeId: talenoxId,
      internalEmployeeId
    };
  } catch (error) {
    console.error(`[${requestId}] Background update processing error:`, error);
    throw error;
  }
}
