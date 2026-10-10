import { t } from "@/lib/i18n";

const STEPS = [
  { key: "onboarding.step.account", label: "Konto" },
  { key: "onboarding.step.club", label: "Klubb" },
  { key: "onboarding.step.players", label: "Spelare" },
  { key: "onboarding.step.leaders", label: "Ledare" },
];

/** "Kom igång 1–4" progress. `current` is 1-based. */
export function Stepper({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <nav aria-label={t("onboarding.stepper.label", "Kom igång")}>
      <p className="text-sm font-medium text-muted">
        {t("onboarding.stepper.progress", "Kom igång · steg {current} av {total}")
          .replace("{current}", String(current))
          .replace("{total}", String(STEPS.length))}
      </p>
      <ol className="mt-2 grid grid-cols-4 gap-2">
        {STEPS.map((step, i) => {
          const n = i + 1;
          const state = n < current ? "done" : n === current ? "current" : "todo";
          return (
            <li key={step.key} aria-current={state === "current" ? "step" : undefined} className="flex flex-col gap-1">
              <span
                aria-hidden="true"
                className={`h-1.5 rounded-full ${state === "todo" ? "bg-border" : "bg-primary"}`}
              />
              <span className={`text-xs sm:text-sm ${state === "current" ? "font-semibold" : "text-muted"}`}>
                {n}. {t(step.key, step.label)}
                {state === "done" && <span className="sr-only"> ({t("onboarding.stepper.done", "klart")})</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
