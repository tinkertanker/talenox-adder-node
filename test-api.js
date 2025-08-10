#!/usr/bin/env node

/**
 * Test script for the onboarding API
 * Usage: node test-api.js
 */

const http = require('http');

// Test data for different employee types
const testCases = {
  trainer: {
    employeeType: 'trainer',
    fullName: 'Test Trainer',
    email: 'test.trainer@example.com',
    nric: 'S1234567A',
    nationality: 'sg_citizen',
    citizenshipStatus: 'Singapore Citizen',
    dob: '1990-01-15',
    gender: 'male',
    bank: 'DBS',
    accountName: 'Test Trainer',
    accountNumber: '1234567890'
  },
  intern: {
    employeeType: 'intern_school',
    fullName: 'Test Intern',
    email: 'test.intern@example.com',
    nric: 'T9876543B',
    nationality: 'sg_pr',
    citizenshipStatus: 'Singapore PR',
    dob: '2000-06-20',
    gender: 'female',
    startDate: '2025-02-01',
    endDate: '2025-05-31',
    bank: 'OCBC',
    accountName: 'Test Intern',
    accountNumber: '9876543210'
  },
  fulltime: {
    employeeType: 'fulltime',
    fullName: 'Test Fulltime',
    email: 'test.fulltime@example.com',
    nric: 'G1122334C',
    nationality: 'other',
    citizenshipStatus: 'Others',
    dob: '1985-03-10',
    gender: 'male',
    startDate: '2025-02-15',
    bank: 'UOB',
    accountName: 'Test Fulltime',
    accountNumber: '5555666677'
  }
};

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3000';
const TEST_TYPE = process.argv[2] || 'trainer';

async function testAPI(testData) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(testData);
    
    const options = {
      hostname: new URL(API_URL).hostname,
      port: new URL(API_URL).port || 80,
      path: '/api/submit-onboarding',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log(`\n📧 Testing ${testData.employeeType} submission...`);
    console.log(`URL: ${API_URL}/api/submit-onboarding`);
    console.log(`Data:`, JSON.stringify(testData, null, 2));

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`\n📬 Response Status: ${res.statusCode}`);
        
        try {
          const response = JSON.parse(data);
          console.log('Response:', JSON.stringify(response, null, 2));
          
          if (res.statusCode === 200 || res.statusCode === 202) {
            console.log('✅ Test passed!');
            resolve(response);
          } else {
            console.log('❌ Test failed with status:', res.statusCode);
            reject(new Error(`HTTP ${res.statusCode}: ${response.message || 'Unknown error'}`));
          }
        } catch (e) {
          console.log('❌ Failed to parse response:', data);
          reject(e);
        }
      });
    });

    req.on('error', (e) => {
      console.error('❌ Request failed:', e.message);
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

async function testHealthCheck() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: new URL(API_URL).hostname,
      port: new URL(API_URL).port || 80,
      path: '/api/health',
      method: 'GET'
    };

    console.log(`\n🏥 Testing health check...`);
    console.log(`URL: ${API_URL}/api/health`);

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('Health Check Response:', JSON.stringify(response, null, 2));
          
          if (res.statusCode === 200 && response.status === 'healthy') {
            console.log('✅ Health check passed!');
            resolve(response);
          } else {
            console.log('❌ Health check failed');
            reject(new Error('Health check failed'));
          }
        } catch (e) {
          console.log('❌ Failed to parse health check response');
          reject(e);
        }
      });
    });

    req.on('error', (e) => {
      console.error('❌ Health check failed:', e.message);
      reject(e);
    });

    req.end();
  });
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting API Tests');
  console.log('=' .repeat(50));
  
  try {
    // First test health check
    await testHealthCheck();
    
    // Then test the specified employee type
    if (testCases[TEST_TYPE]) {
      await testAPI(testCases[TEST_TYPE]);
    } else {
      console.log(`\n❌ Invalid test type: ${TEST_TYPE}`);
      console.log('Available types: trainer, intern, fulltime');
      process.exit(1);
    }
    
    console.log('\n✅ All tests completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Show usage
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: node test-api.js [employee-type]

Employee types:
  - trainer   : Test freelance trainer submission
  - intern    : Test intern submission
  - fulltime  : Test full-time employee submission

Environment variables:
  API_URL     : API endpoint (default: http://localhost:3000)

Examples:
  node test-api.js                    # Test trainer (default)
  node test-api.js intern              # Test intern
  API_URL=http://localhost:3001 node test-api.js fulltime
  `);
  process.exit(0);
}

// Run tests
runTests();