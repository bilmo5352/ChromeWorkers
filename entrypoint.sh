#!/bin/bash

# Start Xvfb in the background on display :99
# -ac disables access control (ok for container)
# -screen 0 1280x1024x24 sets the resolution
Xvfb :99 -ac -screen 0 1280x1024x24 &

# Export the display environment variable so Playwright uses it
export DISPLAY=:99

# Wait a moment for Xvfb to start
sleep 1

# Execute the command passed to the container (CMD in Dockerfile)
exec "$@"


