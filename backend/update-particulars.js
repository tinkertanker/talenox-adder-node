// Handler for updating existing employee particulars in Talenox
// Requires a one-time code sent to the email already on file.
//
// OTP state is in-memory: suitable for a single Node process / container.
// Do not run multiple replicas without a shared store.

const crypto = require('crypto');
const { Resend } = require('resend');

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;
const OTP_REQUEST_COOLDOWN_MS = 60 * 1000; // 1 minute between sends per NRIC
const OTP_LENGTH = 6;
const IP_WINDOW_MS = 15 * 60 * 1000;
const IP_MAX_REQUESTS = 10; // request-code attempts per IP per window

const ALLOWED_GENDERS = new Set(['male', 'female']);
const ALLOWED_CITIZENSHIP = new Set(['sg_citizen', 'sg_pr', 'other']);
const ALLOWED_BANKS = new Set([
  'DBS',
  'POSB',
  'OCBC - Oversea-Chinese Banking Corporation Ltd',
  'UOB - United Overseas Bank Ltd',
  'Standard Chartered',
  'Citibank N.A Singapore Branch (CNAS)',
  'HSBC BANK (SINGAPORE) LTD',
  'Maybank - Singapore Branch(Malayan Banking Berhad)',
  'Trust Bank Singapore'
]);

// Active OTP sessions: normalised NRIC -> { codeHash, expiresAt, attempts, employeeSnapshot }
const otpStore = new Map();
// Cooldown survives OTP invalidation: normalised NRIC -> lastSentAt
const cooldownStore = new Map();
// IP rate limit: ip -> timestamps[]
const ipRequestLog = new Map();

const GENERIC_CODE_MESSAGE =
  'If this NRIC/FIN is on our records, a verification code has been sent to the email address we have on file. Check your inbox (and spam folder).';

const GENERIC_VERIFY_FAILURE =
  'Verification failed. Please check the code and try again, or request a new code.';

const redactSensitiveData = (data) => {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) return data.map(redactSensitiveData);
  if (typeof data !== 'object') return data;

  const redacted = {};
  for (const [key, value] of Object.entries(data)) {
    const lower = key.toLowerCase();
    if (lower === 'nric' || lower === 'ssn') {
      const str = String(value || '');
      redacted[key] = str ? `${str.substring(0, 1)}****${str.slice(-1)}` : value;
    } else if (
      lower === 'accountnumber' ||
      lower === 'number' ||
      lower === 'account_number'
    ) {
      const str = String(value || '');
      redacted[key] = str ? `****${str.slice(-4)}` : value;
    } else if (lower === 'verificationcode' || lower === 'code' || lower === 'codehash') {
      redacted[key] = '******';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitiveData(value);
    } else {
      redacted[key] = value;
    }
  }
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

