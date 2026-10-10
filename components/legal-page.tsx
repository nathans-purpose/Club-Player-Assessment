import Link from "next/link";
import type { ReactNode } from "react";
import { t } from "@/lib/i18n";

/** Layout for the privacy and terms pages, with the "to be reviewed" notice on top. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <Link href="/" className="inline-flex min-h-11 items-center self-start text-sm font-medium underline">
        {t("legal.home", "Till startsidan")}
      </Link>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p role="note" className="rounded-lg border border-scale-mid bg-scale-mid/15 p-4 text-sm">
        {t(
          "legal.draft",
          "Utkast: den här texten är en mall. Klubben är personuppgiftsansvarig och behöver låta någon med kunskap om dataskydd granska och anpassa den innan appen används på riktigt.",
        )}
      </p>
      <div className="flex max-w-prose flex-col gap-6">{children}</div>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
