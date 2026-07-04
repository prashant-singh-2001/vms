FROM golang:1.24-bookworm AS build

WORKDIR /src
COPY . .
RUN go mod tidy
RUN CGO_ENABLED=0 go build -o /out/worker ./cmd/worker

FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /out/worker /usr/local/bin/worker

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/worker"]
