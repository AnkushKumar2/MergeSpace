FROM node:20-alpine AS frontend-builder

WORKDIR /app
ARG VITE_INSFORGE_BASE_URL
ARG VITE_INSFORGE_ANON_KEY
ARG NEXT_PUBLIC_INSFORGE_URL
ARG NEXT_PUBLIC_INSFORGE_ANON_KEY
ENV VITE_INSFORGE_BASE_URL=$VITE_INSFORGE_BASE_URL
ENV VITE_INSFORGE_ANON_KEY=$VITE_INSFORGE_ANON_KEY
ENV NEXT_PUBLIC_INSFORGE_URL=$NEXT_PUBLIC_INSFORGE_URL
ENV NEXT_PUBLIC_INSFORGE_ANON_KEY=$NEXT_PUBLIC_INSFORGE_ANON_KEY
COPY ./Frontend/vite-project/package*.json ./
RUN npm ci
COPY ./Frontend/vite-project .
# This project was initially configured with Next.js-style public variables.
# Vite only exposes VITE_* variables to browser code, so map either supported
# input style to Vite variables at build time.
RUN VITE_INSFORGE_BASE_URL="${VITE_INSFORGE_BASE_URL:-$NEXT_PUBLIC_INSFORGE_URL}" VITE_INSFORGE_ANON_KEY="${VITE_INSFORGE_ANON_KEY:-$NEXT_PUBLIC_INSFORGE_ANON_KEY}" npm run build


FROM node:20-alpine

WORKDIR /app
COPY ./backend .
RUN npm ci --omit=dev

COPY --from=frontend-builder /app/dist ./public
COPY ./migrations ./migrations

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node","server.js"]
