# Image de preprod pour l'app web Tiroir (Next.js 14, Node 22)
# Le code source de web/ est copié dans ./app par deploy.sh avant le build.
# Build effectué sur le NAS (x86_64) via `docker compose build`.

# --- Étape 1 : dépendances ---
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY app/package.json app/package-lock.json* ./
# --legacy-peer-deps : imposé par vercel.json (résolution des peers React/RN-web)
RUN npm install --no-audit --no-fund --legacy-peer-deps

# --- Étape 2 : build ---
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY app/ ./
# Les NEXT_PUBLIC_* doivent être présents au build (inlinés dans le bundle client).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NODE_ENV=production
RUN npm run build

# --- Étape 3 : runtime ---
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8151
# Copie du strict nécessaire pour `next start`
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js
EXPOSE 8151
CMD ["npx", "next", "start", "-p", "8151"]
