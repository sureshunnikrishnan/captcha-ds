/**
 * Rate Limiting Middleware
 */

const rateLimit = require('express-rate-limit');
const config = require('../config/config');
const redisClient = require('../utils/redisClient');

// Create a rate limiter with optional Redis store
const createRateLimiter = (options = {}) => {
    const defaultOptions = {
        windowMs: 60 * 1000, // 1 minute by default
        max: 100,           // 100 requests per windowMs by default
        standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
        legacyHeaders: false, // Disable the `X-RateLimit-*` headers
        message: {
            error: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later'
        },
        keyGenerator: (req) => {
            // Use API key as rate limit key if available, otherwise fall back to IP
            return req.apiKey || req.ip;
        }
    };

    // Merge default options with provided options
    const limiterOptions = { ...defaultOptions, ...options };
    
    // Create limiter
    const limiter = rateLimit(limiterOptions);
    
    // Expose options for testing
    limiter.options = limiterOptions;
    
    return limiter;
};

// Create API key-based rate limiter
const apiKeyRateLimiter = createRateLimiter({
    windowMs: config.rateLimit.api.windowMs,
    max: config.rateLimit.api.maxRequests,
    keyGenerator: (req) => req.apiKey,
    message: {
        error: 'API_RATE_LIMIT_EXCEEDED',
        message: 'Too many requests with this API key'
    }
});

// Create IP-based rate limiter
const ipRateLimiter = createRateLimiter({
    windowMs: config.rateLimit.ip.windowMs,
    max: config.rateLimit.ip.maxRequests,
    keyGenerator: (req) => req.ip,
    message: {
        error: 'IP_RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP address'
    }
});

module.exports = {
    apiKeyRateLimiter,
    ipRateLimiter,
    createRateLimiter
};