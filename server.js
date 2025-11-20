const express = require('express');
const { chromium } = require('playwright');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Proxy configuration from environment variables
const PROXY_SERVER = process.env.PROXY_SERVER; // e.g., 'gate.decodo.com:10001'
const PROXY_USERNAME = process.env.PROXY_USERNAME; // e.g., 'sphhexq8n5'
const PROXY_PASSWORD = "yicf=8VrpMD384evBc"; // e.g., 'yicf=8VpMD3...'

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
        // Launch browser in headed mode with args to improve stability in container
        const launchOptions = {
            headless: false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ]
        };

        // Add proxy configuration if environment variables are set
        if (PROXY_SERVER && PROXY_USERNAME && PROXY_PASSWORD) {
            launchOptions.proxy = {
                server: `http://${PROXY_SERVER}`,
                username: PROXY_USERNAME,
                password: PROXY_PASSWORD
            };
            console.log(`Using proxy: ${PROXY_SERVER}`);
        }

        browser = await chromium.launch(launchOptions);

        // Create context with realistic browser fingerprint
        const context = await browser.newContext({
            viewport: { width: 1920, height: 1080 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            locale: 'en-US',
            timezoneId: 'America/New_York',
            permissions: ['geolocation'],
            geolocation: { latitude: 40.7128, longitude: -74.0060 }, // New York coordinates
            colorScheme: 'light',
            deviceScaleFactor: 1,
            isMobile: false,
            hasTouch: false,
            extraHTTPHeaders: {
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-User': '?1',
                'Sec-Fetch-Dest': 'document',
                'Upgrade-Insecure-Requests': '1'
            }
        });

        for (const targetUrl of targetUrls) {
            let page = null;
            try {
                page = await context.newPage();
                
                // Inject scripts to mask automation detection
                await page.addInitScript(() => {
                    // Overwrite the navigator.webdriver property
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => false
                    });

                    // Overwrite the chrome property
                    window.chrome = {
                        runtime: {}
                    };

                    // Overwrite permissions
                    const originalQuery = window.navigator.permissions.query;
                    window.navigator.permissions.query = (parameters) => (
                        parameters.name === 'notifications' ?
                            Promise.resolve({ state: Notification.permission }) :
                            originalQuery(parameters)
                    );

                    // Add plugins
                    Object.defineProperty(navigator, 'plugins', {
                        get: () => [1, 2, 3, 4, 5]
                    });

                    // Add languages
                    Object.defineProperty(navigator, 'languages', {
                        get: () => ['en-US', 'en']
                    });
                });
                
                console.log(`Navigating to: ${targetUrl}`);
                
                // Random delay before navigation (simulate human thinking time)
                await page.waitForTimeout(Math.random() * 1000 + 500);
                
                // Navigate to page
                await page.goto(targetUrl, { 
                    waitUntil: 'domcontentloaded', 
                    timeout: 60000 
                });
                
                // Simulate human-like behavior: random scrolling
                await page.evaluate(async () => {
                    const distance = Math.floor(Math.random() * 500) + 300;
                    const delay = Math.floor(Math.random() * 100) + 50;
                    
                    for (let i = 0; i < distance; i += 10) {
                        window.scrollBy(0, 10);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                });
                
                // Random mouse movement
                await page.mouse.move(
                    Math.random() * 1920, 
                    Math.random() * 1080
                );
                
                // Wait for dynamic content with random delay (simulate reading time)
                await page.waitForTimeout(Math.random() * 2000 + 2000);

                // Capture HTML
                const html = await page.content();

                // Capture Screenshot
                // fullPage: true captures the whole scrollable page. 
                // If you only want the viewport, set fullPage: false.
                const screenshotBuffer = await page.screenshot({ fullPage: true, type: 'jpeg', quality: 80 });
                const screenshotBase64 = screenshotBuffer.toString('base64');

                results.push({
                    url: targetUrl,
                    status: 'success',
                    html: html,
                    screenshot: `data:image/jpeg;base64,${screenshotBase64}`
                });

            } catch (err) {
                console.error(`Error processing ${targetUrl}:`, err.message);
                
                // Provide more detailed error information
                let errorType = 'unknown';
                if (err.message.includes('Timeout')) {
                    errorType = 'timeout';
                } else if (err.message.includes('net::')) {
                    errorType = 'network';
                } else if (err.message.includes('blocked') || err.message.includes('403') || err.message.includes('captcha')) {
                    errorType = 'blocked';
                }
                
                results.push({
                    url: targetUrl,
                    status: 'error',
                    errorType: errorType,
                    error: err.message
                });
            } finally {
                if (page) await page.close();
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


