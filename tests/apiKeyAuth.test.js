/**
 * API Key Authentication Middleware Tests
 */

const apiKeyAuth = require('../src/middleware/apiKeyAuth');

describe('API Key Authentication Middleware', () => {
  let mockRequest;
  let mockResponse;
  let nextFunction;

  beforeEach(() => {
    // Setup mock request, response and next function before each test
    mockRequest = {
      header: jest.fn()
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    nextFunction = jest.fn();
    
    // Mock environment variables
    process.env.API_KEYS = 'test_key_1,test_key_2,valid_key';
  });

  test('should pass if request has valid API key', () => {
    // Mock a valid API key
    mockRequest.header.mockReturnValue('valid_key');
    
    apiKeyAuth(mockRequest, mockResponse, nextFunction);
    
    // The next function should be called once
    expect(nextFunction).toHaveBeenCalledTimes(1);
    
    // The API key should be added to the request object
    expect(mockRequest.apiKey).toBe('valid_key');
    
    // Status and json should not be called
    expect(mockResponse.status).not.toHaveBeenCalled();
    expect(mockResponse.json).not.toHaveBeenCalled();
  });

  test('should return 401 if no API key is provided', () => {
    // Mock missing API key
    mockRequest.header.mockReturnValue(undefined);
    
    apiKeyAuth(mockRequest, mockResponse, nextFunction);
    
    // The next function should not be called
    expect(nextFunction).not.toHaveBeenCalled();
    
    // Status should be called with 401
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    
    // JSON should be called with error message
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'MISSING_API_KEY',
      message: 'API key is required'
    });
  });

  test('should return 401 if an invalid API key is provided', () => {
    // Mock invalid API key
    mockRequest.header.mockReturnValue('invalid_key');
    
    apiKeyAuth(mockRequest, mockResponse, nextFunction);
    
    // The next function should not be called
    expect(nextFunction).not.toHaveBeenCalled();
    
    // Status should be called with 401
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    
    // JSON should be called with error message
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'INVALID_API_KEY',
      message: 'The provided API key is invalid'
    });
  });

  test('should handle empty API_KEYS environment variable', () => {
    // Mock empty API_KEYS
    process.env.API_KEYS = '';
    
    // Mock a request with an API key
    mockRequest.header.mockReturnValue('any_key');
    
    apiKeyAuth(mockRequest, mockResponse, nextFunction);
    
    // The next function should not be called
    expect(nextFunction).not.toHaveBeenCalled();
    
    // Status should be called with 401
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    
    // JSON should be called with error message
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'INVALID_API_KEY',
      message: 'The provided API key is invalid'
    });
  });
});