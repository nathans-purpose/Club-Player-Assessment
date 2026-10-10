export default function PlayersLayout({ children }: LayoutProps<"/klubb/[clubId]/spelare">) {
  return <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">{children}</main>;
}
