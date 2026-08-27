const test = require('node:test');
const assert = require('node:assert/strict');
const { inspect } = require('node:util');

const submitOnboarding = require('./submit-onboarding');

const makeResendClient = (results) => {
  const calls = [];
  let resultIndex = 0;
  return {
    calls,
    emails: {
      send: async (payload) => {
        calls.push(payload);
        const result = results[Math.min(resultIndex, results.length - 1)];
        resultIndex += 1;
        return result;
      }
    }
  };
};

const failureDetails = {
  employeeErrorType: 'system',
  hrErrorType: 'System Error',
  hrErrorDetails: 'An unexpected error occurred during onboarding'
};

const formData = {
  employeeType: 'trainer',
  fullName: 'Alex Tan',
  email: 'alex@example.com',
  nric: 'S1234567D',
  nationality: 'Singaporean',
  citizenshipStatus: 'other',
  dob: '1990-01-15',
  gender: 'male',
  bank: 'DBS',
  accountName: 'Alex Tan',
  accountNumber: '123456789'
};

test.beforeEach(() => {
  process.env.RESEND_API_KEY = 'test-resend-key';
  process.env.NOTIFY_EMAIL = 'hr@example.com';
  process.env.TALENOX_API_KEY = 'test-talenox-key';
  process.env.TALENOX_API_URL = 'https://talenox.test/api/v2';
});

test('a resolved Resend error triggers the HR-only failure-email fallback', async () => {
  const resend = makeResendClient([
    { data: null, error: { message: 'Invalid recipient' } },
    { data: { id: 'email-2' }, error: null }
  ]);

  await submitOnboarding._testing.sendFailureNotification(
    formData,
    failureDetails,
    resend
  );

  assert.equal(resend.calls.length, 2);
  assert.deepEqual(resend.calls[0].to, ['hr@example.com', 'alex@example.com']);
  assert.deepEqual(resend.calls[1].to, ['hr@example.com']);
});

test('an injected Resend client does not require a configured API key', async () => {
  const resend = makeResendClient([
    { data: { id: 'email-1' }, error: null }
  ]);
  const originalResendApiKey = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;

  try {
    await submitOnboarding._testing.sendFailureNotification(
      formData,
      failureDetails,
      resend
    );
  } finally {
    process.env.RESEND_API_KEY = originalResendApiKey;
  }

  assert.equal(resend.calls.length, 1);
  assert.deepEqual(resend.calls[0].to, ['hr@example.com', 'alex@example.com']);
});

test('an HR-only fallback is not reported as successful when Resend rejects it', async () => {
  const resend = makeResendClient([
    { data: null, error: { message: 'Invalid recipient' } },
    { data: null, error: { message: 'Email service unavailable' } }
  ]);
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));

  try {
    await submitOnboarding._testing.sendFailureNotification(
      formData,
      failureDetails,
      resend
    );
  } finally {
    console.log = originalLog;
  }

  assert.equal(resend.calls.length, 2);
  assert.equal(logs.some((message) => message.includes('sent to HR only')), false);
});

test('redaction covers Talenox SSN and nested bank account data', () => {
  const redacted = submitOnboarding._testing.redactSensitiveData({
    ssn: 'S1234567D',
    bank_account_attributes: {
      number: '123456789',
      account_name: 'Alex Tan'
    }
  });

  assert.deepEqual(redacted, {
    ssn: 'S****D',
    bank_account_attributes: {
      number: '****6789',
      account_name: 'Alex Tan'
    }
  });
});

