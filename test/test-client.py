import requests
import base64
import re
import os

# Configuration
API_URL = 'https://chromeworkers-production.up.railway.app/render'
# API_URL = 'http://localhost:3000/render'  # For local testing

TEST_URLS = [
    'https://example.com',
    'https://www.wikipedia.org',
    # Add more URLs to test
]


def sanitize_filename(url):
    """Sanitize URL to create a valid filename"""
    filename = re.sub(r'^https?://', '', url)
    filename = re.sub(r'[^a-z0-9]', '_', filename, flags=re.IGNORECASE)
    return filename[:50]


def test_render_api(urls):
    """Test client to hit the Playwright Cloud Renderer API"""
    print('Starting Playwright Cloud Renderer test...\n')
    
    try:
        # Send request to API
        response = requests.post(
            API_URL,
            json={'urls': urls},
            headers={'Content-Type': 'application/json'}
        )
        response.raise_for_status()
        
        data = response.json()
        print(f'Received {len(data["results"])} results\n')
        
        # Process each result
        for i, result in enumerate(data['results'], 1):
            print(f'\n--- Result {i}: {result["url"]} ---')
            print(f'Status: {result["status"]}')
            
            if result['status'] == 'success':
                # Save HTML
                html_filename = f'result_{i}_{sanitize_filename(result["url"])}.html'
                html_path = os.path.join(os.path.dirname(__file__), html_filename)
                with open(html_path, 'w', encoding='utf-8') as f:
                    f.write(result['html'])
                print(f'✓ HTML saved to: {html_filename}')
                
                # Save Screenshot
                if 'screenshot' in result and result['screenshot']:
                    # Extract base64 data from data URI
                    base64_data = re.sub(r'^data:image/\w+;base64,', '', result['screenshot'])
                    image_data = base64.b64decode(base64_data)
                    
                    image_filename = f'result_{i}_{sanitize_filename(result["url"])}.jpg'
                    image_path = os.path.join(os.path.dirname(__file__), image_filename)
                    with open(image_path, 'wb') as f:
                        f.write(image_data)
                    print(f'✓ Screenshot saved to: {image_filename}')
            else:
                print(f'✗ Error: {result["error"]}')
                if 'errorType' in result:
                    print(f'  Error Type: {result["errorType"]}')
        
        print('\n✓ Test completed successfully!')
        
    except requests.exceptions.RequestException as e:
        print(f'\n✗ Test failed: {e}')
        exit(1)
    except Exception as e:
        print(f'\n✗ Unexpected error: {e}')
        exit(1)


if __name__ == '__main__':
    test_render_api(TEST_URLS)

