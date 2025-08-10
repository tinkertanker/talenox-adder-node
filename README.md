# Tinkercademy Employee Onboarding System

Automated onboarding system for Tinkercademy employees with Talenox integration.

## Overview

A streamlined web form that automates employee onboarding by:
- Collecting employee information in a single form
- Creating employee records in Talenox automatically
- Sending notifications to HR
- Supporting multiple employee types (trainers, interns, full-time)

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your API credentials

# Run locally
npm run dev
# Visit http://localhost:3000
```

### Docker Deployment

```bash
# Build and run with Docker
docker-compose up -d
# Access at configured URL (e.g., https://hr-onboarding.tk.sg)
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions.

## Configuration

Required environment variables in `.env`:
- `TALENOX_API_KEY` - Talenox API credentials
- `TALENOX_API_URL` - API endpoint (default: https://api.talenox.com/api/v2)
- `RESEND_API_KEY` - Email service API key
- `NOTIFY_EMAIL` - HR notification email
- `FROM_EMAIL` - Sender email address

## Features

- **Employee Types**: Support for trainers, interns, and full-time employees
- **Data Validation**: NRIC/FIN format validation and required field checks
- **Banking Integration**: Support for major Singapore banks
- **Background Processing**: Handles long-running API operations reliably
- **Email Notifications**: Automatic HR notifications upon submission
- **PDPA Compliant**: Sensitive data redaction in logs

## Project Structure

```
├── index.html              # Main form interface
├── styles.css              # Styling
├── script.js               # Form logic
├── server.js               # Express.js server
├── backend/
│   └── submit-onboarding.js    # API handler
├── docker-compose.yml      # Docker configuration
├── Dockerfile              # Container definition
└── docs/                   # Additional documentation
```

## Testing

Use the included test tools:

```bash
# Command-line API testing
node test-api.js [trainer|intern|fulltime]

# Browser testing
# Open http://localhost:3000/test.html after starting server
```

## Troubleshooting

**Common Issues:**
- Validation errors: Check NRIC format (e.g., S1234567D)
- Server errors: Check logs with `docker-compose logs`
- CORS issues: Verify ALLOWED_ORIGINS in environment

## Support

For issues or questions:
- Check container logs: `docker-compose logs`
- Review browser console for errors
- Contact the development team

## License

Internal use only - Tinkercademy/Tinkertanker