test('Talenox field conflicts are classified as duplicate employees', () => {
  const errorText = JSON.stringify({
    errors: {
      email: ['is already registered to another employee']
    }
  });

  assert.equal(
    submitOnboarding._testing.classifyEmployeeCreationError(400, errorText),
    'duplicate'
  );
  assert.equal(
    submitOnboarding._testing.classifyEmployeeCreationError(
      400,
      JSON.stringify({ errors: { hired_date: ['is invalid'] } })
    ),
    'unknown'
  );
  assert.equal(
    submitOnboarding._testing.classifyEmployeeCreationError(
      400,
      JSON.stringify({ errors: { employee_id: ['has already been taken'] } })
    ),
    'unknown'
  );
  assert.equal(
    submitOnboarding._testing.classifyEmployeeCreationError(
      400,
      JSON.stringify({
        errors: {
          email: ['is invalid'],
          employee_id: ['has already been taken']
        }
      })
    ),
    'unknown'
  );
});

test('duplicate employee email explains that HR will check the existing profile', async () => {
  const resend = makeResendClient([
    { data: { id: 'email-1' }, error: null }
  ]);

  await submitOnboarding._testing.sendFailureNotification(
    formData,
    {
      employeeErrorType: 'duplicate',
      hrErrorType: 'Talenox API Error (duplicate)',
      hrErrorDetails: 'An employee with these details is already registered in Talenox'
    },
    resend
  );

  assert.equal(resend.calls.length, 1);
  assert.match(resend.calls[0].subject, /Already registered in Talenox/);
  assert.match(resend.calls[0].text, /No new account was created/);
  assert.match(resend.calls[0].text, /HR has been notified and will check the existing profile/);
  assert.match(resend.calls[0].text, /Please do not submit the form again/);
});

test('an exact existing name and email match stops employee creation as a duplicate', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => [{
      id: 9876,
      employee_id: '432',
      first_name: '  ALEX   TAN ',
      email: 'Alex@Example.com'
    }]
  });

  try {
    await assert.rejects(
      submitOnboarding._testing.getNextEmployeeId(formData),
      (error) => {
        assert.equal(error.errorType, 'duplicate');
        assert.equal(error.hrErrorType, 'Talenox API Error (duplicate)');
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('employee-list failures stop onboarding instead of falling back to employee ID 301', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    status: 503
  });

  try {
    await assert.rejects(
      submitOnboarding._testing.getNextEmployeeId(formData),
      /Could not retrieve existing employees from Talenox/
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('a Talenox employee-creation failure never logs its response body', async () => {
  const sentinelNric = 'S7654321Z';
  const sentinelAccount = '9988776655';
  const originalFetch = global.fetch;
  const originalError = console.error;
  const originalLog = console.log;
  const originalResendApiKey = process.env.RESEND_API_KEY;
  const output = [];
  let requestCount = 0;

  global.fetch = async () => {
    requestCount += 1;
    if (requestCount === 1) {
      return {
        ok: true,
        status: 200,
        json: async () => []
      };
    }
    return {
      ok: false,
      status: 422,
      text: async () => JSON.stringify({
        message: `Rejected ${sentinelNric} with account ${sentinelAccount}`
      })
    };
  };
  console.error = (...args) => output.push(args);
  console.log = (...args) => output.push(args);
  delete process.env.RESEND_API_KEY;

  try {
    await assert.rejects(
      submitOnboarding._testing.processOnboarding(
        { ...formData, nric: sentinelNric, accountNumber: sentinelAccount },
        'test-request'
      ),
      /Failed to create employee in Talenox/
    );
  } finally {
    global.fetch = originalFetch;
    console.error = originalError;
    console.log = originalLog;
    process.env.RESEND_API_KEY = originalResendApiKey;
  }

  const serialisedOutput = output
    .flat()
    .map((value) => value instanceof Error
      ? `${value.name}: ${value.message}\n${value.stack || ''}`
      : inspect(value, { depth: null }))
    .join('\n');
  assert.equal(serialisedOutput.includes(sentinelNric), false);
  assert.equal(serialisedOutput.includes(sentinelAccount), false);
  assert.match(serialisedOutput, /Talenox employee creation failed/);
  assert.match(serialisedOutput, /422/);
});
