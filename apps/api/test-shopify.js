import fetch from 'node-fetch';

async function testShopify() {
  try {
    console.log('Testing Shopify connection...');
    const response = await fetch('http://localhost:4000/shopify-test');
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testShopify();