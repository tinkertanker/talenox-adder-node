// Handler for updating existing employee particulars in Talenox
// Requires a one-time code sent to the email already on file.

const crypto = require('crypto');
const { Resend } = require('resend');

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;
const OTP_REQUEST_COOLDOWN_MS = 60 * 1000; // 1 minute between sends per NRIC
const OTP_LENGTH = 6;

// In-memory OTP store: normalised NRIC -> session
const otpStore = new Map();

const redactSensitiveData = (data) => {
  const redacted = { ...data };
  if (redacted.nric) redacted.nric = redacted.nric.substring(0, 1) + '****' + redacted.nric.slice(-1);
  if (redacted.accountNumber) redacted.accountNumber = '****' + redacted.accountNumber.slice(-4);
  if (redacted.verificationCode) redacted.verificationCode = '******';
  return redacted;
};

const validateNRIC = (nric) => /^[STFGM]\d{7}[A-Z]$/i.test(nric);

const jsonResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  },
  body: JSON.stringify(body)
});

const optionsResponse = () => ({
  statusCode: 200,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  },
  body: ''
});

const hashOtp = (code) => crypto.createHash('sha256').update(String(code)).digest('hex');

const generateOtp = () => {
  // Cryptographically secure 6-digit code (000000–999999)
  const num = crypto.randomInt(0, 1000000);
  return String(num).padStart(OTP_LENGTH, '0');
};

const maskEmail = (email) => {
  if (!email || !email.includes('@')) return '***';
  const [local, domain] = email.split('@');
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
};

const cleanupExpiredOtps = () => {
  const now = Date.now();
  for (const [key, session] of otpStore.entries()) {
    if (session.expiresAt <= now) {
      otpStore.delete(key);
    }
  }
};

const validateUpdateFormData = (data) => {
  const errors = [];

  if (!data.fullName) errors.push('Full name is required');
  if (!data.email) errors.push('Email is required');
  if (!data.nric) errors.push('NRIC/FIN is required');
  if (!data.verificationCode) errors.push('Verification code is required');
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

  if (data.verificationCode && !/^\d{6}$/.test(String(data.verificationCode).trim())) {
    errors.push('Verification code must be 6 digits');
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
      // Fetch full record so we have a reliable email for verification
      const detailResponse = await fetch(`${process.env.TALENOX_API_URL}/employees/${match.id}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.TALENOX_API_KEY}`,
          Accept: 'application/json'
        }
      });

      if (detailResponse.ok) {
        return await detailResponse.json();
      }

      console.warn(`[${requestId}] Could not fetch full employee record, using list result`);
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

  const existingBank =
    existingEmployee.bank_account ||
    existingEmployee.bank_account_attributes ||
    null;
  if (existingBank && existingBank.id) {
    payload.bank_account_attributes.id = existingBank.id;
  }

  return payload;
};

