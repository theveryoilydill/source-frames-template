# Self-hosting Source Frames outside Cloudflare.
#
# The build output is a Cloudflare Worker (workerd), not a Node HTTP server,
# so the runtime stage serves the built worker with `wrangler dev` (workerd
# under the hood — the same runtime Cloudflare itself uses).
#
# pnpm is used end-to-end: `npm ci` cannot work here because the repo has
# no package-lock.json. Debian-based images are required because workerd
# has no musl/Alpine builds. Node >= 22.22 per "engines" in package.json;
# node:24 satisfies it.

FROM node:24-bookworm-slim AS deps
RUN npm install -g pnpm@12.4.0
ENV CI=true WRANGLER_SEND_METRICS=false
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml wrangler.jsonc ./
# Full install (dev deps included): the build needs vite/wrangler, and the
# postinstall runs `wrangler types` against wrangler.jsonc to generate
# worker-configuration.d.ts.
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm run build

FROM node:24-bookworm-slim AS runtime
RUN npm install -g pnpm@12.4.0
ENV NODE_ENV=production CI=true WRANGLER_SEND_METRICS=false
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/build ./build
COPY --from=build --chown=node:node /app/package.json /app/pnpm-workspace.yaml ./
USER node
EXPOSE 8787
# "start" = wrangler dev -c build/server/wrangler.json (see package.json)
CMD ["pnpm", "start"]
