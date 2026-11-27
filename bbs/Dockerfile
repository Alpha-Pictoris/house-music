FROM python:3.14-slim@sha256:22eafb370920ad8b429e0aec3fff433e0669968519f5d60469d83729c138b28b AS build
COPY --from=ghcr.io/astral-sh/uv:0.13.9@sha256:d3b601f0c7b118bc1753febf7c41cc80981df678445e0254284eecf84db79a7d /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PYTHON_DOWNLOADS=0
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project
COPY README.md ./
COPY src ./src
RUN uv sync --locked --no-dev --no-editable

FROM python:3.14-slim@sha256:22eafb370920ad8b429e0aec3fff433e0669968519f5d60469d83729c138b28b
RUN useradd --system --uid 10001 --home-dir /data --no-create-home bbs \
    && install -d -o bbs -g bbs /data /data/state
COPY --from=build /app/.venv /app/.venv
COPY world /app/world
ENV PATH=/app/.venv/bin:$PATH PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
USER bbs
WORKDIR /data
VOLUME /data
EXPOSE 2222
# ssharg shuts down cleanly on Ctrl-C; SIGTERM would wait out the stop timeout.
STOPSIGNAL SIGINT
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD \
    python -c "import socket; s = socket.create_connection(('127.0.0.1', 2222), 3); assert s.recv(8) == b'SSH-2.0-'"
ENTRYPOINT ["ssharg"]
CMD ["--bind", "0.0.0.0", "--port", "2222", "--world", "/app/world", \
     "--state-dir", "/data/state", "--host-key", "/data/host_key", "--user-ca", "/ca/user_ca.pub"]