const sendVerificationEmail = async (toEmail, code, employeeName) => {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('Email service is not configured');
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const greeting = employeeName ? `Hi ${employeeName},` : 'Hi,';

  await resend.emails.send({
    from: process.env.FROM_EMAIL || 'Tinkercademy Onboarding <hr.onboarding@tinkertanker.com>',
    to: [toEmail],
    subject: 'Your Tinkercademy particulars verification code',
    text: `${greeting}

Your verification code for updating personal particulars is: ${code}

This code expires in 10 minutes. If you did not request this, you can ignore this email and contact HR at hr.onboarding@tinkertanker.com.

— Tinkercademy Onboarding`
  });
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
- Status: Particulars updated successfully (email-verified)

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

const consumeOtpSession = (nric, verificationCode) => {
  cleanupExpiredOtps();
  const key = nric.trim().toUpperCase();
  const session = otpStore.get(key);

  if (!session) {
    return { ok: false, error: 'No verification code found. Please request a new code.' };
  }

  if (session.expiresAt <= Date.now()) {
    otpStore.delete(key);
    return { ok: false, error: 'Verification code has expired. Please request a new code.' };
  }

  if (session.attempts >= OTP_MAX_ATTEMPTS) {
    otpStore.delete(key);
    return { ok: false, error: 'Too many incorrect attempts. Please request a new code.' };
  }

  const providedHash = hashOtp(String(verificationCode).trim());
  if (providedHash !== session.codeHash) {
    session.attempts += 1;
    otpStore.set(key, session);
    const remaining = OTP_MAX_ATTEMPTS - session.attempts;
    if (remaining <= 0) {
      otpStore.delete(key);
      return { ok: false, error: 'Too many incorrect attempts. Please request a new code.' };
    }
    return { ok: false, error: `Incorrect verification code. ${remaining} attempt(s) remaining.` };
  }

  // One-time use: remove after successful verification
  otpStore.delete(key);
  return {
    ok: true,
    employeeSnapshot: session.employeeSnapshot
  };
};

// POST /api/update-particulars/request-code
exports.requestCodeHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return optionsResponse();
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const requestId = `otp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  try {
    const body = JSON.parse(event.body || '{}');
    const nric = (body.nric || '').trim().toUpperCase();

    if (!nric || !validateNRIC(nric)) {
      return jsonResponse(400, {
        error: 'Invalid NRIC/FIN',
        details: 'Please enter a valid 9-character NRIC/FIN (e.g., S1234567A).'
      });
    }

    // Generic success message used whether or not we find a match (limits NRIC enumeration)
    const genericSuccess = {
      success: true,
      message: 'If this NRIC/FIN is on our records, a verification code has been sent to the email address we have on file. Check your inbox (and spam folder).'
    };

    if (!process.env.TALENOX_API_KEY || !process.env.TALENOX_API_URL) {
      console.error(`[${requestId}] Talenox API credentials not configured`);
      return jsonResponse(500, {
        error: 'Configuration error',
        details: 'Talenox API is not properly configured'
      });
    }

    if (!process.env.RESEND_API_KEY) {
      console.error(`[${requestId}] Resend not configured`);
      return jsonResponse(500, {
        error: 'Configuration error',
        details: 'Email verification is not properly configured'
      });
    }

    cleanupExpiredOtps();
    const existingSession = otpStore.get(nric);
    if (existingSession && existingSession.lastSentAt && Date.now() - existingSession.lastSentAt < OTP_REQUEST_COOLDOWN_MS) {
      return jsonResponse(429, {
        error: 'Please wait',
        details: 'A verification code was recently sent. Please wait a minute before requesting another.'
      });
    }

    let employee;
    try {
      employee = await findEmployeeByNric(nric, requestId);
    } catch (lookupError) {
      console.error(`[${requestId}] Employee lookup failed:`, lookupError);
      return jsonResponse(502, {
        error: 'Lookup failed',
        details: 'Unable to search for your employee record. Please try again shortly.'
      });
    }

    if (!employee || !employee.email) {
      console.log(`[${requestId}] No employee/email for NRIC — returning generic success`);
      // Still return success to avoid leaking whether the NRIC exists
      return jsonResponse(200, genericSuccess);
    }

    const code = generateOtp();
    const employeeName = `${employee.first_name || ''} ${employee.last_name || ''}`.trim();

    try {
      await sendVerificationEmail(employee.email, code, employeeName);
    } catch (emailError) {
      console.error(`[${requestId}] Failed to send verification email:`, emailError);
      return jsonResponse(502, {
        error: 'Email failed',
        details: 'Could not send the verification email. Please try again or contact HR.'
      });
    }

    otpStore.set(nric, {
      codeHash: hashOtp(code),
      expiresAt: Date.now() + OTP_TTL_MS,
      lastSentAt: Date.now(),
      attempts: 0,
      employeeSnapshot: {
        id: employee.id,
        employee_id: employee.employee_id,
        email: employee.email,
        bank_account: employee.bank_account || employee.bank_account_attributes || null
      }
    });

    console.log(`[${requestId}] Verification code sent for employee ${employee.id} to ${maskEmail(employee.email)}`);

    return jsonResponse(200, {
      ...genericSuccess,
      maskedEmail: maskEmail(employee.email)
    });
  } catch (error) {
    console.error(`[${requestId}] request-code error:`, error);
    return jsonResponse(400, {
      error: 'Invalid request',
      details: 'Could not process verification request'
    });
  }
};

// POST /api/update-particulars
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return optionsResponse();
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const formData = JSON.parse(event.body);
    const requestId = `upd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    console.log(`[${requestId}] New particulars update request received`);

    const validationErrors = validateUpdateFormData(formData);
    if (validationErrors.length > 0) {
      console.log(`[${requestId}] Validation failed:`, validationErrors);
      return jsonResponse(400, {
        error: 'Validation failed',
        details: validationErrors,
        requestId
      });
    }

    if (!process.env.TALENOX_API_KEY || !process.env.TALENOX_API_URL) {
      console.error(`[${requestId}] Talenox API credentials not configured`);
      return jsonResponse(500, {
        error: 'Configuration error',
        details: 'Talenox API is not properly configured'
      });
    }

    const otpResult = consumeOtpSession(formData.nric, formData.verificationCode);
    if (!otpResult.ok) {
      console.log(`[${requestId}] OTP verification failed`);
      return jsonResponse(401, {
        error: 'Verification failed',
        details: otpResult.error,
        requestId
      });
    }

    // Use the employee snapshot from the verified OTP session — do not re-trust NRIC alone
    const existingEmployee = otpResult.employeeSnapshot;

    console.log(`[${requestId}] Accepted verified update for background processing:`, redactSensitiveData(formData));

    processParticularsUpdate(formData, existingEmployee, requestId).catch((error) => {
      console.error(`[${requestId}] Background update processing failed:`, error);
      sendUpdateFailureNotification(formData, 'Background Processing Error', error.message)
        .catch((err) => console.error(`[${requestId}] Failed to send error notification:`, err));
    });

    return jsonResponse(202, {
      success: true,
      message: 'Your particulars update has been accepted and is being processed.',
      requestId
    });
  } catch (error) {
    console.error('Request parsing error:', error);
    return jsonResponse(400, {
      error: 'Invalid request',
      details: 'Could not parse request data'
    });
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
