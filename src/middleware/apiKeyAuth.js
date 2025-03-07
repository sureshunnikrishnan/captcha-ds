/**
 * API Key Authentication Middleware
 * 
 * This middleware verifies that requests include a valid API key
 * in the 'x-api-key' header.
 */

require('dotenv').config();
const { encrypt, decrypt } = require('../utils/encryption');

// Store encrypted API keys in memory (in production, use a secure database)
const encryptedApiKeys = new Map();

// Initialize encrypted API keys from environment
function initializeApiKeys() {
    const apiKeys = process.env.API_KEYS ? process.env.API_KEYS.split(',') : [];
    apiKeys.forEach(key => {
        encryptedApiKeys.set(key, encrypt(key));
    });
}

// Initialize on startup
initializeApiKeys();

const apiKeyAuth = (req, res, next) => {
    const apiKey = req.header('x-api-key');
    
    // Check if API key exists in the request
    if (!apiKey) {
        return res.status(401).json({
            error: 'MISSING_API_KEY',
            message: 'API key is required'
        });
    }
    
    // Check if the provided API key exists in our encrypted store
    let isValid = false;
    for (const [originalKey, encryptedKey] of encryptedApiKeys) {
        try {
            const decryptedKey = decrypt(encryptedKey);
            if (decryptedKey === apiKey) {
                isValid = true;
                break;
            }
        } catch (error) {
            console.error('Error decrypting API key:', error);
        }
    }

    if (!isValid) {
        return res.status(401).json({
            error: 'INVALID_API_KEY',
            message: 'The provided API key is invalid'
        });
    }
    
    // Add the API key to request for potential future use
    req.apiKey = apiKey;
    
    // If the API key is valid, proceed to the next middleware
    next();
};

module.exports = apiKeyAuth;