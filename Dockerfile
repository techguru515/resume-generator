# Build from repository root so `extension-cv-builder` exists for GET /api/extension/cv-builder-zip.
# Railway: set Dockerfile path to this file and root directory to the repo root (not server/).
FROM node:22-bookworm-slim

WORKDIR /app

COPY extension-cv-builder ./extension-cv-builder
COPY server ./server

WORKDIR /app/server
RUN npm ci --omit=dev

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "index.js"]
