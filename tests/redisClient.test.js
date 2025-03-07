/**
 * Redis Client Utility Tests
 * 
 * Tests for the Redis token storage and retrieval functions
 */
const redisClient = require('../src/utils/redisClient');

// Mock Redis client for testing
jest.mock('redis', () => {
  const mockSet = jest.fn().mockResolvedValue('OK');
  const mockGet = jest.fn();
  const mockDel = jest.fn().mockResolvedValue(1);
  const mockTtl = jest.fn();
  const mockConnect = jest.fn();
  const mockDisconnect = jest.fn();
  
  return {
    createClient: jest.fn(() => ({
      connect: mockConnect,
      disconnect: mockDisconnect,
      set: mockSet,
      get: mockGet,
      del: mockDel,
      ttl: mockTtl,
      on: jest.fn()
    }))
  };
});

describe('Redis Client Utility', () => {
  let mockClient;

  beforeAll(() => {
    // Get a reference to the mocked client for assertions
    mockClient = redisClient.client;
  });

  beforeEach(() => {
    // Clear all mock function calls before each test
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Clean up
    await redisClient.disconnect();
  });

  describe('storeToken', () => {
    it('should store a token with default TTL', async () => {
      const result = await redisClient.storeToken('testKey', 'testValue');
      
      expect(result).toBe(true);
      expect(mockClient.set).toHaveBeenCalledWith('testKey', 'testValue', { EX: 180 });
    });

    it('should store a token with custom TTL', async () => {
      const result = await redisClient.storeToken('testKey', 'testValue', 60);
      
      expect(result).toBe(true);
      expect(mockClient.set).toHaveBeenCalledWith('testKey', 'testValue', { EX: 60 });
    });

    it('should return false if an error occurs', async () => {
      mockClient.set.mockRejectedValueOnce(new Error('Test error'));
      
      const result = await redisClient.storeToken('testKey', 'testValue');
      
      expect(result).toBe(false);
    });
  });

  describe('getToken', () => {
    it('should retrieve a token by key', async () => {
      mockClient.get.mockResolvedValueOnce('testValue');
      
      const result = await redisClient.getToken('testKey');
      
      expect(result).toBe('testValue');
      expect(mockClient.get).toHaveBeenCalledWith('testKey');
    });

    it('should return null if token not found', async () => {
      mockClient.get.mockResolvedValueOnce(null);
      
      const result = await redisClient.getToken('nonExistentKey');
      
      expect(result).toBeNull();
    });

    it('should return null if an error occurs', async () => {
      mockClient.get.mockRejectedValueOnce(new Error('Test error'));
      
      const result = await redisClient.getToken('testKey');
      
      expect(result).toBeNull();
    });
  });

  describe('deleteToken', () => {
    it('should delete a token by key', async () => {
      const result = await redisClient.deleteToken('testKey');
      
      expect(result).toBe(true);
      expect(mockClient.del).toHaveBeenCalledWith('testKey');
    });

    it('should return false if an error occurs', async () => {
      mockClient.del.mockRejectedValueOnce(new Error('Test error'));
      
      const result = await redisClient.deleteToken('testKey');
      
      expect(result).toBe(false);
    });
  });

  describe('tokenExists', () => {
    it('should return true if token exists', async () => {
      mockClient.get.mockResolvedValueOnce('testValue');
      
      const result = await redisClient.tokenExists('testKey');
      
      expect(result).toBe(true);
    });

    it('should return false if token does not exist', async () => {
      mockClient.get.mockResolvedValueOnce(null);
      
      const result = await redisClient.tokenExists('testKey');
      
      expect(result).toBe(false);
    });

    it('should return false if an error occurs', async () => {
      mockClient.get.mockRejectedValueOnce(new Error('Test error'));
      
      const result = await redisClient.tokenExists('testKey');
      
      expect(result).toBe(false);
    });
  });

  describe('getTokenTTL', () => {
    it('should return TTL in seconds for an existing token', async () => {
      mockClient.ttl.mockResolvedValueOnce(120);
      
      const result = await redisClient.getTokenTTL('testKey');
      
      expect(result).toBe(120);
      expect(mockClient.ttl).toHaveBeenCalledWith('testKey');
    });

    it('should return -2 for a non-existent token', async () => {
      mockClient.ttl.mockResolvedValueOnce(-2);
      
      const result = await redisClient.getTokenTTL('nonExistentKey');
      
      expect(result).toBe(-2);
    });

    it('should return null if an error occurs', async () => {
      mockClient.ttl.mockRejectedValueOnce(new Error('Test error'));
      
      const result = await redisClient.getTokenTTL('testKey');
      
      expect(result).toBeNull();
    });
  });
});