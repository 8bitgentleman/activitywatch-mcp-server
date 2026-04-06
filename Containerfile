# --- Stage 1: Build ---
FROM node:20-slim AS builder

# Set the working directory
WORKDIR /app

# Copy package files first to leverage layer caching
COPY package*.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm install --ignore-scripts

# Copy the rest of your application source code
COPY . .

# Run the build command
RUN npm run build

# --- Stage 2: Production ---
FROM node:20-slim

# Set environment to production
ENV NODE_ENV=production

WORKDIR /app

# Copy only the package files
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev --ignore-scripts

# Copy the built files from the 'builder' stage
# NOTE: Replace 'dist' with your actual build output folder (e.g., 'build' or 'out')
COPY --from=builder /app/dist ./dist

# Use a non-root user for security (provided by the node image)
USER node

# Command to run your app
# Adjust the path to your entry point (e.g., ./dist/index.js)
CMD ["node", "dist/index.js"]
