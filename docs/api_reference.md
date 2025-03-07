# API Reference

## Overview
This document provides an overview of the API endpoints available in the captcha-ds service.

## Endpoints

### GET /captcha
Generates a new captcha.

**Response:**
- 200: Captcha generated successfully.
- 500: Internal server error.

### POST /captcha/verify
Verifies the provided captcha.

**Request Body:**
- `captcha`: The captcha to verify.

**Response:**
- 200: Captcha verified successfully.
- 400: Invalid captcha.
- 500: Internal server error.

### GET /status
Returns the status of the service.

**Response:**
- 200: Service is running.
- 500: Internal server error.
