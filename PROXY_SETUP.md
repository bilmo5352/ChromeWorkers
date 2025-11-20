# Proxy Setup Guide (Decodo Integration)

This guide explains how to integrate residential proxies (like Decodo) with the Playwright Cloud Renderer to avoid IP blocking.

## Why Use Proxies?

Many websites detect and block requests from:
- Cloud/datacenter IPs
- Headless browsers
- Automated scraping tools

Residential proxies solve this by:
- **IP Rotation**: Each request uses a different residential IP
- **Geo-targeting**: Specify location (USA, India, etc.)
- **Real User IPs**: Requests appear to come from real residential users
- **Higher Success Rate**: Significantly reduces blocking

## Decodo Configuration

Based on your screenshot, your Decodo proxy configuration is:

```
Proxy Address: gate.decodo.com
Ports: 10001-10006 (or more)
Username: sphhexq8n5
Password: yicf=8VpMD3... (your actual password)
```

## Setup on Railway

### 1. Add Environment Variables

In your Railway project dashboard:

1. Go to your service settings
2. Click on **Variables** tab
3. Add these environment variables:

```
PROXY_SERVER=gate.decodo.com:10001
PROXY_USERNAME=sphhexq8n5
PROXY_PASSWORD=yicf=8VpMD3... (your actual password)
```

### 2. Redeploy

Railway will automatically redeploy with the new environment variables.

## Local Testing with Proxy

Create a `.env` file in the project root:

```env
PROXY_SERVER=gate.decodo.com:10001
PROXY_USERNAME=sphhexq8n5
PROXY_PASSWORD=yicf=8VpMD3...
```

Then run locally:
```bash
npm start
```

## Rotating Multiple Proxy Endpoints

Decodo provides multiple endpoints (10001-10006 in your case). For better IP rotation, you can:

### Option 1: Random Selection (Recommended)

Set multiple proxies and randomly pick one for each request.

Add to `server.js`:

```javascript
const PROXY_ENDPOINTS = [
    'gate.decodo.com:10001',
    'gate.decodo.com:10002',
    'gate.decodo.com:10003',
    'gate.decodo.com:10004',
    'gate.decodo.com:10005',
    'gate.decodo.com:10006',
];

function getRandomProxy() {
    const endpoint = PROXY_ENDPOINTS[Math.floor(Math.random() * PROXY_ENDPOINTS.length)];
    return {
        server: `http://${endpoint}`,
        username: PROXY_USERNAME,
        password: PROXY_PASSWORD
    };
}
```

### Option 2: Environment Variable List

Set in Railway:
```
PROXY_ENDPOINTS=gate.decodo.com:10001,gate.decodo.com:10002,gate.decodo.com:10003
```

## Verifying Proxy Works

Test the proxy by rendering a site that shows your IP:

```javascript
const TEST_URLS = [
    'https://api.ipify.org',  // Shows your IP
    'https://httpbin.org/ip', // Also shows IP
];
```

You should see the proxy IP, not your server's IP.

## Decodo Session Types

From your screenshot, you're using **Sticky (10min)** sessions:

- **Sticky Session**: Same IP for 10 minutes, then rotates
- **Random Session**: New IP for each request
- **Location**: USA only (as configured)
- **Protocol**: endpoint:port (recommended for most use cases)

### When to Use Each:

- **Sticky**: Good for browsing sessions, login flows
- **Random**: Best for scraping, one-off requests

## Cost Considerations

Your trial shows:
- **100 MB Trial** currently at 0.02 / 0.1 GB used
- Each proxy request consumes bandwidth
- Monitor usage in Decodo dashboard

## Troubleshooting

### Proxy Authentication Failed

Check that username/password are correct in environment variables.

### Still Getting Blocked

1. Try different session types (Random instead of Sticky)
2. Use different locations if available
3. Add delays between requests
4. Check if site requires cookies/sessions

### Slow Response Times

Residential proxies are slower than datacenter proxies. Increase timeout:

```javascript
await page.goto(url, { 
    waitUntil: 'domcontentloaded', 
    timeout: 90000  // 90 seconds
});
```

## Advanced: Per-Request Proxy Selection

If you want to specify proxy per request (instead of globally), modify the API to accept proxy parameters in the request body.

## Expected Results

With Decodo proxies configured:
- ✅ Amazon, Flipkart, Meesho, etc. should work
- ✅ No more IP blocking errors
- ✅ Higher success rate on all websites
- ⚠️  Slightly slower response times (residential proxies)
- 💰 Monitor bandwidth usage

## Next Steps

1. Add proxy environment variables to Railway
2. Wait for automatic redeploy
3. Test with previously blocked sites (Amazon, etc.)
4. Monitor Decodo usage dashboard

