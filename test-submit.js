// Test script to submit data directly to our API
const testData = {
  employeeType: 'trainer',
  fullName: 'Testing HR Email 35',
  email: 'yjsoon+35@gmail.com',
  nric: 'S0000000D',
  nationality: 'South Korean',
  citizenshipStatus: 'other',
  dob: '1985-09-08',
  gender: 'male',
  bank: 'DBS',
  accountName: 'Testing HR Email 35',
  accountNumber: '111222333'
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