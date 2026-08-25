/**
 * OmniRoute Vision Integration Test
 * ==================================
 * Optional integration test for the real OmniRoute endpoint.
 *
 * Only runs when KAP_VISION_API_KEY is configured.
 * Uses KAP_VISION_BASE_URL (default: http://localhost:20333/v1).
 *
 * Usage:
 *   npm run test:vision
 *
 * Environment:
 *   KAP_VISION_API_KEY=<secret>     (required)
 *   KAP_VISION_BASE_URL=http://localhost:20333/v1
 *   KAP_VISION_MODEL=gpt-4o
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Load .env file from project root
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

const API_KEY = process.env.KAP_VISION_API_KEY;
const BASE_URL = (process.env.KAP_VISION_BASE_URL || "http://localhost:20333/v1").trim().replace(/\/+$/, "");
const MODEL = process.env.KAP_VISION_MODEL || "gpt-4o";

function log(section, msg) {
  console.log(`[${section}] ${msg}`);
}

async function testConnection() {
  log("CONNECTION", `Testing endpoint: ${BASE_URL}`);
  log("CONNECTION", `Model: ${MODEL}`);
  log("CONNECTION", `API key: ${API_KEY ? "configured" : "NOT configured"}`);

  if (!API_KEY) {
    log("CONNECTION", "SKIPPED — KAP_VISION_API_KEY not set");
    return false;
  }

  try {
    const resp = await fetch(`${BASE_URL}/models`, {
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!resp.ok) {
      const body = await resp.text();
      log("CONNECTION", `FAIL — HTTP ${resp.status}: ${body.substring(0, 200)}`);
      return false;
    }

    const data = await resp.json();
    const models = data.data || [];
    log("CONNECTION", `PASS — ${models.length} model(s) available`);

    const modelMatch = models.find(m => m.id === MODEL);
    if (modelMatch) {
      log("CONNECTION", `Model "${MODEL}" found`);
    } else {
      log("CONNECTION", `WARNING: Model "${MODEL}" not found in endpoint models`);
      log("CONNECTION", `Available: ${models.map(m => m.id).join(", ")}`);
    }

    return true;
  } catch (err) {
    log("CONNECTION", `FAIL — ${err.message}`);
    return false;
  }
}

async function testVision() {
  log("VISION", "Testing vision/image input capability...");

  if (!API_KEY) {
    log("VISION", "SKIPPED — KAP_VISION_API_KEY not set");
    return;
  }

  // Use a minimal 1x1 red PNG as test image
  const testPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

  try {
    const resp = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Describe this image in one word." },
              { type: "image_url", image_url: { url: `data:image/png;base64,${testPng}`, detail: "low" } },
            ],
          },
        ],
        max_tokens: 32,
        temperature: 0,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      log("VISION", `FAIL — HTTP ${resp.status}: ${body.substring(0, 300)}`);
      return;
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content;
    if (content) {
      log("VISION", `PASS — Model responded: "${content.substring(0, 100)}"`);
    } else {
      log("VISION", "FAIL — Empty response from model");
    }
  } catch (err) {
    log("VISION", `FAIL — ${err.message}`);
  }
}

async function testGlyph() {
  log("GLYPH", "Testing real KAP112 glyph analysis...");

  if (!API_KEY) {
    log("GLYPH", "SKIPPED — KAP_VISION_API_KEY not set");
    return;
  }

  // Find a real KAP112 glyph image
  const datasetPath = join(process.cwd(), "mapping-data", "glyph-dataset", "KAP112", "meta.json");
  if (!existsSync(datasetPath)) {
    log("GLYPH", "SKIPPED — glyph dataset not found");
    return;
  }

  const meta = JSON.parse(readFileSync(datasetPath, "utf-8"));
  const glyphs = Object.entries(meta.glyphs || {})
    .filter(([, g]) => g.hasGlyph)
    .slice(0, 5); // Only test 5 glyphs

  if (glyphs.length === 0) {
    log("GLYPH", "SKIPPED — no glyphs with images found");
    return;
  }

  log("GLYPH", `Testing ${glyphs.length} KAP112 glyphs...`);

  let successCount = 0;
  let errorCount = 0;

  for (const [hexKey, glyph] of glyphs) {
    const imagePath = join(process.cwd(), "mapping-data", "glyph-dataset", "KAP112", glyph.imagePath);
    if (!existsSync(imagePath)) continue;

    try {
      const imageBuffer = readFileSync(imagePath);
      const imageBase64 = imageBuffer.toString("base64");

      const prompt = `Analyze this glyph from a legacy Gujarati KAP font. Return JSON: {"candidates":[{"unicode":"<char>","confidence":<0-1>,"reason":"<why>"}],"uncertain":<bool>}`;

      const resp = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}`, detail: "high" } },
              ],
            },
          ],
          max_tokens: 256,
          temperature: 0.1,
        }),
      });

      if (!resp.ok) {
        const body = await resp.text();
        log("GLYPH", `  ${hexKey} (byte ${glyph.byte}) — HTTP ${resp.status}: ${body.substring(0, 100)}`);
        errorCount++;
        continue;
      }

      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content || "";
      const candidates = content.match(/"unicode"\s*:\s*"([^"]+)"/g) || [];
      log("GLYPH", `  ${hexKey} (byte ${glyph.byte}) — ${candidates.length} candidate(s), response length: ${content.length}`);
      successCount++;
    } catch (err) {
      log("GLYPH", `  ${hexKey} — ERROR: ${err.message}`);
      errorCount++;
    }
  }

  log("GLYPH", `Results: ${successCount} succeeded, ${errorCount} failed out of ${glyphs.length}`);
}

export default async function main() {
  console.log("=== OmniRoute Vision Integration Test ===\n");

  const connected = await testConnection();
  console.log();

  if (connected) {
    await testVision();
    console.log();
    await testGlyph();
  }

  console.log("\n=== Test Complete ===");
}
