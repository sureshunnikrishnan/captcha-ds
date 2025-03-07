import http from 'k6/http';
import { sleep, check } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 50 },    // Ramp up to normal load
    { duration: '5m', target: 100 },   // Ramp up to peak load (500 RPS)
    { duration: '2m', target: 100 },   // Stay at peak load
    { duration: '1m', target: 50 },    // Scale down
    { duration: '1m', target: 0 },     // Scale down to 0
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500'], // Allow higher latency during peak
    'errors': ['rate<0.05'],            // Allow slightly higher error rate during peak
    'http_req_failed': ['rate<0.05'],   // Allow up to 5% failed requests during peak
  }
};

const API_KEY = 'api_key_test';

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

    // Validate CAPTCHA
    const validateRes = http.post('http://localhost:3000/api/validate', {
      captchaId: captchaId,
      response: 'ABC123'
    }, {
      headers: { 'X-API-Key': API_KEY }
    });

    check(validateRes, {
      'validation processed': (r) => r.status === 200,
    }) || errorRate.add(1);
  }

  // Minimal sleep during peak test to generate high load
  sleep(0.5);
}