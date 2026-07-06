#!/usr/bin/env node

// Talenox API helper script for the /talenox skill
// Usage: node talenox-api.mjs <command> [args...]

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';

// Load .env from the project root (walk up from script location)
function loadEnv() {
  // Try project root first (where .env should live)
  const scriptDir = dirname(new URL(import.meta.url).pathname);
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(scriptDir, '../../../.env'),  // .claude/skills/talenox -> project root
  ];

  for (const envPath of candidates) {
    try {
      const content = readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
      return;
    } catch {
      // Try next candidate
    }
  }
  console.error('Error: Could not find .env file');
  process.exit(1);
}

loadEnv();

const API_URL = process.env.TALENOX_API_URL;
const API_KEY = process.env.TALENOX_API_KEY;

if (!API_URL || !API_KEY) {
  console.error('Error: TALENOX_API_URL and TALENOX_API_KEY must be set in .env');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

// --- API functions ---

async function searchEmployees(query) {
  // Fetch all employees in one request (sort param bypasses the 5-per-page cap)
  const url = `${API_URL}/employees?per=50&sort=-created_at`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    console.error(`API error: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const employees = await res.json();
  const queryLower = query.toLowerCase();
  const matches = employees.filter(emp => {
    const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim().toLowerCase();
    return fullName.includes(queryLower);
  });

  if (matches.length === 0) {
    console.log(`No employees found matching "${query}"`);
    return;
  }

  console.log(`Found ${matches.length} employee(s) matching "${query}":\n`);
  for (const emp of matches) {
    const name = `${emp.first_name || ''} ${emp.last_name || ''}`.trim();
    const job = emp.current_job;
    console.log(`  Talenox ID: ${emp.id}`);
    console.log(`  Employee ID: ${emp.employee_id}`);
    console.log(`  Name: ${name}`);
    console.log(`  Citizenship: ${emp.citizenship || 'N/A'}`);
    console.log(`  Hired: ${emp.hired_date || 'N/A'}`);
    console.log(`  Resigned: ${emp.resign_date || 'N/A (active)'}`);
    if (job) {
      console.log(`  Current job: ${job.title || 'Untitled'}, ${job.amount} ${job.currency}/${job.rate_of_pay}, ${job.start_date} - ${job.end_date || 'ongoing'}`);
    }
    console.log(`  Total jobs: ${(emp.jobs || []).length}`);
    console.log();
  }
}

async function getEmployee(id) {
  const res = await fetch(`${API_URL}/employees/${id}`, { headers });
  if (!res.ok) {
    console.error(`API error: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const emp = await res.json();
  console.log(JSON.stringify(emp, null, 2));
}

async function updateEmployee(id, fieldsJson) {
  const fields = JSON.parse(fieldsJson);
  const res = await fetch(`${API_URL}/employees/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(fields),
  });

  const body = await res.text();
  if (!res.ok) {
    console.error(`API error: ${res.status} ${body}`);
    process.exit(1);
  }

  console.log(`Employee ${id} updated successfully.`);
  // Show the relevant updated fields
  try {
    const result = JSON.parse(body);
    for (const key of Object.keys(fields)) {
      if (result[key] !== undefined) {
        console.log(`  ${key}: ${result[key]}`);
      }
    }
  } catch {
    console.log(body);
  }
}

async function createJob(employeeId, jobJson) {
  const jobFields = JSON.parse(jobJson);
  const payload = {
    employee_id: parseInt(employeeId),
    title: jobFields.title,
    job: {
      title: jobFields.title,
      department: jobFields.department || null,
      start_date: jobFields.start_date,
      end_date: jobFields.end_date || null,
      currency: jobFields.currency || 'SGD',
      amount: jobFields.amount || 0,
      rate_of_pay: jobFields.rate_of_pay || 'Monthly',
      remarks: jobFields.remarks || '',
    },
  };

  const res = await fetch(`${API_URL}/jobs`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const body = await res.text();
  if (!res.ok) {
    console.error(`API error: ${res.status} ${body}`);
    process.exit(1);
  }

  console.log(`Job created successfully for employee ${employeeId}.`);
  try {
    const result = JSON.parse(body);
    console.log(`  Job ID: ${result.id}`);
    console.log(`  Title: ${payload.job.title}`);
    console.log(`  Amount: ${payload.job.amount} ${payload.job.currency}/${payload.job.rate_of_pay}`);
    console.log(`  Period: ${payload.job.start_date} - ${payload.job.end_date || 'ongoing'}`);
  } catch {
    console.log(body);
  }
}

// --- CLI dispatch ---

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case 'search':
    if (!args[0]) { console.error('Usage: search "name"'); process.exit(1); }
    await searchEmployees(args[0]);
    break;

  case 'get':
    if (!args[0]) { console.error('Usage: get <talenox_id>'); process.exit(1); }
    await getEmployee(args[0]);
    break;

  case 'update':
    if (!args[0] || !args[1]) { console.error('Usage: update <talenox_id> \'{"field": "value"}\''); process.exit(1); }
    await updateEmployee(args[0], args[1]);
    break;

  case 'create-job':
    if (!args[0] || !args[1]) { console.error('Usage: create-job <talenox_id> \'{"title": "...", ...}\''); process.exit(1); }
    await createJob(args[0], args[1]);
    break;

  default:
    console.log(`Talenox API Helper

Commands:
  search "name"                          Search employees by name
  get <talenox_id>                       Get full employee details
  update <talenox_id> '{"field":"val"}'  Update employee fields
  create-job <talenox_id> '{...}'        Create a new job for an employee

Examples:
  node talenox-api.mjs search "Tan Rui Yang"
  node talenox-api.mjs get 211722
  node talenox-api.mjs update 211722 '{"resign_date": null}'
  node talenox-api.mjs create-job 211722 '{"title": "Freelance Trainer", "start_date": "15/04/2026", "end_date": "16/04/2026", "amount": 1200}'
`);
}
