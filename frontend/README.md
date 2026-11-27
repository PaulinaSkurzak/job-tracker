# Job Tracker frontend

Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui. It talks to the Django REST API in the
parent folder; nginx serves both on `http://localhost:8080`. See `../docs/FRONTEND-PLAN.md` for the design.

## Run

From the repository root:

```bash
docker compose up --build                                            # production build
docker compose -f docker-compose.yml -f docker-compose.dev.yml up    # dev server with live reload
```

Node is not needed on your machine; every command runs in a container. To run one-off commands:

```bash
docker run --rm -u node -e HOME=/tmp -v "$PWD":/work -w /work node:24-alpine npm test
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server, production build, production server |
| `npm run lint` | ESLint (Next.js and React rules) |
| `npm run typecheck` | Generates Next.js route types, then runs the TypeScript compiler |
| `npm test` | Vitest unit and component tests (jsdom) |
| `npm run gen:api` | Regenerates `src/lib/api/schema.d.ts` from `openapi.yml` |

## API types

`openapi.yml` is generated from Django (`python manage.py spectacular --file frontend/openapi.yml`), and
`npm run gen:api` turns it into TypeScript types. CI fails if either file is out of date, so a backend
change that breaks the frontend shows up as a type error, not a runtime bug.

## Layout

```
src/app/(app)/       logged-in pages; layout.tsx is the shell (sidebar, header, auth check)
src/app/login/       login page
src/components/      app components; components/ui/ holds shadcn/ui components (copied in, editable)
src/lib/api/         typed API client and generated schema types
src/lib/             auth hooks, CSRF and redirect helpers, navigation
```
