import { APP_NAME, APP_TAGLINE, APP_VERSION } from "@/config/app";

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row">
        <p>
          {APP_NAME} — {APP_TAGLINE}
        </p>
        <p>v{APP_VERSION}</p>
      </div>
    </footer>
  );
}
