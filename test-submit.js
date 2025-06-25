// Test script to submit data directly to our API
const testData = {
  employeeType: 'trainer',
  fullName: 'Testing NOTIFY_EMAIL 42',
  email: 'yjsoon+42@gmail.com',
  nric: 'S0000000D',
  nationality: 'Vietnamese',
  citizenshipStatus: 'other',
  dob: '1988-03-14',
  gender: 'male',
  bank: 'UOB - United Overseas Bank Ltd',
  accountName: 'Testing NOTIFY_EMAIL 42',
  accountNumber: '666777888'
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