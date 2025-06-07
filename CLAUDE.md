# Tinkercademy Employee Onboarding - Development Notes

## Project Overview
This project creates a simplified onboarding form for Tinkercademy employees that integrates with the Talenox API to automate employee data entry.

## Current Status (Updated)

### Completed ✅
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

### TODO 🚧
- Backend service for form submission
- Talenox API integration
- Data validation and error handling
- Security measures for sensitive data
- Testing with Talenox sandbox

## Technical Implementation

### Form Logic
The form uses vanilla JavaScript to:
1. Show/hide date fields based on employee type
2. Validate all required fields
3. Compute Talenox-specific fields automatically
4. Display success message with instructions

### Employee Type Rules
- **Trainers**: No date input needed (auto-filled as 1st of last month)
- **Interns**: Require both start and end dates
- **Full-timers**: Require only start date

### Talenox Field Mapping
- First Name: Full legal name (Last Name left blank)
- Immigration Status: Computed based on type and nationality
- Job Title: "Freelance Trainer" or "Tinkercademy Intern"
- Dates: Hired/resign dates match job start/end dates
- Basic Salary: 0 for freelancers

## Development Guidelines

### When Adding Features
1. Maintain the single-page form structure
2. Follow existing validation patterns
3. Update computed fields logic as needed
4. Test all employee type scenarios

### API Integration Considerations
- Secure credential storage
- Error handling for API failures
- Data validation before submission
- Logging for troubleshooting

## Important Notes
- NRIC/FIN handling must comply with PDPA
- Bank account validation should check format only
- All dates use ISO format (YYYY-MM-DD)
- Form data structure is documented in README.md