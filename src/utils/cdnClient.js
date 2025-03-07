/**
 * Mock CDN Client
 * In production, this would be replaced with actual CDN integration
 */
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

class CDNClient {
    constructor() {
        this.baseUrl = process.env.CDN_URL || 'https://cdn.example.com';
        this.storageDir = path.join(os.tmpdir(), 'captcha-backgrounds');
    }

    async init() {
        try {
            await fs.mkdir(this.storageDir, { recursive: true });
        } catch (error) {
            console.error('Error initializing CDN storage:', error);
            throw error;
        }
    }

    async uploadFile(file, fileName) {
        try {
            const filePath = path.join(this.storageDir, fileName);
            await fs.writeFile(filePath, file);
            return `${this.baseUrl}/backgrounds/${fileName}`;
        } catch (error) {
            console.error('Error uploading to CDN:', error);
            throw error;
        }
    }

    async deleteFile(fileName) {
        try {
            const filePath = path.join(this.storageDir, fileName);
            await fs.unlink(filePath);
            return true;
        } catch (error) {
            console.error('Error deleting from CDN:', error);
            throw error;
        }
    }
}

module.exports = new CDNClient();