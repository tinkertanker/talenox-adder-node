# Tinkercademy Employee Onboarding Form

A streamlined onboarding form for Tinkercademy employees that collects necessary information and prepares data for Talenox API integration.

## Overview

This project simplifies the employee onboarding process by:
- Collecting all required information in a single form
- Automatically determining employee-specific requirements based on their type
- Preparing data for seamless Talenox integration
- Reducing manual data entry and potential errors

## Current Process vs. New Process

### Current Process
1. Collect basic info (name, email, NRIC)
2. Manually create Talenox entry
3. Employee receives Talenox invitation email
4. Employee fills additional information in Talenox
5. Employee submits bank details via separate Google Form

### New Process
1. Employee fills single comprehensive form
2. System automatically determines requirements based on employee type
3. Data is prepared for Talenox API
4. Employee receives confirmation and Talenox login instructions

## Features

### Employee Types
- **Freelance Trainer**: Contract workers without CPF/SDL
- **Intern with School Letter**: Official school internship program
- **Intern without School Letter**: Non-official internship
- **Full-time Employee**: Permanent staff

### Collected Information
- Personal details (name, email, NRIC/FIN, nationality, DOB, gender)
- Employment dates (conditional based on employee type)
- Banking information for payroll

### Automatic Calculations
Based on employee type, the system automatically determines:
- **Immigration Status**
  - Contract (No CPF, No SDL) for trainers and official interns
  - Singapore Citizen/PR/Work Pass for others
- **Job Title**
  - "Freelance Trainer" or "Tinkercademy Intern"
- **Employment Dates**
  - Trainers: Auto-filled (start: 1st of previous month, end: 2nd of previous month)
  - Interns: User-specified start and end dates
  - Full-timers: User-specified start date only
- **SHG Requirements**
  - Applied for non-official interns and full-timers

## Technical Details

### Frontend
- Pure HTML, CSS, JavaScript (no frameworks)
- Google Fonts (Rubik)
- Responsive design
- Black and salmon (#FA8072) color theme

### Form Flow
1. Employee type selection
2. Personal information
3. Conditional date fields
4. Banking information
5. Success message with Talenox instructions

### Data Structure
The form collects and computes the following fields:
```javascript
{
  // User Input
  employeeType: "trainer|intern_school|intern_no_school|fulltime",
  fullName: "John Tan Ah Kow",
  email: "john@example.com",
  nric: "S1234567D",
  nationality: "sg_citizen|sg_pr|other",
  dob: "1990-01-01",
  gender: "male|female",
  startDate: "2024-01-01", // Conditional
  endDate: "2024-06-30",   // Conditional
  bank: "DBS",
  accountName: "John Tan",
  accountNumber: "1234567890",
  
  // Computed Fields
  immigrationStatus: "Contract (No CPF, No SDL)",
  jobTitle: "Freelance Trainer",
  basicSalary: 0,
  requiresSHG: false
}
```

## Talenox Integration Notes

### Important Requirements
1. **Name Fields in Talenox**:
   - First Name: Full legal name (e.g., "John Tan Ah Kow")
   - Last Name: Must be left blank

2. **Date Logic**:
   - Hired date = Job start date
   - Resign date = Job end date (if applicable)

3. **Salary**:
   - Freelancers: Basic salary = 0
   - Others: To be determined by HR

## Setup & Deployment

### Local Development

```bash
# Clone the repository
git clone [repository-url]
cd freelancer-adder

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your Talenox API credentials

# Run locally with Netlify Dev
npm run dev
# Visit http://localhost:8888
```

### Deploy to Production

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Deploy onboarding form"
   git push origin main
   ```

2. **Deploy on Netlify**
   - Sign up/login at [netlify.com](https://netlify.com)
   - Click "Add new site" → "Import an existing project"
   - Connect GitHub and select this repository
   - Deploy settings are auto-configured via `netlify.toml`
   - Click "Deploy site"

3. **Configure Environment Variables**
   In Netlify Dashboard → Site settings → Environment variables:
   - `TALENOX_API_KEY`: Your Talenox API key
   - `TALENOX_API_URL`: Talenox API endpoint (e.g., https://api.talenox.com/v1)
   - `ALLOWED_ORIGINS`: Your production URL (optional)

4. **Test the Deployment**
   - Form works immediately in demo mode (without API key)
   - With credentials, it creates real Talenox employees
   - Check Functions tab in Netlify for logs

## Architecture

### Frontend
- Static HTML/CSS/JavaScript
- Rubik font with Tinkercademy branding
- Black (#000) and salmon (#FA8072) color theme
- Responsive design

### Backend (Netlify Functions)
- Serverless function: `submit-onboarding.js`
- PDPA-compliant data handling
- Automatic field computation
- Secure API key storage

### Security Features
- NRIC/FIN validation and redaction in logs
- CORS protection
- Environment variable encryption
- Input sanitization
- Error handling without exposing sensitive data

## Project Structure

```
freelancer-adder/
├── index.html              # Main form interface
├── styles.css              # Styling with black/salmon theme
├── script.js               # Form logic and validation
├── logo.png                # Tinkercademy logo
├── netlify.toml            # Netlify configuration
├── package.json            # Node.js dependencies
├── .env.example            # Environment variables template
├── netlify/
│   └── functions/
│       └── submit-onboarding.js  # Serverless API handler
├── README.md               # This file
└── CLAUDE.md               # Development notes
```

## API Response Format

### Success Response
```json
{
  "success": true,
  "message": "Employee created successfully",
  "employeeId": "EMP-12345"
}
```

### Error Response
```json
{
  "error": "Validation failed",
  "details": ["Start date is required for interns"]
}
```

## Troubleshooting

### Common Issues

1. **"Method not allowed" error**
   - Ensure you're using POST method
   - Check CORS configuration

2. **"Validation failed" errors**
   - Check all required fields are filled
   - Verify NRIC/FIN format (e.g., S1234567D)
   - Ensure dates are logical (end > start)

3. **"Internal server error"**
   - Check Netlify Function logs
   - Verify environment variables are set
   - Ensure Talenox API is accessible

### Debug Mode

The form works without Talenox credentials for testing:
- Validates all inputs
- Returns demo employee ID
- Logs would-be API payload

## Contributing

1. Create a feature branch
2. Make changes and test locally
3. Ensure PDPA compliance for any data handling
4. Submit pull request with description

## Support

For issues or questions:
- Check Netlify Function logs
- Review error messages in browser console
- Contact the development team