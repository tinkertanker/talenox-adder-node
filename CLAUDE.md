# Freelancer Adder - Talenox Integration Project

## Project Overview
This project creates a simplified onboarding form for Tinkercademy freelancers that integrates with the Talenox API to automate employee data entry.

## Current State
- **Completed**: Basic front-end form with two pages collecting freelancer information
- **TODO**: Integrate with Talenox API to automatically create employee records

## Business Context
Tinkercademy currently uses a two-step process for freelancer onboarding:
1. Freelancers receive a Talenox invitation email to fill out their profile
2. Freelancers submit bank details via Google Forms

This project aims to streamline this into a single form that automatically populates Talenox.

## Key Requirements
1. Collect essential freelancer information:
   - Full legal name
   - Email for payroll system
   - NRIC number (or work eligibility confirmation)
   - Date of birth
   - Bank details (bank name, account name, account number)

2. Integrate with Talenox API to:
   - Create new employee records
   - Populate required fields automatically
   - Handle Singapore-specific requirements (SHG contributions, immigration status, etc.)

## Talenox Specific Notes
- **First Name**: Should contain the full legal name (e.g., "John Tan Ah Kow")
- **Last Name**: Must be left blank (Talenox requirement)
- **Immigration Status**: Set based on NRIC/work eligibility
- **Required Fields**: Basic salary, hired date, job details, identification number

## Technical Stack
- Frontend: HTML, CSS, JavaScript (vanilla)
- Backend: TBD - needs to handle Talenox API integration
- API: Talenox API (documentation needed)

## Next Steps
1. Obtain Talenox API credentials and documentation
2. Create backend service to handle form submissions
3. Implement Talenox API integration
4. Add error handling and validation
5. Test with real Talenox sandbox environment

## Important Considerations
- PDPA compliance for NRIC collection
- Secure handling of sensitive personal and banking information
- Validation of Singapore-specific formats (NRIC, bank accounts)
- Handle different employee types (contractors vs full-time)

## Files
- `index.html` - Main form interface
- `styles.css` - Form styling
- `script.js` - Form validation and client-side logic