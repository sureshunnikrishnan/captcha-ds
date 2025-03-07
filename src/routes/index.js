/**
 * API Routes
 * 
 * Defines all the API routes for the application.
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const cdnClient = require('../utils/cdnClient');
const redisClient = require('../utils/redisClient');
const { generateCaptcha } = require('../utils/captcha/generator');
const apiKeyAuth = require('../middleware/apiKeyAuth');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.mimetype)) {
      const error = new Error('INVALID_FILE_TYPE');
      error.code = 'INVALID_FILE_TYPE';
      return cb(error, false);
    }
    cb(null, true);
  }
}).single('file');

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    serverPort: process.env.PORT || 3000,
    timestamp: new Date().toISOString()
  });
});

// Generate CAPTCHA endpoint
router.post('/captcha/generate', async (req, res) => {
  try {
    const customization = {
      image: req.body.imageCustomization || {},
      audio: req.body.audioCustomization || {}
    };
    
    const captcha = await generateCaptcha(customization);
    
    // Store CAPTCHA code, customization, and audio options in Redis with 3-minute TTL
    await redisClient.storeToken(`captcha:${captcha.captchaId}`, JSON.stringify({
      code: captcha.code,
      customization
    }), 180);
    
    res.json({
      captchaId: captcha.captchaId,
      expires: Date.now() + (180 * 1000) // 3 minutes from now
    });
  } catch (error) {
    console.error('CAPTCHA generation error:', error);
    res.status(500).json({
      error: 'CAPTCHA_GENERATION_FAILED',
      message: 'Failed to generate CAPTCHA'
    });
  }
});

// Generate token endpoint
router.post('/generate-token', async (req, res) => {
  try {
    const { type = 'image', customization = {} } = req.body;
    
    // Validate CAPTCHA type
    if (!['image', 'audio'].includes(type)) {
      return res.status(400).json({
        error: 'INVALID_TYPE',
        message: 'CAPTCHA type must be either "image" or "audio"'
      });
    }

    // Generate CAPTCHA
    const captcha = await generateCaptcha({
      [type]: customization
    });

    const token = uuidv4();

    // Store token data in Redis with 3-minute TTL
    await redisClient.storeToken(`token:${token}`, JSON.stringify({
      code: captcha.code,
      type,
      customization,
      attempts: 0
    }), 180);

    res.json({
      token,
      captcha_id: captcha.captchaId,
      expires_at: Date.now() + (180 * 1000) // 3 minutes from now
    });
  } catch (error) {
    console.error('Token generation error:', error);
    res.status(500).json({
      error: 'TOKEN_GENERATION_FAILED',
      message: 'Failed to generate token'
    });
  }
});

// Get CAPTCHA image endpoint
router.get('/captcha/:id/image', async (req, res) => {
  try {
    const storedData = await redisClient.getToken(`captcha:${req.params.id}`);
    if (!storedData) {
      return res.status(404).json({
        error: 'CAPTCHA_NOT_FOUND',
        message: 'CAPTCHA not found or expired'
      });
    }

    const { code, customization } = JSON.parse(storedData);
    const captcha = await generateCaptcha({ image: customization.image });
    
    res.set('Content-Type', 'image/png');
    res.send(captcha.image);
  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({
      error: 'IMAGE_GENERATION_FAILED',
      message: 'Failed to generate CAPTCHA image'
    });
  }
});

// Get CAPTCHA audio endpoint
router.get('/captcha/:id/audio', async (req, res) => {
  try {
    const storedData = await redisClient.getToken(`captcha:${req.params.id}`);
    if (!storedData) {
      return res.status(404).json({
        error: 'CAPTCHA_NOT_FOUND',
        message: 'CAPTCHA not found or expired'
      });
    }

    const { code, customization } = JSON.parse(storedData);
    const captcha = await generateCaptcha({ audio: customization.audio });
    
    res.set('Content-Type', 'audio/mp3');
    res.set('Content-Disposition', 'attachment; filename="captcha.mp3"');
    res.send(captcha.audio);
  } catch (error) {
    console.error('Audio generation error:', error);
    res.status(500).json({
      error: 'AUDIO_GENERATION_FAILED',
      message: 'Failed to generate audio CAPTCHA'
    });
  }
});

// Get CAPTCHA endpoint - supports both PNG and SVG formats
router.get('/captcha/:token.:format', async (req, res) => {
  try {
    const { token, format } = req.params;
    if (!['png', 'svg'].includes(format.toLowerCase())) {
      return res.status(400).json({
        error: 'INVALID_FORMAT',
        message: 'Format must be either PNG or SVG'
      });
    }

    const storedData = await redisClient.getToken(`token:${token}`);
    if (!storedData) {
      return res.status(404).json({
        error: 'CAPTCHA_NOT_FOUND',
        message: 'CAPTCHA not found or expired'
      });
    }

    const { code, type, customization } = JSON.parse(storedData);
    const captcha = await generateCaptcha({
      image: {
        ...customization,
        format: format.toLowerCase()
      }
    });

    const contentType = format.toLowerCase() === 'svg' ? 'image/svg+xml' : 'image/png';
    res.set('Content-Type', contentType);
    res.send(captcha.image);
  } catch (error) {
    console.error('CAPTCHA generation error:', error);
    res.status(500).json({
      error: 'IMAGE_GENERATION_FAILED',
      message: 'Failed to generate CAPTCHA image'
    });
  }
});

// Get Audio CAPTCHA endpoint
router.get('/audio/:token.mp3', async (req, res) => {
  try {
    const { token } = req.params;
    const storedData = await redisClient.getToken(`token:${token}`);
    if (!storedData) {
      return res.status(404).json({
        error: 'CAPTCHA_NOT_FOUND',
        message: 'CAPTCHA not found or expired'
      });
    }

    const { code, type, customization } = JSON.parse(storedData);
    const captcha = await generateCaptcha({
      audio: customization
    });

    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Disposition', 'attachment; filename="captcha.mp3"');
    res.send(captcha.audio);
  } catch (error) {
    console.error('Audio generation error:', error);
    res.status(500).json({
      error: 'AUDIO_GENERATION_FAILED',
      message: 'Failed to generate audio CAPTCHA'
    });
  }
});

// Validate CAPTCHA endpoint
router.post('/validate', async (req, res) => {
  const { token, response } = req.body;
  
  if (!token || !response) {
    return res.status(400).json({
      error: 'INVALID_REQUEST',
      message: 'Both token and response are required'
    });
  }

  try {
    const storedData = await redisClient.getToken(`token:${token}`);
    if (!storedData) {
      return res.status(404).json({
        error: 'CAPTCHA_NOT_FOUND',
        message: 'CAPTCHA not found or expired'
      });
    }

    const data = JSON.parse(storedData);
    
    // Check attempt count
    if (data.attempts >= 3) {
      await redisClient.deleteToken(`token:${token}`);
      return res.status(429).json({
        error: 'MAX_ATTEMPTS_REACHED',
        message: 'Maximum attempts reached. Please generate a new CAPTCHA'
      });
    }

    // Update attempts count
    data.attempts += 1;
    await redisClient.storeToken(`token:${token}`, JSON.stringify(data));

    const isValid = response.toUpperCase() === data.code.toUpperCase();
    
    // If valid, delete the token
    if (isValid) {
      await redisClient.deleteToken(`token:${token}`);
    }
    
    res.json({
      valid: isValid,
      message: isValid ? 'CAPTCHA validated successfully' : 'Invalid CAPTCHA response',
      attempts_remaining: isValid ? 0 : 3 - data.attempts
    });
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({
      error: 'VALIDATION_FAILED',
      message: 'Failed to validate CAPTCHA'
    });
  }
});

// Protected routes that require API key
router.use('/v1', apiKeyAuth);

// Configuration endpoint (protected)
router.post('/v1/configure', async (req, res) => {
  const { default_settings } = req.body;
  
  // Validate required fields
  if (!default_settings) {
    return res.status(400).json({
      error: 'INVALID_REQUEST',
      message: 'default_settings is required'
    });
  }

  // Validate configuration values
  const { font, background_color, distortion_level } = default_settings;
  if (
    (font && typeof font !== 'string') ||
    (background_color && !background_color.match(/^#[0-9A-Fa-f]{6}$/)) ||
    (distortion_level && !['light', 'medium', 'heavy'].includes(distortion_level))
  ) {
    return res.status(400).json({
      error: 'INVALID_CONFIGURATION',
      message: 'Invalid configuration values'
    });
  }

  try {
    // Store configuration in Redis, associated with the API key
    await redisClient.storeToken(`config:${req.apiKey}`, JSON.stringify(default_settings));
    
    res.json({
      status: 'success',
      message: 'Configuration updated successfully'
    });
  } catch (error) {
    console.error('Configuration error:', error);
    res.status(500).json({
      error: 'CONFIGURATION_FAILED',
      message: 'Failed to save configuration'
    });
  }
});

// Background upload endpoint (protected with API key)
router.post('/upload-background', apiKeyAuth, (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'FILE_TOO_LARGE',
          message: 'File must be less than 5MB'
        });
      }
      if (err.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json({
          error: 'INVALID_FILE_TYPE',
          message: 'File must be JPEG or PNG'
        });
      }
      return res.status(500).json({
        error: 'UPLOAD_FAILED',
        message: 'Failed to process file upload'
      });
    }

    try {
      // Validate file presence
      if (!req.file) {
        return res.status(400).json({
          error: 'MISSING_FILE',
          message: 'No file uploaded'
        });
      }

      // Generate unique filename with original extension
      const fileExt = path.extname(req.file.originalname);
      const fileName = `${uuidv4()}${fileExt}`;

      // Upload to CDN
      const url = await cdnClient.uploadFile(req.file.buffer, fileName);

      // Store metadata in Redis with 1 year TTL
      const backgroundId = `bg_${uuidv4()}`;
      await redisClient.storeToken(`background:${backgroundId}`, JSON.stringify({
        fileName,
        url,
        apiKey: req.apiKey,
        uploadedAt: Date.now()
      }), 365 * 24 * 60 * 60); // 1 year TTL

      res.json({
        background_id: backgroundId,
        url
      });
    } catch (error) {
      console.error('Background upload error:', error);
      res.status(500).json({
        error: 'UPLOAD_FAILED',
        message: 'Failed to upload background'
      });
    }
  });
});

// Protected route (requires authentication)
router.get('/v1/protected', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'You have accessed a protected route',
    apiKey: req.apiKey
  });
});

module.exports = router;