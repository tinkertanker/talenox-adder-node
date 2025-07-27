# Tinkercademy Employee Onboarding System

A comprehensive, production-ready onboarding system that fully automates employee creation in Talenox with integrated HR notifications.

## Overview

This system completely automates the employee onboarding process by:
- Collecting all required information in a single comprehensive form
- **Automatically creating employees in Talenox** with proper field mapping
- **Auto-generating sequential employee IDs** (300+ range)
- **Creating jobs and setting up user accounts** with automatic invitations
- **Sending HR notifications** with employee details and internal IDs
- Supporting **200+ nationalities** with proper citizenship status mapping
- Handling **all major Singapore banks** with correct Talenox formatting
- **Background processing** with 15-minute timeout for reliable API operations

## Current Process vs. Automated Process

### Old Manual Process
1. Collect basic info (name, email, NRIC)
2. Manually create Talenox entry
3. Employee receives Talenox invitation email
4. Employee fills additional information in Talenox
5. Employee submits bank details via separate Google Form
6. HR manually processes and updates records

### New Automated Process
1. Employee fills **single comprehensive form** (2-3 minutes)
2. System **automatically creates complete Talenox employee** with all data
3. System **generates sequential internal employee ID** (300+ range)
4. System **creates appropriate job** with correct pay structure
5. System **sends Talenox account invitation** automatically
6. System **notifies HR** with internal employee ID and details
7. **Done!** Employee receives Talenox login instructions immediately

## Core Features

### ✅ Complete Talenox Integration
- **Live API Integration**: Creates actual employees in Talenox production system
- **Auto-incrementing Employee IDs**: Sequential internal numbering (300+ range)
- **Complete Job Creation**: Automatic job setup with correct pay structures
- **User Account Setup**: Automatic Talenox account creation with email invitations
- **Banking Integration**: Proper bank field mapping with nested object structure

### ✅ Employee Types Supported
- **Freelance Trainer**: Contract workers (No CPF/SDL) - $0 pay
- **Intern with School Letter**: Official internship - $800/month
- **Intern without School Letter**: Non-official internship - $800/month  
- **Full-time Employee**: Permanent staff - $3000/month

### ✅ Comprehensive Data Collection
- **Personal Details**: Name, email, NRIC/FIN, DOB, gender
- **Nationality**: 200+ countries from official Talenox list
- **Citizenship Status**: Singapore Citizen/PR/Others (for CPF/SDL determination)
- **Employment Dates**: Smart conditional fields based on employee type
- **Banking**: All major Singapore banks (DBS, POSB, OCBC, UOB, Standard Chartered, Citibank, HSBC, Maybank, Trust Bank)

### ✅ Intelligent Automation
- **Citizenship Mapping**: Automatic CPF/SDL status based on employee type + citizenship
- **Date Logic**: Smart employment date handling per employee type
- **Job Creation**: Automatic job setup with appropriate pay and duration
- **HR Notifications**: Email alerts with internal employee ID and complete details

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
   - `TALENOX_API_URL`: Talenox API endpoint (https://api.talenox.com/api/v2)
   - `RESEND_API_KEY`: Your Resend.com API key for email notifications
   - `NOTIFY_EMAIL`: HR email address for notifications (e.g., hr.onboarding@tinkertanker.com)
   - `FROM_EMAIL`: Sender email address (e.g., "Tinkercademy Onboarding <hr.onboarding@tinkertanker.com>")
   - `ALLOWED_ORIGINS`: Your production URL (optional)

4. **Test the Deployment**
   - ✅ **Production Ready**: System creates real Talenox employees immediately
   - ✅ **Employee IDs**: Auto-generates sequential internal IDs (300+ range)
   - ✅ **Job Creation**: Automatically creates jobs with correct pay structures
   - ✅ **Email Notifications**: HR receives notifications with employee details
   - Check Functions tab in Netlify for detailed logs

## Architecture

### Frontend
- Static HTML/CSS/JavaScript
- Rubik font with Tinkercademy branding
- Black (#000) and salmon (#FA8072) color theme
- Responsive design

### Backend (Netlify Background Functions)
- **Background Processing**: 15-minute timeout for reliable API operations
- **Async Processing**: Returns 202 immediately, processes in background
- **Production Talenox Integration**: Live API calls to create employees and jobs
- **Email Notifications**: Resend.com integration for HR alerts
- **Auto-incrementing IDs**: Sequential employee ID generation (300+ range)
- **PDPA-compliant**: Sensitive data redaction in logs
- **Complete Automation**: Employee → Job → User Account → Notification flow

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
├── docs/                   # Documentation
│   ├── BACKGROUND_FUNCTIONS_SUMMARY.md    # Background Functions migration guide
│   ├── EDGE_FUNCTIONS_MIGRATION_PLAN.md   # Edge Functions analysis
│   └── SELF_HOSTING_MIGRATION.md          # Self-hosting analysis
├── netlify/
│   └── functions/
│       ├── submit-onboarding.js           # Original function (kept for compatibility)
│       └── submit-onboarding-background.js # Background function with 15-min timeout
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

## Background Processing

As of the latest update, the system uses **Netlify Background Functions** to handle long-running operations:

### How It Works
1. User submits form → Immediate 202 Accepted response
2. System processes in background (up to 15 minutes)
3. Creates employee → Creates job → Sends notifications
4. User sees "processing" message with instructions

### Benefits
- **No more timeouts**: 15-minute limit vs 10-second regular functions
- **Better reliability**: Handles slow API responses gracefully
- **Same code**: Minimal changes from regular functions
- **Automatic retry**: Built-in error handling

### User Experience
- Form submission feels instant (< 1 second)
- Clear messaging about background processing
- Instructions to check email for confirmation
- HR contact info if issues arise

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