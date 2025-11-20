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
        // Launch browser in headed mode with stealth args
        const launchOptions = {
            headless: false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-site-isolation-trials',
                '--disable-web-security',
                '--disable-features=BlockInsecurePrivateNetworkRequests',
                '--flag-switches-begin',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--flag-switches-end',
                '--window-size=1920,1080',
                '--start-maximized'
            ],
            ignoreDefaultArgs: ['--enable-automation']
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
                
                // Comprehensive stealth script injection
                await page.addInitScript(() => {
                    // Pass the Webdriver Test
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined
                    });

                    // Pass the Chrome Test
                    window.chrome = {
                        runtime: {},
                        loadTimes: function() {},
                        csi: function() {},
                        app: {}
                    };

                    // Pass the Permissions Test
                    const originalQuery = window.navigator.permissions.query;
                    window.navigator.permissions.query = (parameters) => (
                        parameters.name === 'notifications' ?
                            Promise.resolve({ state: Notification.permission }) :
                            originalQuery(parameters)
                    );

                    // Pass the Plugins Length Test
                    Object.defineProperty(navigator, 'plugins', {
                        get: () => [
                            {
                                0: {type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format", enabledPlugin: Plugin},
                                description: "Portable Document Format",
                                filename: "internal-pdf-viewer",
                                length: 1,
                                name: "Chrome PDF Plugin"
                            },
                            {
                                0: {type: "application/pdf", suffixes: "pdf", description: "", enabledPlugin: Plugin},
                                description: "",
                                filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
                                length: 1,
                                name: "Chrome PDF Viewer"
                            },
                            {
                                0: {type: "application/x-nacl", suffixes: "", description: "Native Client Executable", enabledPlugin: Plugin},
                                1: {type: "application/x-pnacl", suffixes: "", description: "Portable Native Client Executable", enabledPlugin: Plugin},
                                description: "",
                                filename: "internal-nacl-plugin",
                                length: 2,
                                name: "Native Client"
                            }
                        ]
                    });

                    // Pass the Languages Test
                    Object.defineProperty(navigator, 'languages', {
                        get: () => ['en-US', 'en']
                    });

                    // Pass the iframe Test
                    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
                        get: function() {
                            return window;
                        }
                    });

                    // Pass toString test
                    window.navigator.chrome = {
                        runtime: {},
                        loadTimes: function() {},
                        csi: function() {},
                        app: {}
                    };

                    // Overwrite the `plugins` property to use a custom getter.
                    Object.defineProperty(navigator, 'plugins', {
                        get: () => [1, 2, 3, 4, 5],
                    });

                    // Pass the Modernizr test
                    window.Modernizr = {
                        canvas: true,
                        canvastext: true,
                        webgl: true,
                        touch: false,
                        geolocation: true
                    };

                    // Pass the hairline detection
                    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
                        get: function() {
                            return 1;
                        }
                    });

                    // Mock screen properties
                    Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
                    Object.defineProperty(screen, 'availHeight', { get: () => 1080 });
                    Object.defineProperty(screen, 'width', { get: () => 1920 });
                    Object.defineProperty(screen, 'height', { get: () => 1080 });

                    // Mock battery API
                    Object.defineProperty(navigator, 'getBattery', {
                        value: () => Promise.resolve({
                            charging: true,
                            chargingTime: 0,
                            dischargingTime: Infinity,
                            level: 1
                        })
                    });

                    // Remove automation indicators
                    delete navigator.__proto__.webdriver;

                    // Mock connection
                    Object.defineProperty(navigator, 'connection', {
                        get: () => ({
                            effectiveType: '4g',
                            rtt: 50,
                            downlink: 10,
                            saveData: false
                        })
                    });

                    // Mock hardware concurrency
                    Object.defineProperty(navigator, 'hardwareConcurrency', {
                        get: () => 8
                    });

                    // Mock device memory
                    Object.defineProperty(navigator, 'deviceMemory', {
                        get: () => 8
                    });

                    // Randomize canvas fingerprint
                    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
                    HTMLCanvasElement.prototype.toDataURL = function(type) {
                        const shift = Math.floor(Math.random() * 10) - 5;
                        const canvas = this;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                            for (let i = 0; i < imageData.data.length; i += 4) {
                                imageData.data[i] = imageData.data[i] + shift;
                            }
                            ctx.putImageData(imageData, 0, 0);
                        }
                        return originalToDataURL.apply(this, [type]);
                    };

                    // Mock WebGL vendor
                    const getParameter = WebGLRenderingContext.prototype.getParameter;
                    WebGLRenderingContext.prototype.getParameter = function(parameter) {
                        if (parameter === 37445) {
                            return 'Intel Inc.';
                        }
                        if (parameter === 37446) {
                            return 'Intel Iris OpenGL Engine';
                        }
                        return getParameter.apply(this, [parameter]);
                    };
                });
                
                console.log(`Navigating to: ${targetUrl}`);
                
                // Random delay before navigation (simulate human thinking time)
                await page.waitForTimeout(Math.random() * 1000 + 500);
                
                // Navigate to page
                await page.goto(targetUrl, { 
                    waitUntil: 'domcontentloaded', 
                    timeout: 60000 
                });
                
                // Wait for page to stabilize
                await page.waitForTimeout(1000);
                
                // Simulate realistic mouse movements (multiple random movements)
                for (let i = 0; i < 3; i++) {
                    const x = Math.floor(Math.random() * 1920);
                    const y = Math.floor(Math.random() * 1080);
                    await page.mouse.move(x, y, { steps: 10 });
                    await page.waitForTimeout(Math.random() * 500 + 200);
                }
                
                // Simulate human-like scrolling with varying speeds
                await page.evaluate(async () => {
                    const scrolls = Math.floor(Math.random() * 3) + 2;
                    for (let s = 0; s < scrolls; s++) {
                        const distance = Math.floor(Math.random() * 400) + 200;
                        const steps = Math.floor(Math.random() * 20) + 15;
                        
                        for (let i = 0; i < steps; i++) {
                            window.scrollBy(0, distance / steps);
                            await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 30));
                        }
                        
                        // Pause between scrolls (simulate reading)
                        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
                    }
                    
                    // Scroll back up a bit (human behavior)
                    window.scrollBy(0, -100);
                });
                
                // Random click somewhere safe (like empty space)
                try {
                    await page.mouse.click(Math.random() * 200 + 100, Math.random() * 200 + 100);
                } catch (e) {
                    // Ignore click errors
                }
                
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


