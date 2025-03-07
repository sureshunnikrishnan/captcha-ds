/**
 * CAPTCHA Generator Tests
 */
const { generateCode, generateImage, generateCaptcha } = require('../src/utils/captcha/generator');
const { generateAudioCaptcha } = require('../src/utils/captcha/audioGenerator');

/**
 * CAPTCHA Integration Tests
 */
const request = require('supertest');
const app = require('../src/server');
const redisClient = require('../src/utils/redisClient');

jest.mock('../src/utils/redisClient');

describe('CAPTCHA Generator', () => {
    describe('generateCode', () => {
        test('generates a 6-character code', () => {
            const code = generateCode();
            expect(code.length).toBe(6);
        });

        test('generates only alphanumeric characters', () => {
            const code = generateCode();
            expect(code).toMatch(/^[A-Z0-9]+$/);
        });

        test('generates different codes on successive calls', () => {
            const code1 = generateCode();
            const code2 = generateCode();
            expect(code1).not.toBe(code2);
        });
    });

    describe('generateImage', () => {
        test('generates a PNG image buffer with default settings', async () => {
            const code = 'ABC123';
            const imageBuffer = await generateImage(code);
            
            expect(Buffer.isBuffer(imageBuffer)).toBe(true);
            expect(imageBuffer.toString('hex', 0, 8)).toMatch(/89504e47/); // PNG magic number
        });

        test('generates image with custom font', async () => {
            const code = 'ABC123';
            const options = {
                font: 'Arial'
            };
            const imageBuffer = await generateImage(code, options);
            
            expect(Buffer.isBuffer(imageBuffer)).toBe(true);
            expect(imageBuffer.toString('hex', 0, 8)).toMatch(/89504e47/);
        });

        test('generates image with custom background color', async () => {
            const code = 'ABC123';
            const options = {
                backgroundColor: '#FF0000'
            };
            const imageBuffer = await generateImage(code, options);
            
            expect(Buffer.isBuffer(imageBuffer)).toBe(true);
            expect(imageBuffer.toString('hex', 0, 8)).toMatch(/89504e47/);
        });

        test('handles invalid custom font gracefully', async () => {
            const code = 'ABC123';
            const options = {
                font: 'NonexistentFont'
            };
            const imageBuffer = await generateImage(code, options);
            
            expect(Buffer.isBuffer(imageBuffer)).toBe(true);
            expect(imageBuffer.toString('hex', 0, 8)).toMatch(/89504e47/);
        });
    });

    describe('generateCaptcha', () => {
        test('generates a complete CAPTCHA object with default settings', async () => {
            const captcha = await generateCaptcha();
            
            expect(captcha).toHaveProperty('code');
            expect(captcha.code).toMatch(/^[A-Z0-9]{6}$/);
            expect(captcha).toHaveProperty('captchaId');
            expect(typeof captcha.captchaId).toBe('string');
            expect(captcha).toHaveProperty('image');
            expect(Buffer.isBuffer(captcha.image)).toBe(true);
        });

        test('generates a CAPTCHA with custom options', async () => {
            const options = {
                font: 'Arial',
                backgroundColor: '#FFFFFF'
            };
            const captcha = await generateCaptcha(options);
            
            expect(captcha).toHaveProperty('code');
            expect(captcha.code).toMatch(/^[A-Z0-9]{6}$/);
            expect(captcha).toHaveProperty('captchaId');
            expect(typeof captcha.captchaId).toBe('string');
            expect(captcha).toHaveProperty('image');
            expect(Buffer.isBuffer(captcha.image)).toBe(true);
        });
    });
});

