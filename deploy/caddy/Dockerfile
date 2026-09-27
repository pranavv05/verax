# Bakes the Caddyfile into the image so docker-compose.prod.yml needs no bind
# mounts to the host filesystem.
FROM caddy:2.11-alpine
COPY Caddyfile /etc/caddy/Caddyfile
