# Use the official Playwright image which includes all OS dependencies for browsers
FROM mcr.microsoft.com/playwright:v1.48.0-focal

# Install Xvfb to support headed mode (headless: false)
RUN apt-get update && apt-get install -y \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies (use npm ci for production reliability)
RUN npm ci --only=production

# Copy source code
COPY . .

# Make entrypoint executable
RUN chmod +x entrypoint.sh

# Expose the API port
EXPOSE 3000

# Use the entrypoint script to set up Xvfb before running the app
ENTRYPOINT ["./entrypoint.sh"]

# Default command to start the server
CMD ["node", "server.js"]


