import Link from "next/link";
import { APP_NAME } from "@/lib/config";

export default function OnboardingLayout({ children }: LayoutProps<"/kom-igang">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center px-4 py-3">
          <Link href="/" className="inline-flex min-h-11 items-center font-semibold">
            {APP_NAME}
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">{children}</main>
    </div>
  );
}
