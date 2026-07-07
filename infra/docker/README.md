# Docker (Phase 5)

Container builds for the AIDE apps. Placeholder Dockerfiles — finalized during the ship phase.

- `api.Dockerfile` — Express backend (`apps/api`)
- `web.Dockerfile` — Next.js frontend (`apps/web`)

Build from the repository root so workspace packages resolve:

```bash
docker build -f infra/docker/api.Dockerfile -t aide-api .
docker build -f infra/docker/web.Dockerfile -t aide-web .
```
