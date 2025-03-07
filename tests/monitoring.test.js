const request = require('supertest');
const app = require('../src/server');
const { metrics } = require('../src/config/monitoring');
const redisClient = require('../src/utils/redisClient');

describe('Monitoring Setup', () => {
    beforeAll(async () => {
        await redisClient.connect();
    });

    afterAll(async () => {
        await redisClient.disconnect();
    });

    it('should expose metrics endpoint', async () => {
        const response = await request(app).get('/metrics');
        expect(response.status).toBe(200);
        expect(response.text).toContain('captcha_generation_total');
        expect(response.text).toContain('redis_connection_status');
    });

    it('should track captcha generation', async () => {
        const beforeMetrics = await request(app).get('/metrics');
        const initialCount = Number(beforeMetrics.text.match(/captcha_generation_total\s+(\d+)/)?.[1] || 0);
        
        metrics.captchaGenerationCounter.inc();
        
        const afterMetrics = await request(app).get('/metrics');
        const newCount = Number(afterMetrics.text.match(/captcha_generation_total\s+(\d+)/)?.[1] || 0);
        expect(newCount).toBe(initialCount + 1);
    });

    it('should track captcha verification with status', async () => {
        metrics.captchaVerificationCounter.inc({ status: 'success' });
        const response = await request(app).get('/metrics');
        expect(response.text).toContain('captcha_verification_total{status="success"}');
    });

    it('should track Redis connection status', async () => {
        const response = await request(app).get('/metrics');
        expect(response.text).toContain('redis_connection_status 1');
    });

    it('should include HTTP request metrics', async () => {
        await request(app).get('/api/nonexistent');
        const response = await request(app).get('/metrics');
        expect(response.text).toContain('http_requests_total');
        expect(response.text).toMatch(/status="4XX"/);
    });
});