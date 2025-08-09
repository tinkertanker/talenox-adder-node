const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : true,
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Import the onboarding handler
const submitOnboarding = require('./netlify/functions/submit-onboarding-background');

// Convert Netlify function to Express endpoint
app.post('/api/submit-onboarding', async (req, res) => {
  try {
    // Simulate Netlify event object
    const event = {
      body: JSON.stringify(req.body),
      headers: req.headers,
      httpMethod: req.method
    };

    // Call the function handler
    const result = await submitOnboarding.handler(event);
    
    // Send response
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (error) {
    console.error('Error in submit-onboarding:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Handle OPTIONS for CORS preflight
app.options('/api/submit-onboarding', (req, res) => {
  res.status(200).end();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'tinkercademy-onboarding'
  });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});