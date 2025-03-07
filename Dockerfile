FROM node:18-alpine

WORKDIR /usr/src/app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy app source
COPY . .

# Expose port (will be overridden by environment variable)
EXPOSE ${PORT:-3000}

# Start the application
CMD ["node", "index.js"]