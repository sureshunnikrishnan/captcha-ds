/**
 * API Server Integration Tests
 * 
 * Tests the API server with middleware integrated
 */

const request = require('supertest');
const app = require('../src/server');

describe('API Server', () => {
  describe('Public Endpoints', () => {
    test('GET /api/health should return 200', async () => {
      const response = await request(app).get('/api/health');
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
    });
    
    test('GET /api/nonexistent should return 404', async () => {
      const response = await request(app).get('/api/nonexistent');
      expect(response.statusCode).toBe(404);
      expect(response.body).toHaveProperty('error', 'NOT_FOUND');
    });
  });
  
  describe('Protected Endpoints', () => {
    test('GET /api/v1/protected without API key should return 401', async () => {
      const response = await request(app).get('/api/v1/protected');
      expect(response.statusCode).toBe(401);
      expect(response.body).toHaveProperty('error', 'MISSING_API_KEY');
    });
    
    test('GET /api/v1/protected with invalid API key should return 401', async () => {
      const response = await request(app)
        .get('/api/v1/protected')
        .set('x-api-key', 'invalid_key');
        
      expect(response.statusCode).toBe(401);
      expect(response.body).toHaveProperty('error', 'INVALID_API_KEY');
    });
    
    test('GET /api/v1/protected with valid API key should return 200', async () => {
      // Set a valid API key for testing
      process.env.API_KEYS = 'test_key_1,test_key_2,valid_key';
      
      const response = await request(app)
        .get('/api/v1/protected')
        .set('x-api-key', 'valid_key');
        
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('status', 'success');
    });
  });
});