const otpHashesEqual = (a, b) => {
  try {
    const bufA = Buffer.from(String(a), 'utf8');
    const bufB = Buffer.from(String(b), 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
};

const generateOtp = () => {
  const num = crypto.randomInt(0, 1000000);
  return String(num).padStart(OTP_LENGTH, '0');
};

const maskEmail = (email) => {
  if (!email || !email.includes('@')) return '***';
  const [local, domain] = email.split('@');
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
};

const cleanupExpiredState = () => {
  const now = Date.now();
  for (const [key, session] of otpStore.entries()) {
    if (session.expiresAt <= now) {
      otpStore.delete(key);
    }
  }
  for (const [key, lastSentAt] of cooldownStore.entries()) {
    if (now - lastSentAt > OTP_REQUEST_COOLDOWN_MS * 60) {
      cooldownStore.delete(key);
    }
  }
  for (const [ip, stamps] of ipRequestLog.entries()) {
    const fresh = stamps.filter((t) => now - t < IP_WINDOW_MS);
    if (!fresh.length) ipRequestLog.delete(ip);
    else ipRequestLog.set(ip, fresh);
  }
};

const getClientIp = (event) => {
  if (event.clientIp) return String(event.clientIp);
  const forwarded = event.headers && (event.headers['x-forwarded-for'] || event.headers['X-Forwarded-For']);
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return 'unknown';
};

const checkIpRateLimit = (ip) => {
  const now = Date.now();
  const stamps = (ipRequestLog.get(ip) || []).filter((t) => now - t < IP_WINDOW_MS);
  if (stamps.length >= IP_MAX_REQUESTS) {
    ipRequestLog.set(ip, stamps);
    return false;
  }
  stamps.push(now);
  ipRequestLog.set(ip, stamps);
  return true;
};

const isInCooldown = (nric) => {
  const lastSentAt = cooldownStore.get(nric);
  return Boolean(lastSentAt && Date.now() - lastSentAt < OTP_REQUEST_COOLDOWN_MS);
};

const markCooldown = (nric) => {
  cooldownStore.set(nric, Date.now());
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

  if (data.gender && !ALLOWED_GENDERS.has(String(data.gender).toLowerCase())) {
    errors.push('Invalid gender');
  }

  if (data.citizenshipStatus && !ALLOWED_CITIZENSHIP.has(data.citizenshipStatus)) {
    errors.push('Invalid citizenship status');
  }

  if (data.bank && !ALLOWED_BANKS.has(data.bank)) {
    errors.push('Invalid bank selection');
  }

  if (data.dob) {
    const dob = new Date(data.dob);
    if (Number.isNaN(dob.getTime()) || dob > new Date()) {
      errors.push('Invalid date of birth');
    }
  }

  return errors;
};

const mapCitizenshipStatus = (citizenshipStatus) => {
  if (citizenshipStatus === 'sg_citizen') return 'Singapore Citizen';
  if (citizenshipStatus === 'sg_pr') return 'Singapore PR';
  // Non-Citizen/PR — matches freelancer/contract mapping used elsewhere
  if (citizenshipStatus === 'other') return 'Contract (No CPF, No SDL)';
  return null;
};

const MAX_PAGES = 50;
const PAGE_SIZE = 100;

// NOTE: Lookup matches on list-row ssn/identification_number. If Talenox list
// responses omit those fields, OTP send will never find a match.
const findEmployeeByNric = async (nric, requestId = 'unknown') => {
  const normalisedNric = nric.trim().toUpperCase();
  let page = 1;
  const matchesById = new Map();

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

    for (const emp of list) {
      const ssn = (emp.ssn || emp.identification_number || '').toString().trim().toUpperCase();
      if (ssn === normalisedNric) {
        matchesById.set(emp.id, emp);
      }
    }

    if (matchesById.size > 1) {
      console.error(`[${requestId}] Multiple employees share NRIC — refusing update`);
      const err = new Error('DUPLICATE_NRIC');
      err.code = 'DUPLICATE_NRIC';
      throw err;
    }

    if (list.length < PAGE_SIZE) {
      break;
    }

    page += 1;
  }

  if (matchesById.size === 0) {
    return null;
  }

  const firstMatch = matchesById.values().next().value;
  console.log(`[${requestId}] Found employee by NRIC: Talenox ID ${firstMatch.id}`);

  const detailResponse = await fetch(`${process.env.TALENOX_API_URL}/employees/${firstMatch.id}`, {
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
  return firstMatch;
};

const buildUpdatePayload = (formData, existingEmployee) => {
  const gender = String(formData.gender).toLowerCase();
  const payload = {
    first_name: formData.fullName,
    identification_full_name: formData.fullName,
    email: formData.email,
    gender: gender.charAt(0).toUpperCase() + gender.slice(1),
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

const sendResendEmail = async ({ to, subject, text }) => {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('Email service is not configured');
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: process.env.FROM_EMAIL || 'Tinkercademy Onboarding <hr.onboarding@tinkertanker.com>',
    to: Array.isArray(to) ? to : [to],
    subject,
    text
  });

  // Resend v4 returns { data, error } instead of throwing on API failures
  if (result && result.error) {
    const message = result.error.message || JSON.stringify(result.error);
    throw new Error(`Resend error: ${message}`);
  }

  return result;
};

const sendVerificationEmail = async (toEmail, code, employeeName) => {
  const greeting = employeeName ? `Hi ${employeeName},` : 'Hi,';
  await sendResendEmail({
    to: toEmail,
    subject: 'Your Tinkercademy particulars verification code',
    text: `${greeting}

Your verification code for updating personal particulars is: ${code}

This code expires in 10 minutes. If you did not request this, you can ignore this email and contact HR at hr.onboarding@tinkertanker.com.

— Tinkercademy Onboarding`
  });
};

const sendEmailChangeNotice = async (oldEmail, newEmail, employeeName) => {
  if (!oldEmail || !newEmail || oldEmail.toLowerCase() === newEmail.toLowerCase()) {
    return;
  }

  const greeting = employeeName ? `Hi ${employeeName},` : 'Hi,';
  await sendResendEmail({
    to: oldEmail,
    subject: 'Your Tinkercademy payroll email was changed',
    text: `${greeting}

Your payroll email on file was changed from ${oldEmail} to ${newEmail}.

If you did not request this change, contact HR immediately at hr.onboarding@tinkertanker.com.

— Tinkercademy Onboarding`
  });
};

const sendUpdateHRNotification = async (formData, talenoxEmployeeId, internalEmployeeId, emailChanged) => {
  if (!process.env.RESEND_API_KEY || !process.env.NOTIFY_EMAIL) {
    console.log('Resend not configured, skipping update notification');
    return;
  }

  try {
    const emailContent = `
Employee Particulars Update

Employee Details:
- Name: ${formData.fullName}
- Email: ${formData.email}
- Email changed: ${emailChanged ? 'Yes (previous inbox notified)' : 'No'}
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

    await sendResendEmail({
      to: process.env.NOTIFY_EMAIL || 'hr.onboarding@tinkertanker.com',
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

    await sendResendEmail({
      to: process.env.NOTIFY_EMAIL || 'hr.onboarding@tinkertanker.com',
      subject: `⚠️ FAILED Particulars Update: ${formData.fullName || 'Unknown'}`,
      text: emailContent
    });

    console.log('Update failure notification sent successfully');
  } catch (error) {
    console.error('Failed to send update failure notification:', error);
  }
};

// Verify OTP without consuming on success (so a failed Talenox PUT can retry).
// On max attempts, clear OTP but keep cooldown.
const verifyOtpSession = (nric, verificationCode) => {
  cleanupExpiredState();
  const key = nric.trim().toUpperCase();
  const session = otpStore.get(key);

  if (!session || session.expiresAt <= Date.now()) {
    if (session) otpStore.delete(key);
    return { ok: false };
  }

  if (session.attempts >= OTP_MAX_ATTEMPTS) {
    otpStore.delete(key);
    return { ok: false };
  }

  const providedHash = hashOtp(String(verificationCode).trim());
  if (!otpHashesEqual(providedHash, session.codeHash)) {
    session.attempts += 1;
    if (session.attempts >= OTP_MAX_ATTEMPTS) {
      otpStore.delete(key);
    } else {
      otpStore.set(key, session);
    }
    return { ok: false };
  }

  return {
    ok: true,
    employeeSnapshot: session.employeeSnapshot,
    nricKey: key
  };
};

const consumeOtpSession = (nricKey) => {
  otpStore.delete(nricKey);
  // cooldown intentionally retained
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
  const genericSuccess = { success: true, message: GENERIC_CODE_MESSAGE };

  try {
    const body = JSON.parse(event.body || '{}');
    const nric = (body.nric || '').trim().toUpperCase();

    if (!nric || !validateNRIC(nric)) {
      return jsonResponse(400, {
        error: 'Invalid NRIC/FIN',
        details: 'Please enter a valid 9-character NRIC/FIN (e.g., S1234567A).'
      });
    }

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

    cleanupExpiredState();

    const clientIp = getClientIp(event);
    if (!checkIpRateLimit(clientIp)) {
      console.warn(`[${requestId}] IP rate limit hit for ${clientIp}`);
      // Same shape as success to avoid confirming whether the NRIC exists
      return jsonResponse(200, genericSuccess);
    }

    // Cooldown before lookup — applies to known and unknown NRICs once marked
    if (isInCooldown(nric)) {
      return jsonResponse(200, genericSuccess);
    }

    // Reserve cooldown immediately to reduce concurrent double-send races
    markCooldown(nric);

    let employee;
    try {
      employee = await findEmployeeByNric(nric, requestId);
    } catch (lookupError) {
      if (lookupError.code === 'DUPLICATE_NRIC') {
        console.error(`[${requestId}] Duplicate NRIC — alerting HR`);
        sendUpdateFailureNotification(
          { fullName: 'Unknown', email: 'Unknown', nric },
          'Duplicate NRIC',
          'Multiple Talenox employees share the same NRIC/FIN; refused OTP send'
        ).catch(() => {});
        return jsonResponse(200, genericSuccess);
      }
      console.error(`[${requestId}] Employee lookup failed:`, lookupError);
      // Generic success — do not leak lookup failures as a distinct signal
      return jsonResponse(200, genericSuccess);
    }

    if (!employee || !employee.email) {
      console.log(`[${requestId}] No employee/email for NRIC — returning generic success`);
      return jsonResponse(200, genericSuccess);
    }

    const code = generateOtp();
    const employeeName = `${employee.first_name || ''} ${employee.last_name || ''}`.trim();

    try {
      await sendVerificationEmail(employee.email, code, employeeName);
    } catch (emailError) {
      console.error(`[${requestId}] Failed to send verification email:`, emailError);
      // Do not create an OTP session if email was not accepted
      return jsonResponse(200, genericSuccess);
    }

    otpStore.set(nric, {
      codeHash: hashOtp(code),
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts: 0,
      employeeSnapshot: {
        id: employee.id,
        employee_id: employee.employee_id,
        email: employee.email,
        first_name: employee.first_name,
        bank_account: employee.bank_account || employee.bank_account_attributes || null
      }
    });

    console.log(`[${requestId}] Verification code sent for employee ${employee.id} to ${maskEmail(employee.email)}`);

    // Identical response shape whether or not a match existed
    return jsonResponse(200, genericSuccess);
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

  let formData;
  try {
    formData = JSON.parse(event.body);
  } catch (error) {
    console.error('Request parsing error:', error);
    return jsonResponse(400, {
      error: 'Invalid request',
      details: 'Could not parse request data'
    });
  }

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

  const otpResult = verifyOtpSession(formData.nric, formData.verificationCode);
  if (!otpResult.ok) {
    console.log(`[${requestId}] OTP verification failed`);
    return jsonResponse(401, {
      error: 'Verification failed',
      details: GENERIC_VERIFY_FAILURE,
      requestId
    });
  }

  const existingEmployee = otpResult.employeeSnapshot;
  console.log(`[${requestId}] OTP verified for employee ${existingEmployee.id}:`, redactSensitiveData({
    nric: formData.nric,
    fullName: formData.fullName,
    email: formData.email
  }));

  try {
    const result = await processParticularsUpdate(formData, existingEmployee, requestId);
    consumeOtpSession(otpResult.nricKey);
    return jsonResponse(200, {
      success: true,
      message: 'Your particulars have been updated successfully.',
      requestId,
      employeeId: result.employeeId
    });
  } catch (error) {
    console.error(`[${requestId}] Update failed:`, error);
    // Single failure notification boundary
    await sendUpdateFailureNotification(formData, 'Update Error', error.message).catch((err) =>
      console.error(`[${requestId}] Failed to send error notification:`, err)
    );
    return jsonResponse(502, {
      error: 'Update failed',
      details: 'We could not update your particulars. Please try again or contact HR at hr.onboarding@tinkertanker.com.',
      requestId
    });
  }
};

async function processParticularsUpdate(formData, existingEmployee, requestId) {
  const startTime = Date.now();
  const talenoxId = existingEmployee.id;
  const internalEmployeeId = existingEmployee.employee_id;
  const previousEmail = existingEmployee.email;
  const updatePayload = buildUpdatePayload(formData, existingEmployee);
  const emailChanged =
    previousEmail && formData.email &&
    previousEmail.toLowerCase() !== String(formData.email).toLowerCase();

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
    throw new Error(`Failed to update employee particulars (${updateResponse.status})`);
  }

  console.log(`[${requestId}] Employee ${talenoxId} updated successfully in ${Date.now() - startTime}ms`);

  if (emailChanged) {
    const employeeName = formData.fullName || existingEmployee.first_name || '';
    await sendEmailChangeNotice(previousEmail, formData.email, employeeName).catch((err) =>
      console.error(`[${requestId}] Failed to notify previous email:`, err)
    );
  }

  await sendUpdateHRNotification(formData, talenoxId, internalEmployeeId, emailChanged).catch((err) =>
    console.error(`[${requestId}] Failed to send HR notification:`, err)
  );

  return {
    success: true,
    employeeId: talenoxId,
    internalEmployeeId
  };
}
