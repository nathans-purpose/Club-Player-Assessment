export default function SettingsLayout({ children }: LayoutProps<"/klubb/[clubId]/installningar">) {
  return <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">{children}</main>;
}
