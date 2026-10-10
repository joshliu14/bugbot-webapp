# Stage 1: build the React app into static files
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: serve the static files (tiny, low-memory, no dev server)
FROM node:18-alpine
WORKDIR /app
RUN npm install -g serve@14.2.4
COPY --from=build /app/build ./build
EXPOSE 3000
CMD ["serve", "-s", "build", "-l", "3000"]
