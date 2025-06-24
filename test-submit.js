// Test script to submit data directly to our API
const testData = {
  employeeType: 'trainer',
  fullName: 'Testing 16',
  email: 'yjsoon@gmail.com',
  nric: 'S0000000D',
  nationality: 'sg_citizen',
  dob: '1990-01-01',
  gender: 'male',
  bank: 'DBS',
  accountName: 'Testing 16',
  accountNumber: '049409991',
  // These will be computed by the form logic
  immigrationStatus: 'Contract (No CPF, No SDL)',
  jobTitle: 'Freelance Trainer',
  basicSalary: 0
};

async function testSubmit() {
  try {
    console.log('Submitting test data:', testData);
    
    const response = await fetch('http://localhost:8888/.netlify/functions/submit-onboarding', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });
    
    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Response:', result);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testSubmit();