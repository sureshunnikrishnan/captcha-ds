import http from 'k6/http';
import { sleep, check } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  vus: 50,  // Target 300 RPS with 50 VUs
  duration: '30m',
  thresholds: {
    'http_req_duration': ['p(95)<300'], // 95% of requests should be under 300ms
    'errors': ['rate<0.01'],          // Error rate should be less than 1%
  }
};

const API_KEY = 'api_key_test'; // Replace with your test API key

export default function () {
  // Generate CAPTCHA token
  const generateRes = http.post('http://localhost:3000/api/captcha/generate', null, {
    headers: { 'X-API-Key': API_KEY }
  });
  
  check(generateRes, {
    'token generated': (r) => r.status === 200,
    'has captchaId': (r) => JSON.parse(r.body).captchaId !== undefined,
  }) || errorRate.add(1);

  if (generateRes.status === 200) {
    const { captchaId } = JSON.parse(generateRes.body);
    
    // Get CAPTCHA image
    const imageRes = http.get(`http://localhost:3000/api/captcha/${captchaId}/image`, {
      headers: { 'X-API-Key': API_KEY }
    });
    
    check(imageRes, {
      'image retrieved': (r) => r.status === 200,
      'content-type correct': (r) => r.headers['Content-Type'].includes('image/'),
    }) || errorRate.add(1);

    // Validate CAPTCHA (simulating user input)
    const validateRes = http.post('http://localhost:3000/api/validate', {
      captchaId: captchaId,
      response: 'ABC123' // Simulated response
    }, {
      headers: { 'X-API-Key': API_KEY }
    });

    check(validateRes, {
      'validation processed': (r) => r.status === 200,
    }) || errorRate.add(1);
  }

  sleep(1); // Ensure we don't exceed rate limits
}