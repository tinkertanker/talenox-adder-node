# Talenox Integration Plan

## Field Mapping

### Current Form Fields to Talenox API
| Form Field | Talenox Field | Notes |
|------------|---------------|-------|
| fullName | first_name | Full legal name goes here, last_name left blank |
| email | user_account_email | For payroll system access |
| nric | identification_number | Required for all employees |
| employeeId | employee_id | Pre-existing from Talenox |
| dob | date_of_birth | Personal details section |
| bank | bank_name | Payment method |
| accountName | bank_account_name | Must match exactly |
| accountNumber | bank_account_number | Digits only |

### Missing Required Fields
1. **hired_date** - Start date of employment
2. **immigration_status** - Determines CPF/SDL contributions:
   - "Contract (No CPF, No SDL)" for freelancers/trainers
   - "Intern" for current secondary/JC students
   - "Singapore Citizen"/"Singapore PR" for others
3. **job_title** - Position/role
4. **basic_salary** - Pay amount
5. **nationality** - Required field
6. **resign_date** - For trainers (day after start date)

## Backend Architecture

### Technology Stack
- **Backend Framework**: Node.js with Express (recommended)
- **Database**: PostgreSQL/MySQL for storing form submissions
- **Security**: HTTPS, encryption for sensitive data
- **API Integration**: Axios for Talenox API calls

### API Flow
1. Form submission → Backend validation
2. Store encrypted data in database
3. Call Talenox API to create employee
4. Handle response and errors
5. Send confirmation email

### Security Considerations
- Encrypt NRIC and bank details at rest
- Use environment variables for API keys
- Implement rate limiting
- Add CORS protection
- Validate all inputs server-side

## Next Steps
1. Add missing fields to the form
2. Create backend API endpoint
3. Implement Talenox API client
4. Add error handling and validation
5. Test with Talenox sandbox