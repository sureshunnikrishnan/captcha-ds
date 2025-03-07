

```python
# **Step 1: Implement API Key Authentication Middleware**
# Context: Create middleware to validate API keys and return errors.
# Instructions: Use Flask and a simple in-memory key store for testing.

from flask import Flask, request, jsonify, current_app
from functools import wraps

app = Flask(__name__)
current_app.config['API_KEYS'] = {"valid_api_key_123": "active"}

def api_key_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        if not api_key or api_key not in current_app.config['API_KEYS']:
            return jsonify({"error": "INVALID_API_KEY"}), 401
        return f(*args, **kwargs)
    return decorated_function

# Test: curl -H "X-API-Key: invalid" http://localhost:5000/healthcheck → 401
@app.route('/healthcheck')
@api_key_required
def healthcheck():
    return "OK", 200
```

---

```python
# **Step 2: Add Rate Limiting Middleware**
# Context: Implement per-API-key and per-IP rate limits using Flask-Limiter.
# Instructions: Configure limits and error responses.

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app,
    key_func=get_remote_address,
    default_limits=["50 per hour"]
)

def get_api_key():
    return request.headers.get("X-API-Key", "")

@app.route('/generate-token')
@api_key_required
@limiter.limit("100 per minute", key_func=get_api_key)
def generate_token():
    return "Token generation logic here", 200

# Test: Exceed 100 req/min with valid API key → 429 Too Many Requests
```

---

```python
# **Step 3: Implement Token Generation (Text-Based)**
# Context: Generate and store a text-based CAPTCHA token in Redis.
# Instructions: Use Redis for storage with 3-minute TTL.

import redis
import uuid
import random
import string
from datetime import datetime, timedelta

redis_client = redis.Redis(host='localhost', port=6379, db=0)

@app.route('/generate-token', methods=['POST'])
@api_key_required
def generate_token():
    code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    captcha_id = str(uuid.uuid4())
    token = str(uuid.uuid4())[:8]
    
    expires_at = datetime.utcnow() + timedelta(minutes=3)
    redis_client.setex(f"captcha:{token}", 180, code)
    redis_client.setex(f"captcha_id:{captcha_id}", 180, token)
    
    return jsonify({
        "token": token,
        "captcha_id": captcha_id,
        "expires_at": expires_at.timestamp()
    }), 200

# Test: POST /generate-token → Validate token storage in Redis
```

---

```python
# **Step 4: Implement Validation Endpoint**
# Context: Validate user responses against stored tokens.
# Instructions: Check validity, invalidate tokens post-validation.

@app.route('/validate', methods=['POST'])
@api_key_required
def validate():
    data = request.json
    captcha_id = data.get('captcha_id')
    user_response = data.get('user_response')
    
    token = redis_client.get(f"captcha_id:{captcha_id}")
    if not token:
        return jsonify({"error": "CAPTCHA_NOT_FOUND"}), 404
    
    stored_code = redis_client.get(f"captcha:{token.decode()}")
    if not stored_code:
        return jsonify({"error": "CAPTCHA_EXPIRED"}), 408
    
    if user_response.lower() == stored_code.decode().lower():
        redis_client.delete(f"captcha:{token.decode()}")
        return jsonify({"success": True}), 200
    else:
        return jsonify({"error": "INCORRECT_RESPONSE"}), 400

# Test: Validate correct/incorrect responses → Appropriate error/success
```

---

```python
# **Step 5: Basic Error Handling**
# Context: Standardize error responses for common HTTP errors.
# Instructions: Add error handlers for 404, 500, etc.

@app.errorhandler(404)
def handle_404(e):
    return jsonify({"error": "ENDPOINT_NOT_FOUND"}), 404

@app.errorhandler(500)
def handle_500(e):
    return jsonify({"error": "SERVER_ERROR"}), 500

# Test: Hit non-existent endpoint → 404 response with error JSON
```

---

