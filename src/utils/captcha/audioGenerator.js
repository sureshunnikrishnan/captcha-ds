const ffmpeg = require('fluent-ffmpeg');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const { promisify } = require('util');

const execAsync = promisify(exec);

/**
 * Generates audio CAPTCHA from text with distortion
 * @param {string} text - The text to convert to speech
 * @param {Object} options - Configuration options
 * @param {number} options.speed - Speech speed (0.8-1.2)
 * @param {number} options.noise - Noise level (0-1)
 * @returns {Promise<Buffer>} The audio buffer in MP3 format
 */
async function generateAudioCaptcha(text, options = {}) {
    if (!text) {
        throw new Error('Text is required');
    }

    const {
        speed = 1,
        noise = 0.3
    } = options;

    if (speed < 0.8 || speed > 1.2) {
        throw new Error('Speed must be between 0.8 and 1.2');
    }

    // Create temporary files
    const tempDir = os.tmpdir();
    const aiffFile = path.join(tempDir, `${uuidv4()}.aiff`);
    const mp3File = path.join(tempDir, `${uuidv4()}.mp3`);

    try {
        // Generate speech using macOS say command
        await execAsync(`say -v Alex -o "${aiffFile}" "${text}"`);

        // Apply audio effects and convert to MP3
        await new Promise((resolve, reject) => {
            ffmpeg(aiffFile)
                .audioFilters([
                    // Add noise
                    {
                        filter: 'aeval',
                        options: `'random(0)*${noise}+1*val(0)'`
                    },
                    // Adjust speed
                    {
                        filter: 'atempo',
                        options: speed.toString()
                    }
                ])
                .toFormat('mp3')
                .on('error', reject)
                .on('end', resolve)
                .save(mp3File);
        });

        // Read the processed file
        const audioBuffer = await fs.promises.readFile(mp3File);

        // Clean up temporary files
        await fs.promises.unlink(aiffFile);
        await fs.promises.unlink(mp3File);

        return audioBuffer;
    } catch (error) {
        // Clean up on error
        try {
            if (fs.existsSync(aiffFile)) await fs.promises.unlink(aiffFile);
            if (fs.existsSync(mp3File)) await fs.promises.unlink(mp3File);
        } catch (cleanupError) {
            console.error('Error cleaning up temp files:', cleanupError);
        }
        throw error;
    }
}

module.exports = { generateAudioCaptcha };