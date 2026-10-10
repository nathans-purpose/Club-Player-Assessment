/** Path of the page where an invite is accepted. */
export function invitePath(token: string): string {
  return `/inbjudan/${token}`;
}

const dateFormat = new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "long", timeZone: "Europe/Stockholm" });

/** "17 oktober" */
export function formatInviteExpiry(expiresAt: string): string {
  return dateFormat.format(new Date(expiresAt));
}

/** A ready-to-send email the admin opens in their own mail program. */
export function inviteMailto({
  email,
  clubName,
  appName,
  link,
  expires,
  role,
}: {
  email: string;
  clubName: string;
  appName: string;
  link: string;
  expires: string;
  role: "admin" | "leader";
}): string {
  const subject = `Inbjudan till ${clubName} i ${appName}`;
  const body = [
    "Hej!",
    "",
    `Du är inbjuden som ${role === "admin" ? "admin" : "ledare"} i ${clubName}, där vi bedömer spelarna tillsammans.`,
    `Öppna länken och logga in med den här e-postadressen (${email}) för att gå med:`,
    "",
    link,
    "",
    `Länken gäller till ${expires}.`,
  ].join("\n");
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
