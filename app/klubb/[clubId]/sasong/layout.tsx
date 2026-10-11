export default function SeasonLayout({ children }: LayoutProps<"/klubb/[clubId]/sasong">) {
  return <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">{children}</main>;
}
