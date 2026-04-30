# Build stage for frontend
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
# Only install production dependencies
RUN npm install --only=production

# Copy backend files
COPY server.js ./
COPY ultimate_prompt.txt ./

# Copy built frontend from previous stage
COPY --from=build /app/dist ./dist

# Expose port (Cloud Run sets this to 8080 by default, but our Express app uses PORT env var)
ENV PORT=8080
EXPOSE 8080

# Run the server
CMD ["node", "server.js"]
