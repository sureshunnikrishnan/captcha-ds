# Customization Guide

## Overview
This guide provides instructions on how to customize the captcha-ds service.

## Configuration

### config/config.js
The main configuration file for the service. You can customize various settings such as port, database connection, and more.

### config/monitoring.js
Configuration for monitoring and logging. Customize settings for Prometheus and Grafana.

## Middleware

### middleware/apiKeyAuth.js
Customize the API key authentication middleware to change how API keys are validated.

### middleware/rateLimiter.js
Adjust the rate limiting settings to control the number of requests allowed per time period.

## Routes

### routes/index.js
Add or modify API routes to extend the functionality of the service.

## Utils

### utils/cdnClient.js
Customize the CDN client to change how files are uploaded and managed.

### utils/encryption.js
Modify the encryption settings to change how data is encrypted and decrypted.

### utils/redisClient.js
Adjust the Redis client settings to change how data is cached and retrieved.

### utils/captcha/generator.js
Customize the captcha generator to change the appearance and behavior of generated captchas.