```python
# **Step 6: Generate Image-Based CAPTCHA with Defaults**
# Context: Create basic image CAPTCHA using Pillow.
# Instructions: Default settings (Arial font, white background).

from PIL import Image, ImageDraw, ImageFont
import io

def generate_image(code):
    image = Image.new('RGB', (250, 80), color='#FFFFFF')
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype("arial.ttf", 36)
    draw.text((10, 10), code, font=font, fill='#000000')
    img_byte_arr = io.BytesIO()
    image.save(img_byte_arr, format='PNG')
    return img_byte_arr.getvalue()

@app.route('/captcha/<token>.png')
def get_image(token):
    stored_code = redis_client.get(f"captcha:{token}")
    if not stored_code:
        return jsonify({"error": "CAPTCHA_EXPIRED"}), 408
    return generate_image(stored_code.decode()), 200, {'Content-Type': 'image/png'}

# Test: GET /captcha/{valid_token}.png → Image returned
```

---

```python
# **Step 7: Add Customization Parameters**
# Context: Allow font/background customization via API.
# Instructions: Update generate_token to accept customization JSON.

@app.route('/generate-token', methods=['POST'])
def generate_token():
    data = request.json
    customization = data.get('customization', {})
    font = customization.get('font', 'Arial')
    background = customization.get('background_color', '#FFFFFF')
    
    # Store customization in Redis with token
    redis_client.setex(f"captcha:{token}:customization", 180, 
                      json.dumps({
                          'font': font,
                          'background': background
                      }))
    
    # ... existing code ...

def generate_image(code, customization):
    font_name = customization.get('font', 'Arial')
    background_color = customization.get('background', '#FFFFFF')
    # Use these values to render image
```

---

```python
# **Step 8: Implement Audio CAPTCHA**
# Context: Generate audio CAPTCHA using gTTS with distortion.
# Instructions: Add endpoint for MP3 generation.

from gtts import gTTS
import os

def generate_audio(code):
    tts = gTTS(text=code, lang='en')
    audio_io = io.BytesIO()
    tts.write_to_fp(audio_io)
    audio_io.seek(0)
    return audio_io.read()

@app.route('/audio/<token>.mp3')
def get_audio(token):
    stored_code = redis_client.get(f"captcha:{token}")
    if not stored_code:
        return jsonify({"error": "CAPTCHA_EXPIRED"}), 408
    return generate_audio(stored_code.decode()), 200, {'Content-Type': 'audio/mpeg'}

# Test: GET /audio/{valid_token}.mp3 → Audio file returned
```

---

```python
# **Step 9: Implement Configuration Endpoint**
# Context: Allow setting default CAPTCHA configurations.
# Instructions: Store defaults in Redis for later use.

@app.route('/configure', methods=['POST'])
@api_key_required
def configure():
    data = request.json
    default_settings = data.get('default_settings', {})
    redis_client.set("default_font", default_settings.get('font', 'Arial'))
    redis_client.set("default_background", default_settings.get('background_color', '#FFFFFF'))
    return jsonify({"status": "success"}), 200

# Test: POST /configure → Store defaults and verify in Redis
```

---

```python
# **Step 10: Integrate Custom Background Upload**
# Context: Allow users to upload custom background images.
# Instructions: Use Flask's file upload handling.

@app.route('/upload-background', methods=['POST'])
@api_key_required
def upload_background():
    file = request.files['file']
    background_id = str(uuid.uuid4())
    # Save file to CDN (mocked here)
    # Return CDN URL (mocked)
    return jsonify({
        "background_id": background_id,
        "url": f"https://cdn.example.com/{background_id}"
    }), 200

# Test: POST /upload-background with file → Validate URL response
```

---

```python
# **Final Step: Wire Together Components**
# Context: Ensure all endpoints integrate with Redis and storage.
# Instructions: Verify token flow (generate → validate → cleanup).

# Integration Test Flow:
# 1. Generate token with /generate-token
# 2. Fetch image/audio via GET endpoints
# 3. Validate response with /validate
# 4. Cleanup Redis keys post-validation
```

Each prompt is self-contained, builds incrementally, and includes test scenarios. All endpoints are integrated to share Redis state and error handling.