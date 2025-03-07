const request = require('supertest');
const path = require('path');
const fs = require('fs').promises;
const app = require('../src/server');
const cdnClient = require('../src/utils/cdnClient');
const redisClient = require('../src/utils/redisClient');

jest.mock('../src/utils/cdnClient');
jest.mock('../src/utils/redisClient');

describe('Background Upload Endpoint', () => {
    const validApiKey = 'test_key_1';
    const testImageBuffer = Buffer.from('fake-image-data');

    beforeEach(() => {
        jest.clearAllMocks();
        // Set up valid API keys for testing
        process.env.API_KEYS = 'test_key_1,test_key_2';
        // Mock CDN client upload
        cdnClient.uploadFile.mockResolvedValue('https://cdn.example.com/backgrounds/test.png');
        // Mock Redis store
        redisClient.storeToken.mockResolvedValue(true);
    });

    test('successfully uploads a valid image file', async () => {
        const response = await request(app)
            .post('/api/upload-background')
            .set('x-api-key', validApiKey)
            .attach('file', testImageBuffer, 'test.png');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('background_id');
        expect(response.body).toHaveProperty('url');
        expect(response.body.url).toMatch(/^https:\/\/cdn\.example\.com\/backgrounds\//);
        expect(redisClient.storeToken).toHaveBeenCalled();
    });

    test('returns 401 without API key', async () => {
        const response = await request(app)
            .post('/api/upload-background')
            .attach('file', testImageBuffer, 'test.png');

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error', 'MISSING_API_KEY');
    });

    test('returns 400 when no file is uploaded', async () => {
        const response = await request(app)
            .post('/api/upload-background')
            .set('x-api-key', validApiKey);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'MISSING_FILE');
    });

    test('returns 400 for invalid file type', async () => {
        const response = await request(app)
            .post('/api/upload-background')
            .set('x-api-key', validApiKey)
            .attach('file', Buffer.from('fake-text'), 'test.txt');

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'INVALID_FILE_TYPE');
    });

    test('returns 400 for files larger than 5MB', async () => {
        // Create a buffer larger than 5MB
        const largeBuffer = Buffer.alloc(6 * 1024 * 1024);

        const response = await request(app)
            .post('/api/upload-background')
            .set('x-api-key', validApiKey)
            .attach('file', largeBuffer, 'large.png');

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error', 'FILE_TOO_LARGE');
    });

    test('handles CDN upload failure gracefully', async () => {
        cdnClient.uploadFile.mockRejectedValueOnce(new Error('CDN upload failed'));

        const response = await request(app)
            .post('/api/upload-background')
            .set('x-api-key', validApiKey)
            .attach('file', testImageBuffer, 'test.png');

        expect(response.status).toBe(500);
        expect(response.body).toHaveProperty('error', 'UPLOAD_FAILED');
    });

    test('handles Redis storage failure gracefully', async () => {
        redisClient.storeToken.mockRejectedValueOnce(new Error('Redis error'));

        const response = await request(app)
            .post('/api/upload-background')
            .set('x-api-key', validApiKey)
            .attach('file', testImageBuffer, 'test.png');

        expect(response.status).toBe(500);
        expect(response.body).toHaveProperty('error', 'UPLOAD_FAILED');
    });

    test('stores correct metadata in Redis', async () => {
        const response = await request(app)
            .post('/api/upload-background')
            .set('x-api-key', validApiKey)
            .attach('file', testImageBuffer, 'test.png');

        expect(response.status).toBe(200);
        
        // Verify Redis storage call
        expect(redisClient.storeToken).toHaveBeenCalledWith(
            expect.stringMatching(/^background:bg_/),
            expect.stringContaining('"apiKey":"test_key_1"'),
            365 * 24 * 60 * 60 // 1 year TTL
        );

        const storedData = JSON.parse(redisClient.storeToken.mock.calls[0][1]);
        expect(storedData).toHaveProperty('fileName');
        expect(storedData).toHaveProperty('url');
        expect(storedData).toHaveProperty('apiKey', validApiKey);
        expect(storedData).toHaveProperty('uploadedAt');
    });
});