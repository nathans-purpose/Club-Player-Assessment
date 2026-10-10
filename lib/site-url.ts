import "server-only";
import { headers } from "next/headers";

/** The public origin used in links we hand out (sign-in callbacks, invites). */
export async function siteOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
  const h = await headers();
  return h.get("origin") ?? `https://${h.get("host")}`;
}
