const express = require('express');
const { chromium } = require('playwright');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Proxy configuration from environment variables
// Can be single proxy or comma-separated list: 'proxy1:port,proxy2:port'
const PROXY_SERVERS = process.env.PROXY_SERVER ? process.env.PROXY_SERVER.split(',').map(s => s.trim()) : [];
const PROXY_USERNAME = process.env.PROXY_USERNAME; // e.g., 'sphhexq8n5'
const PROXY_PASSWORD = process.env.PROXY_PASSWORD || "yicf=8VrpMD384evBc";

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

let proxyIndex = 0;

// Get next proxy in rotation
function getNextProxy() {
    if (PROXY_SERVERS.length === 0) return null;
    const proxy = PROXY_SERVERS[proxyIndex % PROXY_SERVERS.length];
    proxyIndex++;
    return proxy;
}

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

app.use(cors());
app.use(express.json());

app.post('/render', async (req, res) => {
    const { url, urls } = req.body;
    const targetUrls = urls || (url ? [url] : []);

    if (targetUrls.length === 0) {
        return res.status(400).json({ error: 'No URL provided. Please provide "url" (string) or "urls" (array) in the request body.' });
    }

    const results = [];
    let browser = null;

    try {
        // Launch browser in headed mode with anti-detection args
        const launchOptions = {
            headless: false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled', // Hide automation
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--disable-ipc-flooding-protection',
                '--window-size=1920,1080'
            ]
        };

        browser = await chromium.launch(launchOptions);

        // Process each URL with a fresh context to avoid fingerprinting
        for (const targetUrl of targetUrls) {
            let context = null;
            let page = null;
            let success = false;
            let lastError = null;
            
            // Try with proxy first, then fallback to no proxy if all proxies fail
            const maxRetries = PROXY_SERVERS.length > 0 ? PROXY_SERVERS.length + 1 : 1; // +1 for no-proxy fallback
            
            for (let attempt = 0; attempt < maxRetries && !success; attempt++) {
                try {
                    // Get proxy for this attempt (rotates if multiple proxies available)
                    let proxyServer = null;
                    if (attempt < PROXY_SERVERS.length) {
                        // Rotate through proxies, starting from a different one for each URL
                        const startIndex = proxyIndex % PROXY_SERVERS.length;
                        proxyServer = PROXY_SERVERS[(startIndex + attempt) % PROXY_SERVERS.length];
                    } else {
                        // Last attempt: no proxy
                        proxyServer = null;
                        console.log(`Attempting ${targetUrl} without proxy (fallback)`);
                    }
                    
                    const userAgent = getRandomUserAgent();
                    const viewport = getRandomViewport();
                    
                    // Create context options with anti-detection measures
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

                    // Add proxy if available
                    if (proxyServer && PROXY_USERNAME && PROXY_PASSWORD) {
                        contextOptions.proxy = {
                            server: `http://${proxyServer}`,
                            username: PROXY_USERNAME,
                            password: PROXY_PASSWORD
                        };
                        console.log(`Attempt ${attempt + 1}: Using proxy ${proxyServer} for ${targetUrl}`);
                    }

                    // Close previous context if retrying
                    if (context) {
                        await context.close();
                        context = null;
                    }

                    context = await browser.newContext(contextOptions);
                    page = await context.newPage();

                    // Inject anti-detection scripts before navigation
                    await page.addInitScript(() => {
                        // Hide webdriver property
                        Object.defineProperty(navigator, 'webdriver', {
                            get: () => false,
                        });

                        // Override plugins
                        Object.defineProperty(navigator, 'plugins', {
                            get: () => [1, 2, 3, 4, 5],
                        });

                        // Override languages
                        Object.defineProperty(navigator, 'languages', {
                            get: () => ['en-US', 'en'],
                        });

                        // Override permissions
                        const originalQuery = window.navigator.permissions.query;
                        window.navigator.permissions.query = (parameters) => (
                            parameters.name === 'notifications' ?
                                Promise.resolve({ state: Notification.permission }) :
                                originalQuery(parameters)
                        );

                        // Mock chrome object
                        window.chrome = {
                            runtime: {},
                        };

                        // Override getParameter to always return default
                        const getParameter = WebGLRenderingContext.prototype.getParameter;
                        WebGLRenderingContext.prototype.getParameter = function(parameter) {
                            if (parameter === 37445) {
                                return 'Intel Inc.';
                            }
                            if (parameter === 37446) {
                                return 'Intel Iris OpenGL Engine';
                            }
                            return getParameter.call(this, parameter);
                        };
                    });

                    console.log(`Navigating to: ${targetUrl}`);
                    
                    // Navigate with realistic referrer
                    await page.goto(targetUrl, { 
                        waitUntil: 'domcontentloaded', 
                        timeout: 60000,
                        referer: 'https://www.google.com/'
                    });
                    
                    // Random delay before interaction (mimic human reading)
                    await page.waitForTimeout(randomDelay(1500, 3000));

                    // Simulate human-like mouse movement
                    await page.mouse.move(randomDelay(100, 500), randomDelay(100, 500));
                    await page.waitForTimeout(randomDelay(200, 500));

                    // Simulate scrolling (human behavior)
                    const scrollSteps = randomDelay(2, 5);
                    for (let i = 0; i < scrollSteps; i++) {
                        await page.evaluate(() => {
                            window.scrollBy(0, Math.random() * 300 + 100);
                        });
                        await page.waitForTimeout(randomDelay(300, 800));
                    }

                    // Scroll back up a bit (common human behavior)
                    await page.evaluate(() => {
                        window.scrollBy(0, -(Math.random() * 200 + 50));
                    });
                    await page.waitForTimeout(randomDelay(500, 1000));

                    // Wait for dynamic content
                    await page.waitForTimeout(randomDelay(1000, 2000));

                    // Extra wait time to ensure page is fully loaded before scraping
                    await page.waitForTimeout(randomDelay(5000, 8000));

                    // Capture HTML
                    const html = await page.content();

                    // Capture Screenshot
                    const screenshotBuffer = await page.screenshot({ 
                        fullPage: true, 
                        type: 'jpeg', 
                        quality: 80 
                    });
                    const screenshotBase64 = screenshotBuffer.toString('base64');

                    results.push({
                        url: targetUrl,
                        status: 'success',
                        html: html,
                        screenshot: `data:image/jpeg;base64,${screenshotBase64}`
                    });

                    success = true; // Mark as successful
                    console.log(`✓ Successfully processed ${targetUrl}`);

                } catch (err) {
                    lastError = err;
                    console.error(`Attempt ${attempt + 1} failed for ${targetUrl}:`, err.message);
                    
                    // Close failed context/page before retry
                    if (page) {
                        try { await page.close(); } catch (e) {}
                        page = null;
                    }
                    if (context) {
                        try { await context.close(); } catch (e) {}
                        context = null;
                    }
                    
                    // If this was a proxy error and we have more proxies to try, continue
                    const isProxyError = err.message.includes('TUNNEL_CONNECTION_FAILED') || 
                                       err.message.includes('PROXY_CONNECTION_FAILED') ||
                                       err.message.includes('ERR_PROXY');
                    
                    if (isProxyError && attempt < maxRetries - 1) {
                        console.log(`Proxy failed, retrying with next proxy...`);
                        await new Promise(resolve => setTimeout(resolve, 1000)); // Brief delay before retry
                        continue; // Try next proxy
                    }
                }
            }
            
            // If all attempts failed, report error
            if (!success) {
                console.error(`All attempts failed for ${targetUrl}`);
                
                // Provide more detailed error information
                let errorType = 'unknown';
                if (lastError.message.includes('Timeout')) {
                    errorType = 'timeout';
                } else if (lastError.message.includes('net::') || lastError.message.includes('TUNNEL') || lastError.message.includes('PROXY')) {
                    errorType = 'network';
                } else if (lastError.message.includes('blocked') || lastError.message.includes('403') || lastError.message.includes('captcha')) {
                    errorType = 'blocked';
                }
                
                results.push({
                    url: targetUrl,
                    status: 'error',
                    errorType: errorType,
                    error: lastError.message
                });
            }
            
            // Increment proxy index for next URL (ensures rotation across URLs)
            if (PROXY_SERVERS.length > 0) {
                proxyIndex++;
            }
            
            // Clean up
            if (page) {
                try { await page.close(); } catch (e) {}
            }
            if (context) {
                try { await context.close(); } catch (e) {}
            }
        }

        res.json({ results });

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
});


