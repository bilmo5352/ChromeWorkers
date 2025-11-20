# Playwright Cloud Renderer

A production-ready REST API service that renders web pages using Playwright in **headed mode** (with virtual display support via Xvfb) to avoid bot detection. Returns the full HTML content and a screenshot for any given URL.

## Features

- 🚀 **Headed Browser Mode**: Runs Chromium with `headless: false` to bypass headless detection
- 📸 **Screenshot Capture**: Returns Base64-encoded JPEG screenshots
- 📄 **HTML Extraction**: Captures fully rendered HTML content
- 🐳 **Docker Ready**: Fully containerized with Xvfb for virtual display
- 🌐 **Multiple URLs**: Support for single or multiple URLs in one request
- ⚡ **Production Ready**: Uses `npm ci`, proper error handling, and health checks

## Requirements

- Docker (for containerized deployment)
- Node.js 18+ (for local development)

## Installation & Running

### Using Docker (Recommended for Production)

1. **Build the Docker image:**
   ```bash
   docker build -t playwright-cloud-renderer .
   ```

2. **Run the container:**
   ```bash
   docker run -d -p 3000:3000 --name renderer playwright-cloud-renderer
   ```

3. **Verify it's running:**
   ```bash
   curl http://localhost:3000/health
   ```

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the server:**
   ```bash
   npm start
   ```

   Note: For local development with `headless: false`, you may need to install Xvfb manually:
   ```bash
   # On Ubuntu/Debian
   sudo apt-get install xvfb
   
   # Then run with Xvfb
   xvfb-run -a npm start
   ```

## API Usage

### Endpoint: `POST /render`

Renders one or multiple URLs and returns HTML + Screenshot.

#### Request Body

**Single URL:**
```json
{
  "url": "https://example.com"
}
```

**Multiple URLs:**
```json
{
  "urls": [
    "https://example.com",
    "https://google.com"
  ]
}
```

#### Response

```json
{
  "results": [
    {
      "url": "https://example.com",
      "status": "success",
      "html": "<!DOCTYPE html>...",
      "screenshot": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
    }
  ]
}
```

#### Error Response

If a URL fails to load:
```json
{
  "results": [
    {
      "url": "https://invalid-url.com",
      "status": "error",
      "error": "net::ERR_NAME_NOT_RESOLVED"
    }
  ]
}
```

### Example with `curl`

```bash
curl -X POST http://localhost:3000/render \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

### Example with JavaScript/Fetch

```javascript
const response = await fetch('http://localhost:3000/render', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://example.com' })
});

const data = await response.json();
console.log(data.results[0].html);
```

## Health Check

**Endpoint:** `GET /health`

Returns:
```json
{
  "status": "ok"
}
```

## Configuration

### Environment Variables

- `PORT`: Server port (default: `3000`)

Set via Docker:
```bash
docker run -d -p 8080:8080 -e PORT=8080 playwright-cloud-renderer
```

## Deployment

### Deploy to Any Cloud Provider

This Docker container can be deployed to:
- **AWS** (ECS, Fargate, EC2)
- **Google Cloud Run**
- **Azure Container Instances**
- **DigitalOcean App Platform**
- **Railway**
- **Fly.io**
- **Heroku** (with Docker support)

### Example: Deploy to Railway

1. Install Railway CLI:
   ```bash
   npm install -g @railway/cli
   ```

2. Login and deploy:
   ```bash
   railway login
   railway init
   railway up
   ```

### Example: Deploy to Fly.io

1. Install Fly CLI and login
2. Create `fly.toml` (or use `fly launch`)
3. Deploy:
   ```bash
   fly deploy
   ```

## Architecture

- **Base Image**: `mcr.microsoft.com/playwright:v1.48.0-focal`
- **Display Server**: Xvfb (X Virtual Frame Buffer)
- **Browser**: Chromium (headed mode)
- **Runtime**: Node.js with Express

## Security Considerations

- The container runs with `--no-sandbox` flag (required for Docker)
- CORS is enabled for all origins (modify `server.js` to restrict if needed)
- No authentication is implemented (add your own auth middleware if required)

## Troubleshooting

### Container exits immediately
Check logs:
```bash
docker logs renderer
```

### "Cannot find module" error
Ensure `package.json` has correct `"main"` and `"start"` script.

### Browser crashes or timeouts
Increase container memory:
```bash
docker run -d -p 3000:3000 --memory="2g" playwright-cloud-renderer
```

## License

ISC

## Contributing

Pull requests are welcome! For major changes, please open an issue first.

