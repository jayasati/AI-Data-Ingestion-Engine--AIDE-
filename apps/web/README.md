# @aide/web

Next.js frontend for AIDE. Foundation stage: pages, UI kit, theming, and API plumbing — no import functionality yet.

## Folder map

```text
src/
  app/           Routes (App Router): / , /import , /settings , /health + global layout & styles
  components/
    ui/          Reusable kit: Button, Card, Modal, Table, Spinner, Skeleton, Toast
    layout/      Navbar (with theme toggle), Footer
    error-boundary.tsx
  features/      Feature-scoped components
    import/      Stepper, UploadArea (visual only), preview/progress/result placeholders
    settings/    Reserved AI configuration form
    health/      Client widget that calls the API /health endpoint
  providers/     ThemeProvider (light/dark/system), ToastProvider
  hooks/         useTheme, useToast re-exports
  services/      api-client.ts — typed fetch wrapper over the ApiResponse envelope
  config/        env.ts (NEXT_PUBLIC_API_URL), app.ts (name/version constants)
  lib/           cn class-name utility
  types/         UI-local types
```

## Scripts

- `npm run dev -w @aide/web` — dev server on http://localhost:3000
- `npm run build -w @aide/web` — production build (requires `@aide/shared-types` built first)
- `npm run start -w @aide/web` — serve the production build

## Environment

Copy `.env.example` to `.env.local` and adjust `NEXT_PUBLIC_API_URL` if the API is not on `http://localhost:4000`.
