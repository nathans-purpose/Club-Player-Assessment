import Link from "next/link";
import { t } from "@/lib/i18n";

// Also shown for club pages a user may not open, so ids cannot be probed.
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-12">
      <h1 className="text-2xl font-bold">{t("notFound.title", "Sidan hittades inte")}</h1>
      <p className="text-muted">
        {t("notFound.body", "Sidan finns inte, eller så har du inte behörighet att se den.")}
      </p>
      <Link href="/" className="inline-flex min-h-11 items-center self-start font-semibold underline">
        {t("notFound.home", "Till startsidan")}
      </Link>
    </main>
  );
}
