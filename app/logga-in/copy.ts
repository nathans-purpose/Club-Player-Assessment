import { t } from "@/lib/i18n";
import type { LoginCopy } from "./login-form";

export function loginCopy(): LoginCopy {
  return {
    google: t("login.google", "Fortsätt med Google"),
    or: t("login.or", "eller"),
    emailLabel: t("login.email.label", "E-postadress"),
    emailPlaceholder: t("login.email.placeholder", "namn@exempel.se"),
    sendLink: t("login.email.submit", "Skicka inloggningslänk"),
    sending: t("login.email.sending", "Skickar …"),
    sentTitle: t("login.sent.title", "Kolla din e-post"),
    sentBody: t("login.sent.body", "Vi har skickat en inloggningslänk till {email}. Öppna den på den här enheten."),
  };
}
