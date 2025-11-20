# Test Client for Playwright Cloud Renderer

This folder contains a test client to verify the Playwright Cloud Renderer API.

## Files

- `test-client.js` - Node.js test client that hits the API and saves results
- `test-client.py` - Python test client (alternative implementation)

## Usage

### Node.js Client

```bash
cd test
node test-client.js
```

### Python Client

```bash
cd test
python test-client.py
```

## What it does

1. Sends a POST request to the API with test URLs
2. Receives HTML and screenshot data
3. Saves HTML to `.html` files
4. Saves screenshots to `.jpg` files

## Configuration

Edit the URLs in the test file:

**JavaScript:**
```javascript
const TEST_URLS = [
    'https://example.com',
    'https://www.wikipedia.org',
];
```

**Python:**
```python
TEST_URLS = [
    'https://example.com',
    'https://www.wikipedia.org',
]
```

## Output

Results are saved as:
- `result_1_example_com.html`
- `result_1_example_com.jpg`
- `result_2_www_wikipedia_org.html`
- `result_2_www_wikipedia_org.jpg`

## API Endpoint

By default, uses production: `https://chromeworkers-production.up.railway.app/render`

To test locally, uncomment the localhost line:
```javascript
// const API_URL = 'http://localhost:3000/render';
```

