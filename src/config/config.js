/**
 * Application Configuration
 * 
 * This file centralizes all configuration settings for the application.
 */

require('dotenv').config();

module.exports = {
  // Server configuration
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development'
  },
  
  // API key configuration
  auth: {
    // API keys are stored as comma-separated values in the .env file
    apiKeys: process.env.API_KEYS ? process.env.API_KEYS.split(',') : []
  },
  
  // Rate limiting configuration
  rateLimit: {
    // Per API key rate limit
    api: {
      windowMs: 60 * 1000, // 1 minute window
      maxRequests: 100     // 100 requests per minute
    },
    // Per IP address rate limit
    ip: {
      windowMs: 60 * 60 * 1000, // 1 hour window
      maxRequests: 50          // 50 requests per hour
    }
  },

  // Redis configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || '',
    tokenTTL: 3 * 60 // 3 minutes in seconds
  }
};