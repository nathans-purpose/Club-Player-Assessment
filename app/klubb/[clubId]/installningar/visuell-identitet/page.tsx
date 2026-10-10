import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireClubAdmin } from "@/lib/assessment/data";
import { APP_NAME } from "@/lib/config";
import { loadIdentity } from "@/lib/identity/data";
import { BRAND_DOCUMENT_MAX_BYTES } from "@/lib/identity/files";
import { t } from "@/lib/i18n";
import { IdentityEditor } from "./identity-editor";

export const metadata: Metadata = { title: `Visuell identitet – ${APP_NAME}` };

// Visuell identitet (admins only): the club's colours, logos, fonts and tone
// words, read from a brand document or entered by hand (spec §7.2).
export default function IdentityPage({ params }: PageProps<"/klubb/[clubId]/installningar/visuell-identitet">) {
  return (
    <Suspense fallback={<p className="text-muted">{t("common.loading", "Laddar …")}</p>}>
      <Identity params={params} />
    </Suspense>
  );
}

async function Identity({ params }: Pick<PageProps<"/klubb/[clubId]/installningar/visuell-identitet">, "params">) {
  const { clubId } = await params;
  const { supabase, club, team } = await requireClubAdmin(clubId);
  const stored = await loadIdentity(supabase, clubId);
  return (
    <>
      <div>
        <Link href={`/klubb/${clubId}/installningar`} className="inline-flex min-h-11 items-center text-sm underline">
          {t("settings.back", "← Inställningar")}
        </Link>
        <p className="text-sm text-muted">{[club.name, team?.name].filter(Boolean).join(" · ")}</p>
        <h1 className="mt-1 text-2xl font-bold">{t("settings.identity", "Visuell identitet")}</h1>
        <p className="mt-2 max-w-prose text-muted">
          {t(
            "settings.identity.intro",
            "Klubbens färger, loggor och typsnitt används på alla klubbens sidor. Läs in dem från klubbens grafiska profil eller fyll i dem själv. Färgskalan för betyg ändras aldrig, så att alla klubbar läser den likadant.",
          )}
        </p>
      </div>
      <IdentityEditor
        clubId={clubId}
        clubName={club.name}
        initial={stored?.identity ?? null}
        applied={stored?.applied ?? false}
        copy={identityCopy()}
      />
    </>
  );
}

