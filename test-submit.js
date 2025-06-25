// Test script to submit data directly to our API
const testData = {
  employeeType: 'trainer',
  fullName: 'Testing Email Debug 41',
  email: 'yjsoon+41@gmail.com',
  nric: 'S0000000D',
  nationality: 'Thai',
  citizenshipStatus: 'other',
  dob: '1995-06-20',
  gender: 'female',
  bank: 'Standard Chartered',
  accountName: 'Testing Email Debug 41',
  accountNumber: '555444333'
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