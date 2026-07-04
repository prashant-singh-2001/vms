FROM alpine:3.20

RUN apk add --no-cache ffmpeg curl ca-certificates

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

VOLUME ["/assets"]

ENTRYPOINT ["/entrypoint.sh"]