function identityCopy() {
  return {
    importTitle: t("identity.import.title", "Läs in från klubbens grafiska profil"),
    importHint: t(
      "identity.import.hint",
      "PDF, PowerPoint, Keynote eller en bild, högst {mb} MB. Vi läser färger, loggor, typsnitt och tonläge. Inget används förrän du sparar.",
    ).replace("{mb}", String(BRAND_DOCUMENT_MAX_BYTES / 1024 / 1024)),
    importChoose: t("identity.import.choose", "Välj dokument"),
    importReading: t("identity.import.reading", "Läser {file} …"),
    importDone: t("identity.import.done", "Förslaget från {file} är ifyllt nedan. Kontrollera det och spara."),
    importWrongType: t("identity.import.wrongType", "Den filtypen kan vi inte läsa. Välj en PDF, PowerPoint (.pptx), Keynote eller bild."),
    importTooBig: t("identity.import.tooBig", "Filen är för stor."),
    importUnreadable: t("identity.import.unreadable", "Dokumentet gick inte att läsa. Prova en PDF eller en tydligare bild."),
    importUploadFailed: t("identity.import.uploadFailed", "Det gick inte att ladda upp dokumentet. Försök igen."),
    colors: t("identity.colors", "Färger"),
    colorsHint: t("identity.colorsHint", "Huvudfärgen används på knappar, länkar och markeringar. Komplementfärgen syns i bandet överst på sidorna."),
    colorList: t("identity.colorList", "Klubbens färger"),
    colorPicker: t("identity.colorPicker", "Välj färg {n}"),
    colorHex: t("identity.colorHex", "Hex-kod"),
    colorHexInvalid: t("identity.colorHexInvalid", "Skriv en hex-kod, till exempel #509BF5."),
    colorName: t("identity.colorName", "Namn (valfritt)"),
    colorRole: t("identity.colorRole", "Används som"),
    rolePrimary: t("identity.role.primary", "Huvudfärg"),
    roleSecondary: t("identity.role.secondary", "Komplementfärg"),
    roleOther: t("identity.role.other", "Övrig färg"),
    removeColor: t("identity.removeColor", "Ta bort färg {n}"),
    addColor: t("identity.addColor", "+ Lägg till färg"),
    noPrimary: t("identity.noPrimary", "Välj en huvudfärg, annars används appens standardfärg."),
    contrastTitle: t("identity.contrast.title", "Kontroll av läsbarhet"),
    contrastOk: t("identity.contrast.ok", "Huvudfärgen {color} har kontrasten {ratio} mot vitt och går att läsa som text."),
    contrastLow: t(
      "identity.contrast.low",
      "Huvudfärgen {color} har bara kontrasten {ratio} mot vitt. Text behöver minst 4,5:1, så vi använder den mörkare {ink} ({inkRatio}) för text och länkar.",
    ),
    contrastButtonDark: t("identity.contrast.buttonDark", "Knappar i huvudfärgen får mörk text."),
    contrastButtonLight: t("identity.contrast.buttonLight", "Knappar i huvudfärgen får vit text."),
    logos: t("identity.logos", "Loggor"),
    logosHint: t("identity.logosHint", "Den första loggan visas överst på klubbens sidor. Loggor sparas som PNG med genomskinlig bakgrund."),
    logoList: t("identity.logoList", "Klubbens loggor"),
    logoAlt: t("identity.logoAlt", "Logga {n}"),
    mainLogo: t("identity.mainLogo", "Huvudlogga"),
    makeMain: t("identity.makeMain", "Gör till huvudlogga"),
    makeMainLabel: t("identity.makeMainLabel", "Gör logga {n} till huvudlogga"),
    removeLogo: t("identity.removeLogo", "Ta bort logga {n}"),
    addLogo: t("identity.addLogo", "+ Ladda upp logga"),
    addLogoHint: t("identity.addLogoHint", "PNG, JPG eller WebP."),
    logoFailed: t("identity.logoFailed", "Bilden gick inte att använda som logga. Prova en annan bild."),
    noLogos: t("identity.noLogos", "Inga loggor ännu. Klubbmärket från Kom igång visas tills du lägger till en."),
    fonts: t("identity.fonts", "Typsnitt"),
    fontsHint: t(
      "identity.fontsHint",
      "Licensierade typsnitt följer inte med appen. Ladda upp typsnittsfilen (woff2 eller otf) om klubben har licens för webben. Tills dess visar vi ett liknande typsnitt.",
    ),
    fontHeading: t("identity.font.heading", "Rubriker"),
    fontBody: t("identity.font.body", "Brödtext"),
    fontName: t("identity.font.name", "Typsnittets namn"),
    fontNameInvalid: t("identity.font.nameInvalid", "Namnet får bara innehålla bokstäver, siffror, mellanslag och - . , & '"),
    fontStyle: t("identity.font.style", "Utseende"),
    styleSans: t("identity.style.sans", "Rak (utan klackar)"),
    styleSerif: t("identity.style.serif", "Med klackar"),
    styleCondensed: t("identity.style.condensed", "Smal"),
    styleExtended: t("identity.style.extended", "Bred"),
    fontAdd: t("identity.font.add", "+ Lägg till typsnitt för {slot}"),
    fontRemove: t("identity.font.remove", "Ta bort typsnittet för {slot}"),
    fontUpload: t("identity.font.upload", "Ladda upp typsnittsfil för {slot}"),
    fontReplace: t("identity.font.replace", "Byt typsnittsfil för {slot}"),
    fontRemoveFile: t("identity.font.removeFile", "Ta bort typsnittsfilen för {slot}"),
    fontUploaded: t("identity.font.uploaded", "Typsnittsfilen är uppladdad."),
    fontPending: t("identity.font.pending", "{file} laddas upp när du sparar."),
    fontFallback: t("identity.font.fallback", "Typsnittsfilen saknas. Tills du laddar upp den visar vi {fallback}."),
    fontWrongType: t("identity.font.wrongType", "Välj en typsnittsfil i formatet woff2, woff, otf eller ttf."),
    fontTooBig: t("identity.font.tooBig", "Typsnittsfilen får vara högst 5 MB."),
    tone: t("identity.tone", "Tonläge"),
    toneLabel: t("identity.toneLabel", "Ord som beskriver klubbens ton"),
    toneHint: t("identity.toneHint", "Skilj orden åt med kommatecken, till exempel: Stolt, Inkluderande, Modig."),
    preview: t("identity.preview", "Förhandsvisning"),
    previewClub: t("identity.preview.club", "Klubbens tema"),
    previewDefault: t("identity.preview.default", "Standardtema"),
    previewToggle: t("identity.preview.toggle", "Visa förhandsvisningen med"),
    previewHeading: t("identity.preview.heading", "Översikt"),
    previewBody: t("identity.preview.body", "Så här ser text, länkar och knappar ut på klubbens sidor."),
    previewLink: t("identity.preview.link", "Så räknas det"),
    previewButton: t("identity.preview.button", "Nästa spelare →"),
    previewCaption: t("identity.preview.caption", "Färgskalan för betyg är densamma i alla teman."),
    removed: t("identity.removed", "{name} är borttagen."),
    undo: t("common.undo", "Ångra"),
    undoImport: t("identity.undoImport", "Ångra förslaget"),
    unsaved: t("common.unsaved", "Osparade ändringar"),
    save: t("identity.save", "Spara och använd för hela klubben"),
    saving: t("common.saving", "Sparar …"),
    saved: t("identity.saved", "Sparat. Klubbens tema används nu på alla klubbens sidor."),
    saveFailed: t("identity.saveFailed", "Det gick inte att spara. Försök igen."),
    fixErrors: t("identity.fixErrors", "Rätta de markerade fälten först."),
    notApplied: t("identity.notApplied", "Klubbens tema används inte just nu. Spara för att använda det igen."),
    stop: t("identity.stop", "Sluta använda klubbens tema"),
    stopConfirm: t(
      "identity.stopConfirm",
      "Alla klubbens sidor får appens standardutseende igen. Det du har sparat finns kvar och kan användas igen. Vill du det?",
    ),
    stopYes: t("identity.stopYes", "Ja, använd standardtemat"),
    cancel: t("common.cancel", "Avbryt"),
    stopped: t("identity.stopped", "Klubbens sidor använder standardtemat igen."),
  };
}

export type IdentityCopy = ReturnType<typeof identityCopy>;
