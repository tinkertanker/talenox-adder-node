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
  - Trainers: Auto-filled as 1st of previous month
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

## Setup

1. Clone the repository
2. Serve the files using any web server
3. Access `index.html` in a web browser

## Next Steps

1. **Backend Development**
   - Create server to handle form submissions
   - Implement secure data storage
   - Add validation and error handling

2. **Talenox API Integration**
   - Obtain API credentials
   - Implement employee creation endpoint
   - Handle API responses and errors

3. **Security & Compliance**
   - Implement HTTPS
   - Add PDPA compliance measures
   - Secure handling of NRIC/FIN numbers
   - Encrypt sensitive data

4. **Testing**
   - Test with Talenox sandbox
   - Validate all employee type scenarios
   - User acceptance testing

## Files

- `index.html` - Main form interface
- `styles.css` - Styling with black/salmon theme
- `script.js` - Form logic and validation
- `logo.png` - Tinkercademy logo
- `CLAUDE.md` - Development notes and requirements