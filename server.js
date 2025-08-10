const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
const corsOptions = {
  origin: function(origin, callback) {
    // In production, require explicit ALLOWED_ORIGINS
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.ALLOWED_ORIGINS) {
        return callback(new Error('ALLOWED_ORIGINS not configured'));
      }
      const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',');
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      // Development: allow localhost
      const devOrigins = ['http://localhost:3000', 'http://localhost:8888'];
      if (!origin || devOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(null, true); // Allow all in development
      }
    }
  },
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
    
    // Send response with safe JSON parsing
    try {
      const responseBody = typeof result.body === 'string' 
        ? JSON.parse(result.body) 
        : result.body;
      res.status(result.statusCode).json(responseBody);
    } catch (parseError) {
      console.error('Error parsing response body:', parseError);
      res.status(500).json({
        success: false,
        message: 'Invalid response format'
      });
    }
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