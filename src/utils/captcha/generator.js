/**
 * CAPTCHA Generation Utilities
 */
const sharp = require('sharp');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { generateAudioCaptcha } = require('./audioGenerator');

/**
 * Generates a random 6-character alphanumeric code
 * @returns {string} The generated CAPTCHA code
 */
function generateCode() {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        const randomIndex = crypto.randomInt(0, charset.length);
        code += charset[randomIndex];
    }
    return code;
}

/**
 * Applies distortion to text in an image
 * @param {Buffer} imageBuffer - The input image buffer
 * @returns {Promise<Buffer>} The distorted image buffer
 */
async function applyDistortion(imageBuffer) {
    return sharp(imageBuffer)
        // Add slight wave distortion
        .modulate({ brightness: 1, saturation: 1 })
        // Add noise
        .linear(1.1, -10)
        // Slight blur to smooth edges
        .blur(0.5)
        .toBuffer();
}

/**
 * Generates a CAPTCHA image with customization options
 * @param {string} code - The CAPTCHA code to render
 * @param {Object} options - Customization options
 * @param {string} options.font - Font family to use (default: Arial)
 * @param {string} options.backgroundColor - Background color in hex (default: white)
 * @param {string} options.backgroundImage - Optional background image URL
 * @returns {Promise<Buffer>} The generated image buffer
 */
async function generateImage(code, options = {}) {
    const {
        font = 'Arial',
        backgroundColor = 'white',
        backgroundImage
    } = options;

    // Create SVG with customized styling
    const svg = `
        <svg width="250" height="80">
            <defs>
                <style>
                    @font-face {
                        font-family: "${font}";
                        src: local("${font}");
                    }
                    .text { 
                        font-family: "${font}", Arial, sans-serif;
                        font-size: 40px;
                        fill: black;
                    }
                </style>
            </defs>
            <rect width="100%" height="100%" fill="${backgroundColor}"/>
            <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" class="text">
                ${code}
            </text>
        </svg>
    `;

    // Convert SVG to PNG
    let imageBuffer = await sharp(Buffer.from(svg))
        .png()
        .toBuffer();

    // If background image is provided, composite the text over it
    if (backgroundImage) {
        const background = await sharp(backgroundImage)
            .resize(250, 80, { fit: 'cover' })
            .toBuffer();

        imageBuffer = await sharp(background)
            .composite([
                {
                    input: imageBuffer,
                    blend: 'over'
                }
            ])
            .toBuffer();
    }

    // Apply distortion effects
    return applyDistortion(imageBuffer);
}

/**
 * Generates a complete CAPTCHA with unique ID, image, and audio
 * @param {Object} options - Options for CAPTCHA generation
 * @param {Object} options.image - Image customization options
 * @param {Object} options.audio - Audio customization options
 * @returns {Promise<Object>} Object containing CAPTCHA details
 */
async function generateCaptcha(options = {}) {
    const code = generateCode();
    const captchaId = uuidv4();
    
    // Generate both image and audio in parallel
    const [image, audio] = await Promise.all([
        generateImage(code, options.image),
        generateAudioCaptcha(code, options.audio)
    ]);

    return {
        code,
        captchaId,
        image,
        audio
    };
}

module.exports = {
    generateCode,
    generateImage,
    generateCaptcha
};