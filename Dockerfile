FROM node:24-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

FROM golang:1.26-alpine AS backend-builder

WORKDIR /app/backend

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./
RUN go build -o /app/api ./cmd/api

FROM alpine:3.20

WORKDIR /app

RUN apk add --no-cache ca-certificates

COPY --from=backend-builder /app/api /app/api
COPY --from=backend-builder /app/backend/migrations /app/migrations
COPY --from=frontend-builder /app/frontend/dist /app/public

EXPOSE 8080

CMD ["/app/api"]
