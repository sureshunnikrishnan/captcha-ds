const request = require('supertest');
const app = require('../src/server');
const redisClient = require('../src/utils/redisClient');

jest.mock('../src/utils/redisClient');

describe('Configure Endpoint', () => {
    beforeAll(async () => {
        await redisClient.connect();
    });

    afterAll(async () => {
        await redisClient.disconnect();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        // Set valid API key for testing
        process.env.API_KEYS = 'test_key_1,test_key_2,valid_key';
    });

    test('sets default configuration successfully', async () => {
        const config = {
            default_settings: {
                font: 'Arial',
                background_color: '#FFFFFF',
                distortion_level: 'medium'
            }
        };

        redisClient.storeToken.mockResolvedValueOnce(true);

        const response = await request(app)
            .post('/api/v1/configure')
            .set('x-api-key', 'valid_key')
            .send(config);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'success');
        expect(redisClient.storeToken).toHaveBeenCalledWith(
            'config:valid_key',
            JSON.stringify(config.default_settings)
        );
    });

    test('returns 401 without API key', async () => {
        const response = await request(app)
            .post('/api/v1/configure')
            .send({});

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error', 'MISSING_API_KEY');
    });

    test('returns 400 with invalid configuration', async () => {
        const invalidConfig = {
            default_settings: {
                font: true, // Should be string
                background_color: 'not-a-color'
            }
        };

        const response = await request(app)
            .post('/api/v1/configure')
            .set('x-api-key', 'valid_key')
            .send(invalidConfig);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'INVALID_CONFIGURATION');
    });

    test('returns 400 when default_settings is missing', async () => {
        const response = await request(app)
            .post('/api/v1/configure')
            .set('x-api-key', 'valid_key')
            .send({});

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'INVALID_REQUEST');
    });

    test('handles Redis storage errors gracefully', async () => {
        redisClient.storeToken.mockRejectedValueOnce(new Error('Redis error'));

        const response = await request(app)
            .post('/api/v1/configure')
            .set('x-api-key', 'valid_key')
            .send({
                default_settings: {
                    font: 'Arial'
                }
            });

        expect(response.status).toBe(500);
        expect(response.body).toHaveProperty('error', 'CONFIGURATION_FAILED');
    });
});