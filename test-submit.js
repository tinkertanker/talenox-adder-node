// Test script to submit data directly to our API
const testData = {
  employeeType: 'intern_school',
  fullName: 'Testing FROM_EMAIL 37',
  email: 'yjsoon+37@gmail.com',
  nric: 'S0000000D',
  nationality: 'Filipino',
  citizenshipStatus: 'other',
  dob: '1998-04-12',
  gender: 'female',
  startDate: '2025-08-01',
  endDate: '2025-12-15',
  bank: 'OCBC - Oversea-Chinese Banking Corporation Ltd',
  accountName: 'Testing FROM_EMAIL 37',
  accountNumber: '777888999'
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