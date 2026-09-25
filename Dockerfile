# Dashboard: build the React app, serve it with nginx.

# -- Build stage --
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts vitest.config.ts index.html ./
COPY src/ ./src/
COPY shared/ ./shared/
COPY server/ ./server/
COPY scripts/ ./scripts/
COPY public/ ./public/

RUN npm run build

# -- Runtime stage --
FROM nginx:1.27-alpine AS production
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
