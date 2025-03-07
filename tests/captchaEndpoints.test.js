const request = require('supertest');
const app = require('../src/server');
const redisClient = require('../src/utils/redisClient');

jest.mock('../src/utils/redisClient');

describe('CAPTCHA Endpoints', () => {
    let validToken;
    let mockCaptchaData;

    beforeAll(async () => {
        await redisClient.connect();
    });

    afterAll(async () => {
        await redisClient.disconnect();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        validToken = 'test-token-123';
        mockCaptchaData = {
            code: 'ABC123',
            type: 'image',
            customization: {
                font: 'Arial',
                backgroundColor: '#FFFFFF'
            },
            attempts: 0
        };
    });

    describe('GET /captcha/:token.:format', () => {
        test('returns PNG image for valid token', async () => {
            redisClient.getToken.mockResolvedValueOnce(JSON.stringify(mockCaptchaData));

            const response = await request(app)
                .get(`/api/captcha/${validToken}.png`);

            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toBe('image/png');
            expect(Buffer.isBuffer(response.body)).toBe(true);
        });

        test('returns SVG image for valid token', async () => {
            redisClient.getToken.mockResolvedValueOnce(JSON.stringify(mockCaptchaData));

            const response = await request(app)
                .get(`/api/captcha/${validToken}.svg`);

            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toBe('image/svg+xml');
            expect(Buffer.isBuffer(response.body)).toBe(true);
        });

        test('returns 404 for invalid token', async () => {
            redisClient.getToken.mockResolvedValueOnce(null);

            const response = await request(app)
                .get(`/api/captcha/${validToken}.png`);

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('error', 'CAPTCHA_NOT_FOUND');
        });

        test('returns 400 for invalid format', async () => {
            const response = await request(app)
                .get(`/api/captcha/${validToken}.gif`);

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'INVALID_FORMAT');
        });
    });

    describe('GET /audio/:token.mp3', () => {
        test('returns MP3 audio for valid token', async () => {
            redisClient.getToken.mockResolvedValueOnce(JSON.stringify(mockCaptchaData));

            const response = await request(app)
                .get(`/api/audio/${validToken}.mp3`);

            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toBe('audio/mpeg');
            expect(response.headers['content-disposition']).toBe('attachment; filename="captcha.mp3"');
            expect(Buffer.isBuffer(response.body)).toBe(true);
        });

        test('returns 404 for invalid token', async () => {
            redisClient.getToken.mockResolvedValueOnce(null);

            const response = await request(app)
                .get(`/api/audio/${validToken}.mp3`);

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('error', 'CAPTCHA_NOT_FOUND');
        });

        test('handles audio generation errors gracefully', async () => {
            redisClient.getToken.mockRejectedValueOnce(new Error('Redis error'));

            const response = await request(app)
                .get(`/api/audio/${validToken}.mp3`);

            expect(response.status).toBe(500);
            expect(response.body).toHaveProperty('error', 'AUDIO_GENERATION_FAILED');
        });
    });

    describe('POST /validate', () => {
        test('validates correct response successfully', async () => {
            const mockToken = 'test-token';
            const mockData = {
                code: 'ABC123',
                type: 'image',
                customization: {},
                attempts: 0
            };
            redisClient.getToken.mockResolvedValueOnce(JSON.stringify(mockData));
            redisClient.storeToken.mockResolvedValueOnce(true);
            redisClient.deleteToken.mockResolvedValueOnce(true);

            const response = await request(app)
                .post('/api/validate')
                .send({
                    token: mockToken,
                    response: 'ABC123'
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('valid', true);
            expect(response.body).toHaveProperty('attempts_remaining', 0);
            expect(redisClient.deleteToken).toHaveBeenCalledWith(`token:${mockToken}`);
        });

        test('handles incorrect response and tracks attempts', async () => {
            const mockToken = 'test-token';
            const mockData = {
                code: 'ABC123',
                type: 'image',
                customization: {},
                attempts: 0
            };
            redisClient.getToken.mockResolvedValueOnce(JSON.stringify(mockData));
            redisClient.storeToken.mockResolvedValueOnce(true);

            const response = await request(app)
                .post('/api/validate')
                .send({
                    token: mockToken,
                    response: 'WRONG123'
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('valid', false);
            expect(response.body).toHaveProperty('attempts_remaining', 2);
            expect(redisClient.storeToken).toHaveBeenCalledWith(
                `token:${mockToken}`, 
                expect.stringContaining('"attempts":1')
            );
        });

        test('handles case-insensitive validation', async () => {
            const mockData = {
                code: 'ABC123',
                type: 'image',
                customization: {},
                attempts: 0
            };
            redisClient.getToken.mockResolvedValueOnce(JSON.stringify(mockData));
            redisClient.storeToken.mockResolvedValueOnce(true);
            redisClient.deleteToken.mockResolvedValueOnce(true);

            const response = await request(app)
                .post('/api/validate')
                .send({
                    token: 'test-token',
                    response: 'abc123'
                });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('valid', true);
        });

        test('returns 400 when missing required fields', async () => {
            const response = await request(app)
                .post('/api/validate')
                .send({
                    token: 'test-token'
                    // missing response
                });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('error', 'INVALID_REQUEST');
        });

        test('returns 404 for invalid token', async () => {
            redisClient.getToken.mockResolvedValueOnce(null);

            const response = await request(app)
                .post('/api/validate')
                .send({
                    token: 'invalid-token',
                    response: 'ABC123'
                });

            expect(response.status).toBe(404);
            expect(response.body).toHaveProperty('error', 'CAPTCHA_NOT_FOUND');
        });

        test('returns 429 when max attempts reached', async () => {
            const mockData = {
                code: 'ABC123',
                type: 'image',
                customization: {},
                attempts: 3
            };
            redisClient.getToken.mockResolvedValueOnce(JSON.stringify(mockData));
            redisClient.deleteToken.mockResolvedValueOnce(true);

            const response = await request(app)
                .post('/api/validate')
                .send({
                    token: 'test-token',
                    response: 'ABC123'
                });

            expect(response.status).toBe(429);
            expect(response.body).toHaveProperty('error', 'MAX_ATTEMPTS_REACHED');
            expect(redisClient.deleteToken).toHaveBeenCalled();
        });

        test('handles validation error gracefully', async () => {
            redisClient.getToken.mockRejectedValueOnce(new Error('Redis error'));

            const response = await request(app)
                .post('/api/validate')
                .send({
                    token: 'test-token',
                    response: 'ABC123'
                });

            expect(response.status).toBe(500);
            expect(response.body).toHaveProperty('error', 'VALIDATION_FAILED');
        });
    });
});