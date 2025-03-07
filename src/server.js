/**
 * Express Server
 * 
 * Main application entry point that configures and starts the Express server.
 */
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config/config');
const apiKeyAuth = require('./middleware/apiKeyAuth');
const { apiKeyRateLimiter, ipRateLimiter } = require('./middleware/rateLimiter');
const routes = require('./routes');
const redisClient = require('./utils/redisClient');
const { metricsMiddleware, metrics } = require('./config/monitoring');

// Create Express app
const app = express();

// Apply Prometheus monitoring middleware
app.use(metricsMiddleware);

// Apply security headers
app.use(helmet());

// Parse JSON request bodies
app.use(express.json());

// Enable CORS
app.use(cors());

// Apply IP-based rate limiting to all requests
app.use(ipRateLimiter);

// Add server port to response headers
app.use((req, res, next) => {
  res.setHeader('X-Server-Port', PORT);
  next();
});

// Monitor Redis connection status
redisClient.client.on('connect', () => {
  metrics.redisConnectionGauge.set(1);
});
redisClient.client.on('error', () => {
  metrics.redisConnectionGauge.set(0);
});

// Define routes
// Public routes (no authentication required)
app.use('/api', routes);

// Protected routes (require authentication)
app.use('/api/v1', apiKeyAuth, apiKeyRateLimiter, routes);

// Default 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: 'The requested resource was not found'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`Error: ${err.message}`);
  
  res.status(err.status || 500).json({
    error: err.code || 'SERVER_ERROR',
    message: err.message || 'An unexpected error occurred'
  });
});

// Start the server
const PORT = config.server.port;
let server = null;

if (require.main === module) {
  // Connect to Redis before starting the server
  redisClient.connect().then(() => {
    server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} in ${config.server.env} mode`);
    });
  }).catch(err => {
    console.error('Failed to connect to Redis:', err);
    process.exit(1);
  });
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  
  if (server) {
    server.close(() => {
      console.log('HTTP server closed');
    });
  }
  
  try {
    await redisClient.disconnect();
  } catch (err) {
    console.error('Error during Redis disconnect:', err);
  }
  
  process.exit(0);
});

module.exports = app;  // Export for testing