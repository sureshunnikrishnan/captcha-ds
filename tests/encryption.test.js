const { encrypt, decrypt } = require('../src/utils/encryption');

describe('Encryption Utils', () => {
    test('encrypts and decrypts text correctly', () => {
        const originalText = 'test_api_key_123';
        const encrypted = encrypt(originalText);
        const decrypted = decrypt(encrypted);
        
        expect(decrypted).toBe(originalText);
        expect(encrypted).not.toBe(originalText);
        expect(encrypted).toContain(':'); // Should contain IV separator
    });

    test('different encryptions of same text are unique', () => {
        const text = 'test_api_key_123';
        const encrypted1 = encrypt(text);
        const encrypted2 = encrypt(text);
        
        expect(encrypted1).not.toBe(encrypted2);
        expect(decrypt(encrypted1)).toBe(text);
        expect(decrypt(encrypted2)).toBe(text);
    });

    test('handles empty string', () => {
        const empty = '';
        const encrypted = encrypt(empty);
        const decrypted = decrypt(encrypted);
        
        expect(decrypted).toBe(empty);
    });

    test('throws error on invalid encrypted text', () => {
        expect(() => decrypt('invalid:encrypted:text')).toThrow();
    });
});