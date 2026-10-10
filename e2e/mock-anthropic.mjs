// A stand-in for the Claude API in end-to-end tests, so the player import
// runs for real (upload, Storage, server action, deletion) without an API key.
// Start the app with ANTHROPIC_BASE_URL=http://127.0.0.1:4010 and any
// ANTHROPIC_API_KEY. It reads `<document>` text with one `nr;name;group` per
// line; a name ending in "?" is returned as uncertain. Brand documents (step 7)
// get a fixed identity with one logo in the middle of the first image.
import http from "node:http";

const port = Number(process.env.MOCK_ANTHROPIC_PORT ?? 4010);
let last = null;

function players(text) {
  return text
    .split("\n")
    .map((line) => line.split(";").map((s) => s.trim()))
    .filter(([nr, name]) => name && /^\d*$/.test(nr ?? ""))
    .map(([nr, name, group]) => ({
      shirt_number: nr || null,
      full_name: name.replace(/\?$/, ""),
      squad_group: null,
      source_position_text: group || null,
      source_text: [nr, name, group].filter(Boolean).join(";"),
      uncertain_fields: name.endsWith("?") ? ["full_name"] : [],
    }));
}

const BRAND = {
  colors: [
    { hex: "#509BF5", role: "primary", name: "Klubbblå" },
    { hex: "#0B1F3A", role: "secondary", name: null },
  ],
  fonts: [
    { name: "Druk Wide", usage: "heading", style: "extended" },
    { name: "Inter", usage: "body", style: "sans" },
  ],
  tone_words: ["Stolt", "Modig"],
  logos: [{ image: 1, left: 0.3, top: 0.25, width: 0.4, height: 0.5, description: "Klubbmärke" }],
};

function reply(res, model, answer) {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(
    JSON.stringify({
      id: "msg_e2e",
      type: "message",
      role: "assistant",
      model,
      content: [{ type: "text", text: JSON.stringify(answer) }],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
    }),
  );
}

http
  .createServer((req, res) => {
    if (req.method === "GET" && req.url === "/last") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify(last));
    }
    if (req.method === "GET" && req.url === "/health") return res.end("ok");
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const body = JSON.parse(raw || "{}");
      if (String(body.system ?? "").includes("visual identity")) {
        const content = body.messages?.[0]?.content ?? [];
        last = { system: body.system, model: body.model, images: content.filter((b) => b.type === "image").length };
        return reply(res, body.model, BRAND);
      }
      const block = body.messages?.[0]?.content?.[0] ?? {};
      const text = block.type === "text" ? block.text.replace(/<\/?document>/g, "") : "";
      last = { system: body.system, model: body.model, blockType: block.type };
      reply(res, body.model, { players: players(text) });
    });
  })
  .listen(port, "127.0.0.1", () => console.log(`Mock Claude API on http://127.0.0.1:${port}`));
