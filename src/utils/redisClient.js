/**
 * Redis Client Utility
 * 
 * Provides Redis connection and token management functions
 */
const { createClient } = require('redis');
const config = require('../config/config');

// Create Redis client with configuration
const client = createClient({
  url: `redis://${config.redis.password ? `:${config.redis.password}@` : ''}${config.redis.host}:${config.redis.port}`
});

// Error handling for Redis client
client.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

// Connection management
let isConnected = false;

/**
 * Connect to Redis if not already connected
 * @returns {Promise<void>}
 */
async function connect() {
  if (!isConnected) {
    await client.connect();
    isConnected = true;
    console.log('Connected to Redis');
  }
}

/**
 * Disconnect from Redis
 * @returns {Promise<void>}
 */
async function disconnect() {
  if (isConnected) {
    await client.disconnect();
    isConnected = false;
    console.log('Disconnected from Redis');
  }
}

/**
 * Store a token with the specified TTL
 * @param {string} key - The token key
 * @param {string} value - The token value
 * @param {number} [ttl] - Time to live in seconds (defaults to config setting)
 * @returns {Promise<boolean>} - True if stored successfully
 */
async function storeToken(key, value, ttl = config.redis.tokenTTL) {
  try {
    await connect();
    await client.set(key, value, { EX: ttl });
    return true;
  } catch (error) {
    console.error('Error storing token:', error);
    return false;
  }
}

/**
 * Get a token by key
 * @param {string} key - The token key
 * @returns {Promise<string|null>} - The token value or null if not found
 */
async function getToken(key) {
  try {
    await connect();
    return await client.get(key);
  } catch (error) {
    console.error('Error retrieving token:', error);
    return null;
  }
}

/**
 * Delete a token by key
 * @param {string} key - The token key
 * @returns {Promise<boolean>} - True if deleted successfully
 */
async function deleteToken(key) {
  try {
    await connect();
    await client.del(key);
    return true;
  } catch (error) {
    console.error('Error deleting token:', error);
    return false;
  }
}

/**
 * Check if token exists
 * @param {string} key - The token key
 * @returns {Promise<boolean>} - True if token exists
 */
async function tokenExists(key) {
  try {
    await connect();
    const value = await client.get(key);
    return value !== null;
  } catch (error) {
    console.error('Error checking token:', error);
    return false;
  }
}

/**
 * Get the remaining TTL for a token in seconds
 * @param {string} key - The token key
 * @returns {Promise<number|null>} - TTL in seconds or null if not found
 */
async function getTokenTTL(key) {
  try {
    await connect();
    return await client.ttl(key);
  } catch (error) {
    console.error('Error getting token TTL:', error);
    return null;
  }
}

module.exports = {
  client,
  connect,
  disconnect,
  storeToken,
  getToken,
  deleteToken,
  tokenExists,
  getTokenTTL
};