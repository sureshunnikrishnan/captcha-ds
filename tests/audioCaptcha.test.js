const { generateAudioCaptcha } = require('../src/utils/captcha/audioGenerator');
const fs = require('fs').promises;

describe('Audio CAPTCHA Generator', () => {
    test('generates MP3 audio from text with default settings', async () => {
        const text = 'ABC123';
        const audioBuffer = await generateAudioCaptcha(text);
        
        expect(Buffer.isBuffer(audioBuffer)).toBe(true);
        expect(audioBuffer.length).toBeGreaterThan(0);
        
        // Verify it's an MP3 file by checking the header
        expect(audioBuffer.slice(0, 2).toString('hex')).toMatch(/^4944|^fffb/); // ID3 or MPEG frame sync
    }, 30000); // Increase timeout for audio processing

    test('generates audio with custom speed and noise', async () => {
        const text = 'XYZ789';
        const options = {
            speed: 1.2,
            noise: 0.5
        };
        
        const audioBuffer = await generateAudioCaptcha(text, options);
        expect(Buffer.isBuffer(audioBuffer)).toBe(true);
        expect(audioBuffer.length).toBeGreaterThan(0);
    }, 30000);

    test('handles empty text gracefully', async () => {
        await expect(generateAudioCaptcha('')).rejects.toThrow('Text is required');
    });

    test('handles invalid speed values', async () => {
        await expect(generateAudioCaptcha('test', { speed: 0.5 })).rejects.toThrow('Speed must be between 0.8 and 1.2');
        await expect(generateAudioCaptcha('test', { speed: 1.5 })).rejects.toThrow('Speed must be between 0.8 and 1.2');
    });

    test('generates different audio for same text', async () => {
        const text = 'TEST123';
        const audio1 = await generateAudioCaptcha(text);
        const audio2 = await generateAudioCaptcha(text);
        
        // Compare the audio lengths (they should be different due to noise)
        expect(audio1.length).not.toBe(audio2.length);
    }, 30000);
});