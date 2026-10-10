import Link from "next/link";
import { APP_NAME } from "@/lib/config";
import { t } from "@/lib/i18n";
import { signOut } from "../../logga-in/actions";

export default function ClubLayout({ children }: LayoutProps<"/klubb/[clubId]">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="font-semibold">
            {APP_NAME}
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="min-h-11 rounded-lg px-3 text-sm font-medium hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-primary"
            >
              {t("nav.signOut", "Logga ut")}
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">{children}</main>
    </div>
  );
}
