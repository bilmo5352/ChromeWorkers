const express = require('express');
const { chromium } = require('playwright');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

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
        browser = await chromium.launch({
            headless: false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu'
            ]
        });

        const context = await browser.newContext({
             viewport: { width: 1280, height: 720 }
        });

        for (const targetUrl of targetUrls) {
            let page = null;
            try {
                page = await context.newPage();
                
                console.log(`Navigating to: ${targetUrl}`);
                // Use 'domcontentloaded' which is more reliable than 'networkidle'
                // Timeout of 60 seconds to handle heavy sites
                await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                
                // Wait an additional 2 seconds for dynamic content to load
                await page.waitForTimeout(2000);

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


