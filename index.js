/**
 * Main Application Entry Point
 */

// Import and start the server
const app = require('./src/server');
const config = require('./src/config/config');

const PORT = config.server.port;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${config.server.env} mode`);
  console.log(`Health endpoint: http://localhost:${PORT}/api/health`);
  console.log(`Protected endpoint: http://localhost:${PORT}/api/v1/protected (requires API key)`);
});