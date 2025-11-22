const express = require('express');
const { chromium } = require('playwright');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Proxy configuration from environment variables
const PROXY_SERVERS = process.env.PROXY_SERVER ? process.env.PROXY_SERVER.split(',').map(s => s.trim()) : [];
const PROXY_USERNAME = process.env.PROXY_USERNAME;
const PROXY_PASSWORD = process.env.PROXY_PASSWORD || "yicf=8VrpMD384evBc";

// Railway API configuration
const RAILWAY_API_TOKEN = process.env.RAILWAY_API_TOKEN;
const RAILWAY_SERVICE_ID = process.env.RAILWAY_SERVICE_ID;
const RAILWAY_ENVIRONMENT_ID = process.env.RAILWAY_ENVIRONMENT_ID;
const RAILWAY_API_ENDPOINT = 'https://backboard.railway.app/graphql/v2';

// User agents pool for rotation
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
];

// Viewport sizes for randomization
const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1280, height: 720 }
];

const proxyIndexLock = { value: 0 };

// Get random user agent
function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Get random viewport
function getRandomViewport() {
  return VIEWPORTS[Math.floor(Math.random() * VIEWPORTS.length)];
}

// Random delay to mimic human behavior
function randomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Trigger Railway redeploy
async function triggerRailwayRedeploy() {
  if (!RAILWAY_API_TOKEN || !RAILWAY_SERVICE_ID || !RAILWAY_ENVIRONMENT_ID) {
    console.log('⚠️ Railway credentials not configured. Skipping auto-redeploy.');
    return { success: false, reason: 'missing_credentials' };
  }

  try {
    console.log('🔄 Triggering Railway redeploy...');
    
    const mutation = `
      mutation serviceInstanceRedeploy($environmentId: String!, $serviceId: String!) {
        serviceInstanceRedeploy(environmentId: $environmentId, serviceId: $serviceId)
      }
    `;

    const response = await fetch(RAILWAY_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RAILWAY_API_TOKEN}`
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          environmentId: RAILWAY_ENVIRONMENT_ID,
          serviceId: RAILWAY_SERVICE_ID
        }
      })
    });

    const data = await response.json();

    if (data.errors) {
      console.error('❌ Railway redeploy failed:', data.errors);
      return { success: false, reason: 'api_error', errors: data.errors };
    }

    console.log('✅ Railway redeploy triggered successfully');
    return { success: true, data };

  } catch (error) {
    console.error('❌ Error triggering Railway redeploy:', error.message);
    return { success: false, reason: 'exception', error: error.message };
  }
}

app.use(cors());
app.use(express.json());

// Process a single URL
async function processUrl(browser, targetUrl) {
  const urlObj = new URL(targetUrl);
  const domain = urlObj.hostname;
  let context = null;
  let page = null;
  let success = false;
  let lastError = null;

  const startProxyIndex = proxyIndexLock.value;
  if (PROXY_SERVERS.length > 0) {
    proxyIndexLock.value = (proxyIndexLock.value + 1) % PROXY_SERVERS.length;
  }

  const maxRetries = PROXY_SERVERS.length > 0 ? PROXY_SERVERS.length + 1 : 1;

  for (let attempt = 0; attempt < maxRetries && !success; attempt++) {
    let detectedIP = 'Unknown';
    try {
      let proxyServer = null;
      if (attempt < PROXY_SERVERS.length) {
        proxyServer = PROXY_SERVERS[(startProxyIndex + attempt) % PROXY_SERVERS.length];
      } else {
        proxyServer = null;
        console.log(`Attempting ${targetUrl} without proxy (fallback)`);
      }

      const userAgent = getRandomUserAgent();
      const viewport = getRandomViewport();

      const contextOptions = {
        viewport: viewport,
        userAgent: userAgent,
        locale: 'en-US',
        timezoneId: 'America/New_York',
        permissions: [],
        extraHTTPHeaders: {
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Cache-Control': 'max-age=0'
        }
      };

      if (proxyServer && PROXY_USERNAME && PROXY_PASSWORD) {
        contextOptions.proxy = {
          server: `http://${proxyServer}`,
          username: PROXY_USERNAME,
          password: PROXY_PASSWORD
        };
        console.log(`Attempt ${attempt + 1}: Using proxy ${proxyServer} for ${targetUrl}`);
      }

      if (context) {
        await context.close();
        context = null;
      }

      context = await browser.newContext(contextOptions);
      page = await context.newPage();

      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        delete navigator.__proto__.webdriver;
        
        Object.defineProperty(navigator, 'plugins', {
          get: () => [
            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
            { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
          ]
        });

        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
        Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });

        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
        );

        window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {}, app: {} };

        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
          if (parameter === 37445) return 'Intel Inc.';
          if (parameter === 37446) return 'Intel Iris OpenGL Engine';
          return getParameter.call(this, parameter);
        };

        Object.defineProperty(navigator, 'getBattery', { get: () => undefined });
        window.console.debug = () => {};

        const originalToString = Function.prototype.toString;
        Function.prototype.toString = function() {
          if (this === navigator.webdriver) return 'function webdriver() { [native code] }';
          return originalToString.call(this);
        };

        const originalGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function(type, ...args) {
          const context = originalGetContext.call(this, type, ...args);
          if (type === '2d' || type === 'webgl' || type === 'webgl2') {
            if (context && context.fillText) {
              const originalFillText = context.fillText;
              context.fillText = function(...args) {
                return originalFillText.apply(this, args);
              };
            }
          }
          return context;
        };
      });

      console.log(`Navigating to: ${targetUrl}`);
      await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
        referer: 'https://www.google.com/'
      });

      try {
        const ipResponse = await page.evaluate(async () => {
          try {
            const response = await fetch('https://api.ipify.org?format=json', {
              method: 'GET',
              headers: { 'Accept': 'application/json' }
            });
            const data = await response.json();
            return data.ip;
          } catch (e) {
            return null;
          }
        });
        detectedIP = ipResponse || 'Failed to detect';
        console.log(`🌐 IP Address being used: ${detectedIP} | Proxy: ${proxyServer || 'No proxy'}`);
      } catch (ipErr) {
        console.log(`⚠️ Could not detect IP: ${ipErr.message}`);
      }

      try {
        const cookieSelectors = [
          'button:has-text("Accept")',
          'button:has-text("Accept All")',
          'button:has-text("I Accept")',
          '[id*="accept"]',
          '[class*="accept"]',
          '[data-testid*="accept"]'
        ];
        for (const selector of cookieSelectors) {
          try {
            const cookieBtn = await page.locator(selector).first();
            if (await cookieBtn.isVisible({ timeout: 2000 })) {
              await cookieBtn.click();
              console.log(`Clicked cookie accept button`);
              await page.waitForTimeout(randomDelay(500, 1000));
              break;
            }
          } catch (e) {}
        }
      } catch (cookieErr) {}

      await page.waitForTimeout(randomDelay(3000, 5000));
      await page.mouse.move(randomDelay(100, 500), randomDelay(100, 500));
      await page.waitForTimeout(randomDelay(800, 1500));
      await page.mouse.move(randomDelay(200, 700), randomDelay(200, 700));
      await page.waitForTimeout(randomDelay(500, 1000));

      try {
        const links = await page.locator('a').first();
        if (await links.isVisible({ timeout: 2000 })) {
          await links.hover();
          await page.waitForTimeout(randomDelay(300, 600));
        }
      } catch (e) {}

      const scrollSteps = randomDelay(3, 6);
      for (let i = 0; i < scrollSteps; i++) {
        await page.evaluate(() => {
          window.scrollBy(0, Math.random() * 400 + 200);
        });
        await page.waitForTimeout(randomDelay(800, 1500));
      }

      await page.evaluate(() => {
        window.scrollBy(0, -(Math.random() * 300 + 100));
      });
      await page.waitForTimeout(randomDelay(1000, 2000));
      await page.waitForTimeout(randomDelay(2000, 3000));
      await page.waitForTimeout(randomDelay(6000, 10000));

      const html = await page.content();
      const screenshotBuffer = await page.screenshot({
        fullPage: true,
        type: 'jpeg',
        quality: 80
      });
      const screenshotBase64 = screenshotBuffer.toString('base64');

      const result = {
        url: targetUrl,
        status: 'success',
        ipAddress: detectedIP,
        proxy: proxyServer || 'No proxy',
        html: html,
        screenshot: `data:image/jpeg;base64,${screenshotBase64}`
      };

      success = true;
      console.log(`✓ Successfully processed ${targetUrl} | IP: ${detectedIP}`);

      if (page) {
        try { await page.close(); } catch (e) {}
      }
      if (context) {
        try { await context.close(); } catch (e) {}
      }

      return result;

    } catch (err) {
      lastError = err;
      console.error(`Attempt ${attempt + 1} failed for ${targetUrl}:`, err.message);

      if (page) {
        try { await page.close(); } catch (e) {}
        page = null;
      }
      if (context) {
        try { await context.close(); } catch (e) {}
        context = null;
      }

      const isProxyError = err.message.includes('TUNNEL_CONNECTION_FAILED') ||
        err.message.includes('PROXY_CONNECTION_FAILED') ||
        err.message.includes('ERR_PROXY');

      if (isProxyError && attempt < maxRetries - 1) {
        console.log(`Proxy failed, retrying with next proxy...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
    }
  }

  if (!success) {
    console.error(`All attempts failed for ${targetUrl}`);
    let errorType = 'unknown';
    if (lastError && lastError.message) {
      if (lastError.message.includes('Timeout')) {
        errorType = 'timeout';
      } else if (lastError.message.includes('net::') || lastError.message.includes('TUNNEL') || lastError.message.includes('PROXY')) {
        errorType = 'network';
      } else if (lastError.message.includes('blocked') || lastError.message.includes('403') || lastError.message.includes('captcha')) {
        errorType = 'blocked';
      }
    }

    return {
      url: targetUrl,
      status: 'error',
      errorType: errorType,
      error: lastError ? lastError.message : 'Unknown error'
    };
  }
}

// Main render endpoint with auto-redeploy
app.post('/render', async (req, res) => {
  const { url, urls } = req.body;
  const targetUrls = urls || (url ? [url] : []);
  
  if (targetUrls.length === 0) {
    return res.status(400).json({ 
      error: 'No URL provided. Please provide "url" (string) or "urls" (array) in the request body.' 
    });
  }

  let browser = null;
  try {
    const launchOptions = {
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-ipc-flooding-protection',
        '--window-size=1920,1080',
        '--disable-infobars',
        '--disable-notifications',
        '--disable-popup-blocking',
        '--disable-translate',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-component-extensions-with-background-pages',
        '--disable-default-apps',
        '--mute-audio',
        '--no-first-run',
        '--no-default-browser-check',
        '--autoplay-policy=user-gesture-required',
        '--disable-background-networking',
        '--disable-breakpad',
        '--disable-client-side-phishing-detection',
        '--disable-component-update',
        '--disable-domain-reliability',
        '--disable-features=AudioServiceOutOfProcess',
        '--disable-hang-monitor',
        '--disable-prompt-on-repost',
        '--disable-sync',
        '--metrics-recording-only',
        '--no-pings',
        '--password-store=basic',
        '--use-mock-keychain',
        '--force-color-profile=srgb',
        '--disable-features=BlinkGenPropertyTrees'
      ]
    };

    browser = await chromium.launch(launchOptions);

    console.log(`🚀 Processing ${targetUrls.length} URL(s) in parallel...`);
    const results = await Promise.allSettled(
      targetUrls.map(targetUrl => processUrl(browser, targetUrl))
    );

    const formattedResults = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          url: targetUrls[index],
          status: 'error',
          errorType: 'unknown',
          error: result.reason ? result.reason.message : 'Unexpected error'
        };
      }
    });

    // Send response to client FIRST
    res.json({ results: formattedResults });
    
    console.log('📦 Response sent to client. Initiating auto-redeploy...');
    
    // After sending response, trigger Railway redeploy asynchronously
    setImmediate(async () => {
      // Small delay to ensure response is completely flushed
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const redeployResult = await triggerRailwayRedeploy();
      
      if (redeployResult.success) {
        console.log('🎉 Auto-redeploy initiated successfully. Service will restart shortly.');
      } else {
        console.log(`⚠️ Auto-redeploy skipped or failed: ${redeployResult.reason}`);
        if (redeployResult.errors) {
          console.log('Error details:', JSON.stringify(redeployResult.errors, null, 2));
        }
      }
    });

  } catch (err) {
    console.error('Browser launch error:', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Railway auto-redeploy: ${RAILWAY_API_TOKEN ? '✅ Enabled' : '⚠️ Disabled (credentials not set)'}`);
});
