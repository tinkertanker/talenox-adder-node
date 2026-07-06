---
name: talenox
description: Manage employees in Talenox — search employees, update employee details, create new jobs, and change employment status. Use when the user asks to find, update, rehire, or change an employee's role/pay/dates in Talenox.
allowed-tools: Bash(node *) Read(**) Edit(**)
argument-hint: "<action> <details>"
---

# Talenox Employee Management

You are managing employees via the Talenox API. Use the helper script at `${CLAUDE_SKILL_DIR}/talenox-api.mjs` for all API calls.

## Available Commands

Run these via `node ${CLAUDE_SKILL_DIR}/talenox-api.mjs <command> [args...]` from the project root directory (where `.env` lives).

### Search for employees
```bash
node ${CLAUDE_SKILL_DIR}/talenox-api.mjs search "name query"
```
Returns matching employees with their ID, employee ID, name, citizenship, current job, and hire/resign dates.

### Get employee details
```bash
node ${CLAUDE_SKILL_DIR}/talenox-api.mjs get <talenox_id>
```
Returns full employee record including all jobs.

### Update employee fields
```bash
node ${CLAUDE_SKILL_DIR}/talenox-api.mjs update <talenox_id> '{"field": "value"}'
```
Updates employee fields. Common fields:
- `hired_date` — format `YYYY-MM-DD`
- `resign_date` — format `YYYY-MM-DD` or `null`
- `citizenship` — e.g. `"Contract (No CPF, No SDL)"`, `"Singapore Citizen"`, `"Singapore PR"`

### Create a new job
```bash
node ${CLAUDE_SKILL_DIR}/talenox-api.mjs create-job <talenox_id> '{"title": "...", "department": "...", "start_date": "DD/MM/YYYY", "end_date": "DD/MM/YYYY", "amount": 1200, "rate_of_pay": "Monthly", "currency": "SGD", "remarks": "..."}'
```
Creates a new job record for an existing employee.

## User Request

$ARGUMENTS

## Workflow

1. **Parse the request** — identify the employee name, what needs to change, dates, pay, role, etc.
2. **Search** for the employee to get their Talenox ID and current state.
3. **Show the user** what you found and what you plan to do. Confirm before making changes.
4. **Execute** the changes — typically:
   - Update employee fields (e.g. clear resign_date for rehires, update hired_date)
   - Create a new job record with the correct title, dates, and pay
5. **Verify** by fetching the employee again and showing the updated state.

## Common Scenarios

### Rehiring / Bringing someone back
1. Search for the employee
2. Update `resign_date` to `null` (or a future date) and optionally update `hired_date`
3. Create a new job with the appropriate title, start date, end date, and pay

### Changing to freelancer/contract
- Citizenship: `"Contract (No CPF, No SDL)"`
- Job title examples: `"Freelance Trainer"`, `"Associate Tinkerer"`, `"Freelance Designer"`

### Promoting or changing role
- Create a new job record (old jobs are kept as history)
- The most recent job becomes the current job

## Important Notes
- Job dates use `DD/MM/YYYY` format (Talenox convention)
- Employee dates (hired_date, resign_date) use `YYYY-MM-DD` format
- Always show the user what you're about to do before making API calls that modify data
- The `.env` file in the project root must contain `TALENOX_API_KEY` and `TALENOX_API_URL`
