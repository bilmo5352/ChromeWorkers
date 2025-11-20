const express = require('express');
const { chromium } = require('playwright');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration from environment variables
const PROXY_SERVER = process.env.PROXY_SERVER; // e.g., 'gate.decodo.com:10001'
const PROXY_USERNAME = process.env.PROXY_USERNAME; // e.g., 'sphhexq8n5'
const PROXY_PASSWORD = process.env.PROXY_PASSWORD || "yicf=8VrpMD384evBc";
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT || '10'); // Max parallel pages
const PAGE_TIMEOUT = parseInt(process.env.PAGE_TIMEOUT || '60000'); // Page load timeout in ms
const RENDER_WAIT = parseInt(process.env.RENDER_WAIT || '2000'); // Wait time after page load in ms
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES || '1'); // Retry failed requests

app.use(cors());
app.use(express.json());

// Helper function to limit concurrency
async function processWithConcurrencyLimit(items, limit, processor) {
    const results = [];
    const executing = [];
    
    for (const item of items) {
        const promise = Promise.resolve(processor(item)).then(result => {
            executing.splice(executing.indexOf(promise), 1);
            return result;
        });
        
        results.push(promise);
        executing.push(promise);
        
        if (executing.length >= limit) {
            await Promise.race(executing);
        }
    }
    
    return Promise.allSettled(results);
}

// Worker function to process a single URL
async function processUrl(context, targetUrl, retryCount = 0) {
    let page = null;
    try {
        page = await context.newPage();
        
        console.log(`[${new Date().toISOString()}] Processing: ${targetUrl} (attempt ${retryCount + 1})`);
        
        // Navigate to URL
        await page.goto(targetUrl, { 
            waitUntil: 'domcontentloaded', 
            timeout: PAGE_TIMEOUT 
        });
        
        // Wait for dynamic content
        await page.waitForTimeout(RENDER_WAIT);

        // Capture HTML
        const html = await page.content();

        // Capture Screenshot
        const screenshotBuffer = await page.screenshot({ 
            fullPage: true, 
            type: 'jpeg', 
            quality: 80 
        });
        const screenshotBase64 = screenshotBuffer.toString('base64');

        console.log(`[${new Date().toISOString()}] ✓ Success: ${targetUrl}`);
        
        return {
            url: targetUrl,
            status: 'success',
            html: html,
            screenshot: `data:image/jpeg;base64,${screenshotBase64}`
        };

    } catch (err) {
        console.error(`[${new Date().toISOString()}] ✗ Error processing ${targetUrl}:`, err.message);
        
        // Retry logic for certain error types
        const shouldRetry = retryCount < MAX_RETRIES && (
            err.message.includes('Timeout') || 
            err.message.includes('net::ERR_') ||
            err.message.includes('Navigation timeout')
        );
        
        if (shouldRetry) {
            console.log(`[${new Date().toISOString()}] Retrying ${targetUrl}...`);
            if (page) await page.close();
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
            return processUrl(context, targetUrl, retryCount + 1);
        }
        
        // Determine error type
        let errorType = 'unknown';
        if (err.message.includes('Timeout') || err.message.includes('Navigation timeout')) {
            errorType = 'timeout';
        } else if (err.message.includes('net::')) {
            errorType = 'network';
        } else if (err.message.includes('blocked') || err.message.includes('403') || err.message.includes('captcha') || err.message.includes('403')) {
            errorType = 'blocked';
        } else if (err.message.includes('404')) {
            errorType = 'not_found';
        }
        
        return {
            url: targetUrl,
            status: 'error',
            errorType: errorType,
            error: err.message,
            retries: retryCount
        };
    } finally {
        if (page) {
            try {
                await page.close();
            } catch (closeErr) {
                console.error(`Error closing page for ${targetUrl}:`, closeErr.message);
            }
        }
    }
}

app.post('/render', async (req, res) => {
    const { url, urls, concurrency } = req.body;
    const targetUrls = urls || (url ? [url] : []);
    const maxConcurrent = concurrency || MAX_CONCURRENT;

    if (targetUrls.length === 0) {
        return res.status(400).json({ 
            error: 'No URL provided. Please provide "url" (string) or "urls" (array) in the request body.' 
        });
    }

    console.log(`[${new Date().toISOString()}] Received ${targetUrls.length} URL(s) to process with concurrency limit: ${maxConcurrent}`);

    let browser = null;
    const startTime = Date.now();

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
        console.log(`[${new Date().toISOString()}] Browser launched successfully`);

        const context = await browser.newContext({
            viewport: { width: 1280, height: 720 }
        });

        // Process URLs in parallel with concurrency limit
        const settledResults = await processWithConcurrencyLimit(
            targetUrls,
            maxConcurrent,
            (targetUrl) => processUrl(context, targetUrl)
        );

        // Extract results from Promise.allSettled format
        const results = settledResults.map((settled, index) => {
            if (settled.status === 'fulfilled') {
                return settled.value;
            } else {
                // Handle unexpected promise rejection
                return {
                    url: targetUrls[index],
                    status: 'error',
                    errorType: 'unexpected',
                    error: settled.reason?.message || 'Unexpected error'
                };
            }
        });

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        
        const successCount = results.filter(r => r.status === 'success').length;
        const errorCount = results.filter(r => r.status === 'error').length;
        
        console.log(`[${new Date().toISOString()}] Completed: ${successCount} success, ${errorCount} errors in ${duration}s`);

        res.json({ 
            results,
            summary: {
                total: results.length,
                success: successCount,
                errors: errorCount,
                duration: `${duration}s`
            }
        });

    } catch (err) {
        console.error(`[${new Date().toISOString()}] Browser launch error:`, err);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            details: err.message 
        });
    } finally {
        if (browser) {
            try {
                await browser.close();
                console.log(`[${new Date().toISOString()}] Browser closed`);
            } catch (closeErr) {
                console.error('Error closing browser:', closeErr.message);
            }
        }
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});


