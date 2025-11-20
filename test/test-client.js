const fs = require('fs');
const path = require('path');

// Configuration
const API_URL = 'https://chromeworkers-production.up.railway.app/render';
// const API_URL = 'http://localhost:3000/render'; // For local testing

const TEST_URLS = [
    'https://www.amazon.in/s?k=hoodies',
    'https://www.meesho.com/search?q=laptops',
    
    // Add more URLs to test
];

/**
 * Test client to hit the Playwright Cloud Renderer API
 * Saves HTML and screenshot for each URL
 */
async function testRenderAPI(urls) {
    console.log('Starting Playwright Cloud Renderer test...\n');
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ urls: urls })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log(`Received ${data.results.length} results\n`);

        // Process each result
        for (let i = 0; i < data.results.length; i++) {
            const result = data.results[i];
            console.log(`\n--- Result ${i + 1}: ${result.url} ---`);
            console.log(`Status: ${result.status}`);

            if (result.status === 'success') {
                // Save HTML
                const htmlFilename = `result_${i + 1}_${sanitizeFilename(result.url)}.html`;
                const htmlPath = path.join(__dirname, htmlFilename);
                fs.writeFileSync(htmlPath, result.html, 'utf8');
                console.log(`✓ HTML saved to: ${htmlFilename}`);

                // Save Screenshot
                if (result.screenshot) {
                    // Extract base64 data from data URI
                    const base64Data = result.screenshot.replace(/^data:image\/\w+;base64,/, '');
                    const imageBuffer = Buffer.from(base64Data, 'base64');
                    
                    const imageFilename = `result_${i + 1}_${sanitizeFilename(result.url)}.jpg`;
                    const imagePath = path.join(__dirname, imageFilename);
                    fs.writeFileSync(imagePath, imageBuffer);
                    console.log(`✓ Screenshot saved to: ${imageFilename}`);
                }
            } else {
                console.log(`✗ Error: ${result.error}`);
                if (result.errorType) {
                    console.log(`  Error Type: ${result.errorType}`);
                }
            }
        }

        console.log('\n✓ Test completed successfully!');
        
    } catch (error) {
        console.error('\n✗ Test failed:', error.message);
        process.exit(1);
    }
}

/**
 * Sanitize URL to create a valid filename
 */
function sanitizeFilename(url) {
    return url
        .replace(/^https?:\/\//, '')
        .replace(/[^a-z0-9]/gi, '_')
        .substring(0, 50);
}

// Run the test
testRenderAPI(TEST_URLS);

