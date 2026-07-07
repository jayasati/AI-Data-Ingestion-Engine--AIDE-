import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button";

/**
 * Reserved AI configuration surface. Every control is disabled until the AI
 * extraction engine lands; the layout exists now so navigation, copy, and
 * information architecture are settled early.
 */
export function AiConfigForm() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <CardTitle>AI configuration</CardTitle>
          <span className="rounded-full bg-accent-50 px-2.5 py-0.5 text-xs font-medium text-accent-700 dark:bg-accent-950 dark:text-accent-300">
            Coming soon
          </span>
        </div>
        <CardDescription>
          Provider, model, and extraction behavior will be configurable once the AI engine ships.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form>
          <fieldset disabled className="grid gap-5 opacity-60 sm:max-w-md">
            <div className="grid gap-1.5">
              <label htmlFor="ai-provider" className="text-sm font-medium">
                Provider
              </label>
              <select
                id="ai-provider"
                defaultValue="openai"
                className="h-10 rounded-lg border border-border bg-surface px-3 text-sm"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="google">Google</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="ai-model" className="text-sm font-medium">
                Model
              </label>
              <input
                id="ai-model"
                type="text"
                placeholder="e.g. gpt-4o-mini"
                className="h-10 rounded-lg border border-border bg-surface px-3 text-sm"
              />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="ai-temperature" className="text-sm font-medium">
                Temperature
              </label>
              <input
                id="ai-temperature"
                type="number"
                min={0}
                max={2}
                step={0.1}
                defaultValue={0}
                className="h-10 rounded-lg border border-border bg-surface px-3 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Extraction runs at 0 for deterministic output.
              </p>
            </div>
            <button type="submit" className={buttonStyles({ className: "w-fit" })}>
              Save changes
            </button>
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}
