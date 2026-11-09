FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build vaqtida API URL va Telegram bot username'ni qabul qiladi
# /crm-api — Next.js o'zi ichki backend'ga uzatadi (next.config.ts rewrites)
ARG NEXT_PUBLIC_API_URL=/crm-api
ARG BACKEND_INTERNAL_URL=http://backend:8000
ARG NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV BACKEND_INTERNAL_URL=$BACKEND_INTERNAL_URL
ENV NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=$NEXT_PUBLIC_TELEGRAM_BOT_USERNAME

RUN npm run build

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["npm", "start"]
