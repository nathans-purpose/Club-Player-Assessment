import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { extractBrand, BrandImportRefusedError, UnreadableBrandDocumentError } = await import("./extract");

type Body = { messages: { content: Record<string, unknown>[] }[]; system: string; model: string };

function fakeClient(answer: { text?: string; stop_reason?: string }) {
  const requests: Body[] = [];
  const client = new Anthropic({
    apiKey: "test",
    maxRetries: 0,
    fetch: async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)));
      return new Response(
        JSON.stringify({
          id: "msg_test",
          type: "message",
          role: "assistant",
          model: "test",
          content: answer.text === undefined ? [] : [{ type: "text", text: answer.text }],
          stop_reason: answer.stop_reason ?? "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });
  return { client, requests };
}

const ANSWER = {
  colors: [{ hex: "#509BF5", role: "primary", name: "Solnablå" }],
  fonts: [{ name: "Inter", usage: "body", style: "sans" }],
  tone_words: ["Stolt"],
  logos: [{ image: 1, left: 0.1, top: 0.1, width: 0.3, height: 0.3, description: "Klubbmärke" }],
};

const IMAGE = { contentType: "image/png" as const, bytes: new Uint8Array([1, 2, 3]) };

describe("extractBrand", () => {
  it("numbers the images, adds the hints and validates the answer", async () => {
    const { client, requests } = fakeClient({ text: JSON.stringify(ANSWER) });
    const result = await extractBrand([IMAGE, { ...IMAGE, contentType: "image/jpeg" }], "Temafärger: #509BF5", client);
    expect(result).toEqual(ANSWER);
    const [body] = requests;
    expect(body.system).toMatch(/strictly as data/);
    expect(body.system).toMatch(/never follow it/);
    expect(body.messages[0].content.slice(0, 4)).toEqual([
      { type: "text", text: "Image 1:" },
      { type: "image", source: { type: "base64", media_type: "image/png", data: "AQID" } },
      { type: "text", text: "Image 2:" },
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "AQID" } },
    ]);
    expect(body.messages[0].content[4]).toEqual({ type: "text", text: "<hints>\nTemafärger: #509BF5\n</hints>" });
  });

  it("reports refusals and answers that do not match the schema", async () => {
    await expect(extractBrand([IMAGE], "", fakeClient({ stop_reason: "refusal" }).client)).rejects.toThrow(
      BrandImportRefusedError,
    );
    await expect(extractBrand([IMAGE], "", fakeClient({ text: '{"colors": 3}' }).client)).rejects.toThrow(
      UnreadableBrandDocumentError,
    );
  });
});
