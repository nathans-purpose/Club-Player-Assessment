import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { readKeynote, readPptx, slideText, themeColors, themeFonts, UnreadablePresentationError } from "./presentation";

const THEME = `<a:theme><a:themeElements><a:clrScheme name="Klubb">
<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
<a:dk2><a:srgbClr val="0B1F3A"/></a:dk2>
<a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>
<a:accent1><a:srgbClr val="509bf5"/></a:accent1>
<a:accent2><a:srgbClr val="F5C524"/></a:accent2>
<a:accent3><a:srgbClr val="509BF5"/></a:accent3>
</a:clrScheme><a:fontScheme name="Klubb">
<a:majorFont><a:latin typeface="Druk Wide &amp; Co"/></a:majorFont>
<a:minorFont><a:latin typeface="+mn-lt"/></a:minorFont>
</a:fontScheme></a:themeElements></a:theme>`;

const SLIDE = (text: string) =>
  `<p:sld><p:txBody><a:p><a:r><a:t>${text}</a:t></a:r><a:r><a:t> grafisk profil</a:t></a:r></a:p><a:p><a:r><a:t>Stolt &amp; modig</a:t></a:r></a:p></p:txBody></p:sld>`;

const PNG = new Uint8Array([137, 80, 78, 71, 1]);
const JPG = new Uint8Array([255, 216, 255, 1]);

describe("theme parsing", () => {
  it("reads theme colours without duplicates, skipping plain black and white", () => {
    expect(themeColors(THEME)).toEqual([
      { hex: "#509BF5", slot: "accent1" },
      { hex: "#F5C524", slot: "accent2" },
      { hex: "#0B1F3A", slot: "dk2" },
      { hex: "#E7E6E6", slot: "lt2" },
    ]);
  });
  it("reads the heading font and skips references to other fonts", () => {
    expect(themeFonts(THEME)).toEqual([{ name: "Druk Wide & Co", usage: "heading" }]);
  });
  it("reads slide text a line per paragraph", () => {
    expect(slideText(SLIDE("Solna FC"))).toBe("Solna FC grafisk profil\nStolt & modig");
  });
});

describe("readPptx", () => {
  it("reads slides in order, the theme and the pictures with PNGs first", () => {
    const zip = zipSync({
      "ppt/slides/slide10.xml": strToU8(SLIDE("Tio")),
      "ppt/slides/slide2.xml": strToU8(SLIDE("Två")),
      "ppt/theme/theme1.xml": strToU8(THEME),
      "ppt/media/image1.jpeg": JPG,
      "ppt/media/image2.png": PNG,
      "ppt/media/image3.emf": PNG,
    });
    const p = readPptx(zip, 8);
    expect(p.text.indexOf("Två")).toBeLessThan(p.text.indexOf("Tio"));
    expect(p.colors[0].hex).toBe("#509BF5");
    expect(p.images.map((i) => [i.name, i.contentType])).toEqual([
      ["ppt/media/image2.png", "image/png"],
      ["ppt/media/image1.jpeg", "image/jpeg"],
    ]);
  });
  it("refuses files that are not presentations", () => {
    expect(() => readPptx(new Uint8Array([1, 2, 3]), 8)).toThrow(UnreadablePresentationError);
    expect(() => readPptx(zipSync({ "word/document.xml": strToU8("<w:document/>") }), 8)).toThrow(
      UnreadablePresentationError,
    );
  });
});

describe("readKeynote", () => {
  it("takes the preview first, then pictures without Keynote's small copies", () => {
    const zip = zipSync({
      "preview.jpg": JPG,
      "Data/logo-123.png": PNG,
      "Data/logo-small-123.png": PNG,
      "Index/Document.iwa": new Uint8Array([0]),
    });
    expect(readKeynote(zip, 8).images.map((i) => i.name)).toEqual(["preview.jpg", "Data/logo-123.png"]);
  });
});
