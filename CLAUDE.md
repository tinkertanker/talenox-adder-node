# Tinkercademy Employee Onboarding - Development Notes

## Project Overview
This project creates a simplified onboarding form for Tinkercademy employees that integrates with the Talenox API to automate employee data entry.

## Current Status (Updated: January 2025)

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

#### Backend (NEW)
- Netlify Functions serverless architecture
- Complete form validation with NRIC/FIN format checking
- PDPA-compliant data handling (sensitive data redaction)
- Talenox data transformation logic
- Environment variable configuration
- CORS and security headers
- Demo mode (works without API credentials)

#### Deployment Setup (NEW)
- Netlify configuration (`netlify.toml`)
- Local development setup with Netlify CLI
- Environment variables template
- Comprehensive documentation

### In Progress 🔄
- Awaiting Talenox API credentials
- Ready to integrate once credentials provided

### TODO 🚧
- Add actual Talenox API calls (structure already in place)
- Test with Talenox sandbox environment
- Add email notifications (optional)
- Performance monitoring

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

### Talenox Field Mapping
```javascript
{
  first_name: formData.fullName,
  last_name: '', // Always empty per requirement
  email: formData.email,
  identification_number: formData.nric,
  date_of_birth: formData.dob,
  gender: formData.gender,
  nationality: mapped_nationality,
  immigration_status: computed_status,
  hired_date: computed_date,
  resign_date: formData.endDate || null,
  job_title: computed_title,
  basic_salary: computed_salary,
  bank_name: formData.bank,
  bank_account_name: formData.accountName,
  bank_account_number: formData.accountNumber
}
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

### Testing Checklist
- [ ] All employee types create correct data
- [ ] Validation works for all fields
- [ ] NRIC/FIN format validation
- [ ] Date logic (end > start for interns)
- [ ] Error messages are user-friendly
- [ ] Sensitive data is never logged
- [ ] Form works without API key (demo mode)

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