# Tinkercademy Employee Onboarding - Development Notes

## Project Overview
This project creates a simplified onboarding form for Tinkercademy employees that integrates with the Talenox API to automate employee data entry.

## Current Status (Updated: June 2025)

### Completed ✅

#### Frontend
- Single-page form with dynamic fields based on employee type
- Employee type selection (Trainer, Intern with/without school letter, Full-time)
- Personal information collection (name, email, NRIC/FIN, nationality, DOB, gender)
- Conditional date fields based on employee type
- Bank information collection
- Automatic computation of Talenox fields:
  - Immigration status based on employee type and nationality
  - Job titles
  - Employment dates (auto-fill for trainers)
  - Basic salary (0 for freelancers)
  - SHG requirements
- Post-submission instructions for Talenox
- Tinkercademy branding with black/salmon theme
- Rubik font integration
- Loading states and error handling

#### Backend (PRODUCTION-READY)
- Netlify Functions serverless architecture
- Complete form validation with NRIC/FIN format checking
- PDPA-compliant data handling (sensitive data redaction)
- **Live Talenox API integration** with optimized field mapping
- **Auto-incrementing employee ID generation** (queries existing employees)
- **Banking information integration** using nested object structure
- **Comprehensive job creation** for all employee types with automatic pay/date logic
- **Clean, optimized codebase** with minimal overhead
- Environment variable configuration and security headers

#### Deployment Setup (NEW)
- Netlify configuration (`netlify.toml`)
- Local development setup with Netlify CLI
- Environment variables template
- Comprehensive documentation

### In Progress 🔄
- User account setup and permissions
- Immigration status field mapping

### TODO 🚧
- **Priority: Email confirmation system using resend.com**
  - Send confirmation email to employee after successful form submission
  - Send notification email to HR team
  - Include submission details and next steps
- User account setup and portal permissions
- Immigration status field mapping
- Performance monitoring and error tracking

## Technical Implementation

### Frontend Architecture
- **Form Logic**: Vanilla JavaScript with async/await for API calls
- **Validation**: Client-side validation with specific rules per employee type
- **State Management**: Form data collected and transformed before submission
- **Error Handling**: User-friendly error messages with retry capability

### Backend Architecture (Netlify Functions)
- **Serverless Function**: `submit-onboarding.js` handles all API logic
- **Validation Layer**: Server-side validation ensures data integrity
- **Data Transformation**: Converts form data to Talenox API format
- **Security**: 
  - NRIC/FIN redaction in logs
  - CORS protection
  - Environment variable encryption
  - Input sanitization

### Email Notification System (TODO)
- **Email Service**: Resend.com for reliable email delivery
- **Employee Confirmation**: Welcome email with submission confirmation
- **HR Notification**: Automated alert to HR team with employee details
- **Email Templates**: Branded HTML templates with submission summary
- **PDPA Compliance**: No sensitive data in email content, reference IDs only

### Data Flow
1. User fills form → Client-side validation
2. Submit to `/.netlify/functions/submit-onboarding`
3. Server-side validation and transformation
4. Call Talenox API (when credentials available)
5. Return success/error response
6. Display result to user

### Employee Type Rules
- **Trainers**: No date input needed (auto-filled: start = 1st of last month, end = 2nd of last month)
- **Interns**: Require both start and end dates
- **Full-timers**: Require only start date

### Talenox Integration (WORKING)

#### Employee Creation (✅ Complete)
```javascript
{
  // Core employee fields - all working
  first_name: formData.fullName,
  email: formData.email,
  gender: formData.gender,
  nationality: mapped_nationality,
  hired_date: computed_date,
  resign_date: formData.endDate || null,
  birthdate: formData.dob,
  ssn: formData.nric, // NRIC/FIN identification
  employee_id: auto_generated_sequential_id, // Auto-increments from 300+
  
  // Banking information - nested structure
  bank_account_attributes: {
    bank_type: formData.bank,
    account_name: formData.accountName,
    number: formData.accountNumber
  }
}
```

#### Job Creation (✅ Complete)
```javascript
// Automatically creates jobs after employee creation
{
  employee_id: created_employee_id,
  title: job_title, // Based on employee type
  job: {
    title: job_title,
    department: department, // Training/Internship/Operations
    start_date: calculated_start_date, // DD/MM/YYYY format
    end_date: calculated_end_date,
    currency: 'SGD',
    amount: pay_amount, // 0/800/3000 based on type
    rate_of_pay: 'Monthly',
    remarks: 'Auto-created job'
  }
}

// Job Logic by Employee Type:
// - Trainers: Freelance Trainer, 0 pay, same dates as employment
// - Interns: Tinkertanker Intern, 800 SGD, next month + 3 months
// - Full-timers: Tinkertanker Full-timer, 3000 SGD, next month + 10 years
```

## Development Guidelines

### Local Development
```bash
# Install Netlify CLI globally
npm install -g netlify-cli

# Run the development server
npm run dev

# Test the function locally
# POST to http://localhost:8888/.netlify/functions/submit-onboarding
```

### Adding Features
1. Frontend changes in `index.html`, `script.js`, `styles.css`
2. Backend changes in `netlify/functions/submit-onboarding.js`
3. Test locally with `netlify dev`
4. Ensure PDPA compliance for any data handling

### Environment Variables
- Never commit `.env` file
- Use `.env.example` as template
- Set production variables in Netlify dashboard
- Access via `process.env.VARIABLE_NAME`

#### Required Environment Variables
```
TALENOX_API_KEY=your_talenox_api_key
RESEND_API_KEY=your_resend_api_key
HR_EMAIL=hr@tinkercademy.com
```

### Testing Checklist
- [x] All employee types create correct data
- [x] Validation works for all fields
- [x] NRIC/FIN format validation
- [x] Date logic (end > start for interns)
- [x] Error messages are user-friendly
- [x] Sensitive data is never logged
- [x] Employee ID auto-generation working
- [x] Banking information populates correctly
- [x] Job creation for all employee types working
- [x] Automatic pay and date calculation working
- [x] Core integration stable and optimized

## Deployment Process

1. **Development**
   - Make changes locally
   - Test with `netlify dev`
   - Verify all employee types work

2. **Commit & Push**
   ```bash
   git add .
   git commit -m "Description of changes"
   git push origin main
   ```

3. **Automatic Deployment**
   - Netlify auto-deploys on push to main
   - Check deploy status in Netlify dashboard
   - View function logs for debugging

4. **Production Testing**
   - Test form submission
   - Check function logs
   - Verify Talenox integration (when ready)

## Important Security Notes

- **NRIC/FIN**: Always validate format, redact in logs
- **API Keys**: Only store in environment variables
- **CORS**: Configured in `netlify.toml`
- **Validation**: Always validate on server-side
- **Logging**: Never log sensitive data
- **HTTPS**: Enforced automatically by Netlify