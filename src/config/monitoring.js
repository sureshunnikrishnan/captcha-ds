const promClient = require('prom-client');
const prometheusMiddleware = require('express-prometheus-middleware');

// Initialize the default metrics collection
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics({ timeout: 5000 });

// Custom metrics
const captchaGenerationCounter = new promClient.Counter({
    name: 'captcha_generation_total',
    help: 'Total number of captchas generated'
});

const captchaVerificationCounter = new promClient.Counter({
    name: 'captcha_verification_total',
    help: 'Total number of captcha verifications',
    labelNames: ['status']
});

const redisConnectionGauge = new promClient.Gauge({
    name: 'redis_connection_status',
    help: 'Redis connection status (1 for connected, 0 for disconnected)'
});

// Prometheus middleware configuration
const metricsMiddleware = prometheusMiddleware({
    metricsPath: '/metrics',
    collectDefaultMetrics: false, // Disable default metrics collection in middleware
    requestDurationBuckets: [0.1, 0.5, 1, 2, 5]
});

module.exports = {
    metricsMiddleware,
    metrics: {
        captchaGenerationCounter,
        captchaVerificationCounter,
        redisConnectionGauge
    }
};