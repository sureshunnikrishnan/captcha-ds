const request = require('supertest');
const app = require('../src/server');
const redisClient = require('../src/utils/redisClient');

jest.mock('../src/utils/redisClient');

describe('Token Generation Endpoint', () => {
    beforeAll(async () => {
        await redisClient.connect();
    });

    afterAll(async () => {
        await redisClient.disconnect();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('generates a token with default settings', async () => {
        const response = await request(app)
            .post('/api/generate-token');
        
        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('token');
        expect(response.body).toHaveProperty('captcha_id');
        expect(response.body).toHaveProperty('expires_at');
        expect(typeof response.body.token).toBe('string');
        expect(typeof response.body.captcha_id).toBe('string');
        expect(typeof response.body.expires_at).toBe('number');
    });

    test('generates a token with custom image options', async () => {
        const response = await request(app)
            .post('/api/generate-token')
            .send({
                type: 'image',
                customization: {
                    font: 'Arial',
                    backgroundColor: '#FFFFFF'
                }
            });
        
        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('token');
        expect(response.body).toHaveProperty('captcha_id');
    });

    test('generates a token with custom audio options', async () => {
        const response = await request(app)
            .post('/api/generate-token')
            .send({
                type: 'audio',
                customization: {
                    speed: 1.0,
                    noise: 0.3
                }
            });
        
        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('token');
        expect(response.body).toHaveProperty('captcha_id');
    });

    test('rejects invalid CAPTCHA type', async () => {
        const response = await request(app)
            .post('/api/generate-token')
            .send({
                type: 'invalid',
                customization: {}
            });
        
        expect(response.statusCode).toBe(400);
        expect(response.body).toHaveProperty('error', 'INVALID_TYPE');
    });

    test('stores token data in Redis with TTL', async () => {
        const mockStoreToken = jest.spyOn(redisClient, 'storeToken');
        
        const response = await request(app)
            .post('/api/generate-token');
        
        expect(response.statusCode).toBe(200);
        expect(mockStoreToken).toHaveBeenCalled();
        
        const storeTokenArgs = mockStoreToken.mock.calls[0];
        expect(storeTokenArgs[0]).toMatch(/^token:/);
        expect(storeTokenArgs[2]).toBe(180); // 3 minutes TTL
        
        const storedData = JSON.parse(storeTokenArgs[1]);
        expect(storedData).toHaveProperty('code');
        expect(storedData).toHaveProperty('type');
        expect(storedData).toHaveProperty('customization');
        expect(storedData).toHaveProperty('attempts', 0);
    });

    test('handles internal errors gracefully', async () => {
        // Mock Redis store failure
        redisClient.storeToken.mockRejectedValueOnce(new Error('Redis error'));
        
        const response = await request(app)
            .post('/api/generate-token');
        
        expect(response.statusCode).toBe(500);
        expect(response.body).toHaveProperty('error', 'TOKEN_GENERATION_FAILED');
    });
});