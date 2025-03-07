import http from 'k6/http';
import { sleep, check } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  vus: 50,
  duration: '1h', // Changed from 24h to 1h for initial testing
  thresholds: {
    'http_req_duration': ['p(95)<300'],
    'errors': ['rate<0.01'],
    'http_req_failed': ['rate<0.01'],    // HTTP errors should be less than 1%
    'iteration_duration': ['p(95)<2000'], // 95% of iterations should complete within 2s
  }
};

const API_KEY = 'api_key_test';

// Reuse the same test scenario but with longer sleep times to maintain
// steady load over 24 hours
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

  // Longer sleep time for soak test to maintain steady load
  sleep(2);
}