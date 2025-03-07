


# **CAPTCHA Service Specification**  

---

## **1. Overview**  
### **Purpose**  
Provide a scalable, customizable CAPTCHA service for websites to prevent bot traffic, with support for text, image, and audio CAPTCHAs.  

### **Key Features**  
- **CAPTCHA Types**:  
  - **Text-based**: 6-character code (letters + numbers, case-insensitive).  
  - **Image-based**: 250x80px (PNG/SVG), Arial font, medium distortion.  
  - **Audio-based**: MP3 with distorted speech.  
- **Customization**: Adjust fonts, colors, distortion, and backgrounds via APIs.  
- **Scalability**: Designed to handle **300 requests/second** with auto-scaling.  
- **Security**: API key authentication, rate limiting, and token-based sessions.  
- **Accessibility**: Audio alternative and screen-reader compatibility.  
- **Data Retention**: GDPR-compliant storage and deletion policies.  

---

## **2. Architecture & Infrastructure**  
### **2.1 System Design**  
- **Load Balancer**: Distributes traffic across servers (e.g., NGINX, AWS ALB).  
- **Stateless API**: Endpoints are designed for horizontal scaling (no server affinity).  
- **Caching**:  
  - **Redis Cluster**: Stores tokens (3-minute TTL), rate-limit counters, and session data.  
  - **CDN**: Serves static assets (pre-rendered CAPTCHA templates, audio files).  
- **Database**:  
  - **Sharded NoSQL** (e.g., MongoDB) for CAPTCHA logs and API metadata.  
  - **Read Replicas** for high read performance.  
- **Auto-Scaling**: Kubernetes or AWS Auto Scaling groups for traffic spikes.  

---

## **3. CAPTCHA Types & Specifications**  

### **3.1 Text-Based CAPTCHA**  
- **Format**: 6 characters (A-Z, 0-9, case-insensitive).  
- **Expiration**: 3 minutes.  
- **Attempts**: 3 allowed before regeneration.  

### **3.2 Image-Based CAPTCHA**  
- **Dimensions**: 250px × 80px.  
- **Font**: Customizable (default: Arial).  
- **Distortion**: Light/medium/heavy (default: medium).  
- **Background**: Solid color (customizable hex code) or uploaded image.  
- **Formats**: PNG/SVG only.  

### **3.3 Audio CAPTCHA**  
- **Format**: MP3.  
- **Content**: Distorted speech of the text code.  
- **Speed**: Normal (customizable in future).  

### **3.4 Customization Parameters**  
Developers can configure CAPTCHA appearance and behavior via the `/configure` API:  
- **Font**: Whitelisted choices (e.g., Arial, ComicSans).  
- **Background**: Solid color (hex code) or custom image upload.  
- **Distortion level**: Light/medium/heavy.  
- **Character length**: 2–12 characters.  

---

## **4. API Endpoints**  

### **4.1 Token Generation**  
- **Endpoint**: `POST /generate-token`  
- **Auth**: API Key in header (`X-API-Key`).  
- **Parameters**:  
  ```json  
  {  
    "type": "image",  
    "customization": {  
      "font": "ComicSans",  
      "background_color": "#000000",  
      "distortion_level": "heavy"  
    }  
  }  
  ```  
- **Response**:  
  ```json  
  {  
    "token": "xyz123...",  
    "captcha_id": "cap_123456",  
    "expires_at": 1717036800  
  }  
  ```  

### **4.2 CAPTCHA Presentation**  
- **Image**: `GET /captcha/{token}.{format}` (e.g., `/captcha/xyz123.png`).  
- **Audio**: `GET /audio/{token}.mp3`.  

### **4.3 Validation**  
- **Endpoint**: `POST /validate`  
- **Auth**: API Key in header.  
- **Parameters**:  
  ```json  
  {  
    "captcha_id": "cap_123456",  
    "user_response": "abc123"  
  }  
  ```  
- **Response**:  
  ```json  
  {  
    "success": true,  
    "error": null  
  }  
  ```  

### **4.4 Configuration**  
- **Endpoint**: `POST /configure`  
- **Auth**: API Key.  
- **Parameters**:  
  ```json  
  {  
    "default_settings": {  
      "font": "Arial",  
      "background_color": "#FFFFFF"  
    }  
  }  
  ```  

### **4.5 Custom Background Upload**  
- **Endpoint**: `POST /upload-background`  
- **Auth**: API Key.  
- **Parameters**:  
  - `file`: Image file (PNG/JPEG, ≤5MB).  
  - `name`: Unique identifier.  
