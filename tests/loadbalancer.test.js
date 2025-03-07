const axios = require('axios');

async function testLoadBalancer() {
  const NUM_REQUESTS = 10;
  const results = new Map();
  
  console.log('Testing load balancer distribution...\n');
  
  for (let i = 0; i < NUM_REQUESTS; i++) {
    try {
      const response = await axios.get('http://localhost/api/health');
      const serverPort = response.headers['x-server-port'];
      
      results.set(serverPort, (results.get(serverPort) || 0) + 1);
      console.log(`Request ${i + 1}: Handled by server on port ${serverPort}`);
    } catch (error) {
      console.error(`Request ${i + 1} failed:`, error.message);
    }
  }
  
  console.log('\nRequest distribution across servers:');
  for (const [port, count] of results.entries()) {
    console.log(`Server on port ${port}: ${count} requests (${(count/NUM_REQUESTS*100).toFixed(1)}%)`);
  }
}

// Only run if called directly
if (require.main === module) {
  testLoadBalancer().catch(console.error);
}

module.exports = { testLoadBalancer };