describe('CAPTCHA API Endpoints', () => {
    beforeAll(async () => {
        await redisClient.connect();
    });

    afterAll(async () => {
        await redisClient.disconnect();
    });

    afterEach(async () => {
        // Clean up any test CAPTCHA data
        const testKeys = await redisClient.client.keys('captcha:*');
        for (const key of testKeys) {
            await redisClient.deleteToken(key);
        }
    });

    describe('POST /api/captcha/generate', () => {
        test('generates a new CAPTCHA with default settings', async () => {
            const response = await request(app)
                .post('/api/captcha/generate');
            
            expect(response.statusCode).toBe(200);
            expect(response.body).toHaveProperty('captchaId');
            expect(response.body).toHaveProperty('expires');
            expect(typeof response.body.captchaId).toBe('string');
            expect(typeof response.body.expires).toBe('number');
        });

        test('generates a CAPTCHA with custom options', async () => {
            const response = await request(app)
                .post('/api/captcha/generate')
                .send({
                    customization: {
                        font: 'Arial',
                        backgroundColor: '#FFFFFF'
                    }
                });
            
            expect(response.statusCode).toBe(200);
            expect(response.body).toHaveProperty('captchaId');
            expect(response.body).toHaveProperty('expires');
        });

        test('handles invalid customization options gracefully', async () => {
            const response = await request(app)
                .post('/api/captcha/generate')
                .send({
                    customization: {
                        font: 'NonexistentFont',
                        backgroundColor: 'invalid-color'
                    }
                });
            
            expect(response.statusCode).toBe(200);
            expect(response.body).toHaveProperty('captchaId');
            expect(response.body).toHaveProperty('expires');
        });
    });

    describe('GET /api/captcha/:id/image', () => {
        test('retrieves CAPTCHA image for valid ID', async () => {
            // First generate a CAPTCHA
            const genResponse = await request(app)
                .post('/api/captcha/generate');
            
            const captchaId = genResponse.body.captchaId;
            
            // Then retrieve its image
            const response = await request(app)
                .get(`/api/captcha/${captchaId}/image`);
            
            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toBe('image/png');
            expect(Buffer.isBuffer(response.body)).toBe(true);
        });

        test('returns 404 for invalid CAPTCHA ID', async () => {
            const response = await request(app)
                .get('/api/captcha/invalid-id/image');
            
            expect(response.statusCode).toBe(404);
            expect(response.body).toHaveProperty('error', 'CAPTCHA_NOT_FOUND');
        });
    });

    describe('POST /api/captcha/validate', () => {
        test('validates correct CAPTCHA response', async () => {
            // Generate a CAPTCHA
            const captcha = await generateCaptcha();
            await redisClient.storeToken(`captcha:${captcha.captchaId}`, JSON.stringify({
                code: captcha.code,
                customization: {}
            }), 180);
            
            // Validate with correct response
            const response = await request(app)
                .post('/api/captcha/validate')
                .send({
                    captchaId: captcha.captchaId,
                    response: captcha.code
                });
            
            expect(response.statusCode).toBe(200);
            expect(response.body).toHaveProperty('valid', true);
        });

        test('invalidates incorrect CAPTCHA response', async () => {
            // Generate a CAPTCHA
            const captcha = await generateCaptcha();
            await redisClient.storeToken(`captcha:${captcha.captchaId}`, JSON.stringify({
                code: captcha.code,
                customization: {}
            }), 180);
            
            // Validate with incorrect response
            const response = await request(app)
                .post('/api/captcha/validate')
                .send({
                    captchaId: captcha.captchaId,
                    response: 'WRONG1'
                });
            
            expect(response.statusCode).toBe(200);
            expect(response.body).toHaveProperty('valid', false);
        });

        test('handles missing CAPTCHA ID', async () => {
            const response = await request(app)
                .post('/api/captcha/validate')
                .send({
                    response: 'ABC123'
                });
            
            expect(response.statusCode).toBe(400);
            expect(response.body).toHaveProperty('error', 'INVALID_REQUEST');
        });

        test('handles expired CAPTCHA', async () => {
            const response = await request(app)
                .post('/api/captcha/validate')
                .send({
                    captchaId: 'expired-id',
                    response: 'ABC123'
                });
            
            expect(response.statusCode).toBe(404);
            expect(response.body).toHaveProperty('error', 'CAPTCHA_NOT_FOUND');
        });
    });

    describe('GET /api/captcha/:id/audio', () => {
        test('retrieves CAPTCHA audio for valid ID', async () => {
            const captcha = await generateCaptcha();
            const captchaId = 'test-id';
            redisClient.getToken.mockResolvedValue(JSON.stringify({
                code: captcha.code,
                image: captcha.image,
                audio: captcha.audio
            }));

            const response = await request(app)
                .get(`/api/captcha/${captchaId}/audio`);
            
            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toBe('audio/mpeg');
            expect(Buffer.isBuffer(response.body)).toBe(true);
        }, 30000);

        test('returns 404 for invalid CAPTCHA ID', async () => {
            redisClient.getToken.mockResolvedValue(null);
            
            const response = await request(app)
                .get('/api/captcha/invalid-id/audio');
            
            expect(response.statusCode).toBe(404);
        });
    });
});