- **Response**:  
  ```json  
  {  
    "background_id": "bg_123",  
    "url": "https://cdn.example.com/bgs/bg_123.png"  
  }  
  ```  

---

## **5. Security & Rate Limiting**  
### **5.1 API Key Security**  
- **Storage**: Encrypted at rest.  
- **Rate Limits**:  
  - **Per API Key**: 100 requests/minute (hard block).  
  - **Per IP**: 50 requests/IP/hour (hard block).  

### **5.2 Token Security**  
- **Expiration**: 3 minutes (matches CAPTCHA).  
- **Storage**: Redis with TTL.  

### **5.3 Data Retention**  
- **CAPTCHA Sessions**: Purged after 3 minutes.  
- **Logs**: Retained for 30 days (anonymized afterward).  
- **Custom Backgrounds**: Stored for 1 year unless deleted.  

---

## **6. UI/UX & Accessibility**  
### **6.1 Pre-Built Widgets**  
- **Integration**:  
  ```html  
  <div id="captcha-widget"></div>  
  <script>  
    initCaptcha('token_123', {  
      format: 'svg',  
      customization: {  
        font: 'ComicSans'  
      }  
    });  
  </script>  
  ```  
- **CSS Customization**:  
  ```css  
  .captcha-container {  
    --captcha-bg: #FF0000;  
  }  
  ```  

### **6.2 Accessibility**  
- **Audio Button**: ARIA-labeled and keyboard-accessible.  
- **Error Feedback**: Error messages from validation responses (e.g., "CAPTCHA_EXPIRED").  

---

## **7. Error Handling**  
| **Status Code** | **Scenario**                          | **Response**                                                                 |  
|-----------------|---------------------------------------|------------------------------------------------------------------------------|  
| `401`           | Invalid API key                       | `{ "error": "INVALID_API_KEY" }`                                             |  
| `403`           | Rate limit exceeded                   | `{ "error": "RATE_LIMIT_EXCEEDED", "retry_after": 60 }`                       |  
| `404`           | Invalid CAPTCHA ID                    | `{ "error": "CAPTCHA_NOT_FOUND" }`                                           |  
| `408`           | CAPTCHA expired                       | `{ "error": "CAPTCHA_EXPIRED" }`                                             |  
| `429`           | Too many attempts                     | `{ "error": "MAX_ATTEMPTS_REACHED" }`                                        |  
| `503`           | Service overloaded                    | `{ "error": "SERVICE_UNAVAILABLE", "retry_after": 10 }`                       |  

---

## **8. Performance & Testing Plan**  
### **8.1 Load Testing**  
- **Tools**: JMeter, k6.  
- **Scenarios**:  
  - **Baseline**: 300 RPS for 30 minutes (target: <200ms latency).  
  - **Soak Test**: 300 RPS for 24 hours.  
  - **Peak Test**: 500 RPS for 10 minutes.  

### **8.2 Key Metrics**  
| **Metric**               | **Target**                          |  
|--------------------------|-------------------------------------|  
| P95 Latency              | ≤ 300ms at 300 RPS                 |  
| Error Rate               | ≤ 0.1%                             |  
| Redis Hit Rate           | ≥ 95%                              |  

### **8.3 Monitoring**  
- **Tools**: Prometheus/Grafana for metrics, ELK stack for logs.  
- **Alarms**: Trigger alerts for latency spikes or error rates >1%.  

---

## **9. Data Retention & Privacy**  
### **9.1 GDPR Compliance**  
- **Data Deletion**:  
  - On-demand deletion of API keys and associated data (72-hour SLA).  
  - CAPTCHA sessions and logs are purged automatically.  
- **Anonymization**: IP addresses stripped from logs after 30 days.  

---

## **10. Developer Onboarding**  
### **10.1 Setup Steps**  
1. **Obtain API Key**: From the developer dashboard.  
2. **Integrate Widget**: Embed via HTML/JS.  
3. **Configure Defaults**: Use `/configure` API for brand-specific settings.  

### **10.2 Documentation**  
- **API Reference**: Swagger/OpenAPI spec.  
- **Customization Guide**: Parameters for fonts, colors, and backgrounds.  

---

## **11. Future Enhancements**  
- **AI-resistant CAPTCHAs**: Behavioral analysis, drag-and-drop challenges.  
- **Serverless Scaling**: AWS Lambda for stateless endpoints.  
- **Custom Font Uploads**: Allow developers to upload fonts (future API).  


