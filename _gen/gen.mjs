/* Image generation for the E-12 network via fal.ai.
   Usage: node _gen/gen.mjs <slug> "<prompt>" [aspect]
   Key is read from the Aventro .env so it is never committed here. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const envPath = join(homedir(), "Projects", "Personal", "aventro-crm", ".env");
const KEY = (readFileSync(envPath, "utf8").match(/^\s*FAL_KEY\s*=\s*(.+)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, "");
if (!KEY) { console.error("no FAL_KEY found"); process.exit(1); }

const [slug, prompt, aspect = "21:9"] = process.argv.slice(2);
if (!slug || !prompt) { console.error('usage: gen.mjs <slug> "<prompt>" [aspect]'); process.exit(1); }

const MODELS = ["fal-ai/nano-banana-pro/text-to-image", "fal-ai/nano-banana/text-to-image", "fal-ai/flux-pro/v1.1-ultra"];

async function tryModel(model) {
  const body = model.includes("flux")
    ? { prompt, aspect_ratio: aspect, output_format: "jpeg", safety_tolerance: "2" }
    : { prompt, aspect_ratio: aspect, output_format: "jpeg", num_images: 1 };

  const res = await fetch(`https://fal.run/${model}`, {
    method: "POST",
    headers: { Authorization: `Key ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${model} -> ${res.status} ${text.slice(0, 220)}`);
  const json = JSON.parse(text);
  const url = json?.images?.[0]?.url || json?.image?.url;
  if (!url) throw new Error(`${model} -> no image url in ${text.slice(0, 220)}`);
  return url;
}

let url, used;
for (const m of MODELS) {
  try { url = await tryModel(m); used = m; break; }
  catch (e) { console.error("  skip:", e.message); }
}
if (!url) { console.error("all models failed"); process.exit(1); }

mkdirSync("_gen/out", { recursive: true });
const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
const out = `_gen/out/${slug}.jpg`;
writeFileSync(out, buf);
console.log(`OK  ${used}  ->  ${out}  (${Math.round(buf.length / 1024)} KB)`);
