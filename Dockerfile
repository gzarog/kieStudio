# Local execution image for KIE Studio.
# Builds the Vite SPA and serves it together with the Pages Functions via
# `wrangler pages dev` (workerd) — the same edge runtime used in production.
FROM node:20-slim

# Wrangler quality-of-life in a container: no metrics prompt, no update nag.
ENV WRANGLER_SEND_METRICS=false \
    NO_UPDATE_NOTIFIER=1 \
    CI=true

WORKDIR /app

# workerd (the runtime behind `wrangler pages dev`) verifies the TLS certificate
# of every outbound fetch — including the API calls this app forwards to
# https://api.kie.ai. The node:*-slim base image ships without a CA bundle, so
# without this those fetches fail with "unable to get local issuer certificate"
# and every /api/* route (e.g. /api/validate) returns 500. Install the trust
# store to fix it.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies first so this layer is cached across source changes.
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source and build the static assets into dist/.
COPY . .
RUN npm run build

EXPOSE 8788

# Bind to 0.0.0.0 so the port is reachable from the host. `wrangler pages dev`
# serves dist/ as static assets and the sibling functions/ directory as the API.
# BYOK: no server-side secrets — users paste their kie.ai key in the browser.
CMD ["npx", "wrangler", "pages", "dev", "dist", "--ip", "0.0.0.0", "--port", "8788"]
