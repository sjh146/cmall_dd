# OpenClaw Browser Automation Integration

This package provides integration with the OpenClaw browser control service for browser automation tasks.

## Prerequisites

1. **OpenClaw Gateway**: The OpenClaw gateway must be running. You can start it by:
   - Using the OpenClaw.app menubar
   - Running `openclaw gateway` in your terminal

2. **Environment Variable** (optional):
   ```env
   OPENCLAW_BASE_URL=http://localhost:8081
   ```
   If not set, defaults to `http://localhost:8081`

## API Endpoints

### Health Check
**GET** `/api/v1/openclaw/health`

Checks if the OpenClaw service is available.

**Response:**
```json
{
  "status": "available"
}
```

**Error Response (Service Unavailable):**
```json
{
  "status": "unavailable",
  "error": "Can't reach the openclaw browser control service. Start (or restart) the OpenClaw gateway..."
}
```

### Click Element
**POST** `/api/v1/openclaw/click`

Clicks on a browser element by its ID.

**Request Body:**
```json
{
  "elementId": "e21",
  "kind": "click",
  "url": "http://example.com"
}
```

**Response:**
```json
{
  "success": true
}
```

**Error Response (Element Not Found):**
```json
{
  "error": "Element \"e21\" not found or not visible. Run a new snapshot to see current page elements.",
  "code": "ELEMENT_NOT_FOUND"
}
```

**Error Response (Service Unavailable):**
```json
{
  "error": "Can't reach the openclaw browser control service. Start (or restart) the OpenClaw gateway...",
  "code": "SERVICE_UNAVAILABLE"
}
```

### Take Snapshot
**POST** `/api/v1/openclaw/snapshot`

Takes a snapshot of the current page to see available elements.

**Request Body:**
```json
{
  "url": "http://example.com"
}
```

**Response:**
```json
{
  "elements": [
    {
      "id": "e21",
      "selector": "#button-id",
      "text": "Click Me"
    }
  ]
}
```

## Usage Examples

### Using cURL

**Check Service Health:**
```bash
curl http://localhost:8080/api/v1/openclaw/health
```

**Click an Element:**
```bash
curl -X POST http://localhost:8080/api/v1/openclaw/click \
  -H "Content-Type: application/json" \
  -d '{
    "elementId": "e21",
    "kind": "click",
    "url": "http://localhost:3000"
  }'
```

**Take a Snapshot:**
```bash
curl -X POST http://localhost:8080/api/v1/openclaw/snapshot \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://localhost:3000"
  }'
```

### Using PowerShell

**Check Service Health:**
```powershell
Invoke-RestMethod -Uri "http://localhost:8080/api/v1/openclaw/health" -Method GET
```

**Click an Element:**
```powershell
$body = @{
    elementId = "e21"
    kind = "click"
    url = "http://localhost:3000"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8080/api/v1/openclaw/click" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

## Error Handling

The integration provides detailed error messages:

- **SERVICE_UNAVAILABLE**: The OpenClaw gateway is not running or not reachable
- **ELEMENT_NOT_FOUND**: The requested element doesn't exist or is not visible
- **HTTP_ERROR**: General HTTP error
- **CLICK_FAILED**: The click action failed for other reasons

When an element is not found, the system will automatically suggest taking a snapshot to see current page elements.

## Troubleshooting

### Error: "Can't reach the openclaw browser control service"

1. Make sure the OpenClaw gateway is running:
   ```bash
   openclaw gateway
   ```
   Or use the OpenClaw.app menubar to start the gateway.

2. Check if the gateway is running on the expected port (default: 8081):
   ```bash
   curl http://localhost:8081/health
   ```

3. Verify the `OPENCLAW_BASE_URL` environment variable if you're using a custom URL.

### Error: "Element not found or not visible"

1. Take a snapshot first to see available elements:
   ```bash
   curl -X POST http://localhost:8080/api/v1/openclaw/snapshot \
     -H "Content-Type: application/json" \
     -d '{"url": "http://your-url.com"}'
   ```

2. Use the element IDs from the snapshot response.

3. Make sure the page has fully loaded before attempting to click elements.
