/**
 * Rate Limiter Middleware Tests
 */

const { createRateLimiter } = require('../src/middleware/rateLimiter');

describe('Rate Limiter Middleware', () => {
    let mockRequest;
    let mockResponse;
    let nextFunction;

    beforeEach(() => {
        mockRequest = {
            ip: '127.0.0.1',
            apiKey: 'test_api_key'
        };
        
        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            setHeader: jest.fn()
        };
        
        nextFunction = jest.fn();
    });

    test('should use API key as rate limit key if available', () => {
        const rateLimiter = createRateLimiter({
            max: 2,
            windowMs: 15 * 60 * 1000,
        });

        const keyGenerator = rateLimiter.options.keyGenerator;
        const key = keyGenerator(mockRequest);
        
        expect(key).toBe('test_api_key');
    });

    test('should fall back to IP if no API key is present', () => {
        const rateLimiter = createRateLimiter({
            max: 2,
            windowMs: 15 * 60 * 1000,
        });

        delete mockRequest.apiKey;
        
        const keyGenerator = rateLimiter.options.keyGenerator;
        const key = keyGenerator(mockRequest);
        
        expect(key).toBe('127.0.0.1');
    });

    test('should use custom key generator if provided', () => {
        const rateLimiter = createRateLimiter({
            max: 2,
            windowMs: 15 * 60 * 1000,
            keyGenerator: () => 'custom_key'
        });

        const keyGenerator = rateLimiter.options.keyGenerator;
        const key = keyGenerator(mockRequest);
        
        expect(key).toBe('custom_key');
    });

    test('should use custom window and max if provided', () => {
        const customWindow = 30 * 60 * 1000; // 30 minutes
        const customMax = 5;
        
        const rateLimiter = createRateLimiter({
            windowMs: customWindow,
            max: customMax
        });
        
        expect(rateLimiter.options.windowMs).toBe(customWindow);
        expect(rateLimiter.options.max).toBe(customMax);
    });

    test('should use custom error message if provided', () => {
        const customMessage = {
            error: 'CUSTOM_ERROR',
            message: 'Custom error message'
        };
        
        const rateLimiter = createRateLimiter({
            message: customMessage
        });
        
        expect(rateLimiter.options.message).toEqual(customMessage);
    });

    test('should use default rate limit values', () => {
        const rateLimiter = createRateLimiter();
        
        expect(rateLimiter.options.windowMs).toBe(60 * 1000); // 1 minute
        expect(rateLimiter.options.max).toBe(100); // 100 requests
        expect(rateLimiter.options.standardHeaders).toBe(true);
        expect(rateLimiter.options.legacyHeaders).toBe(false);
    });
});