const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

const isDev = !app.isPackaged;
let mainWindow = null;
let isQuitting = false;

// Validate and normalize a base URL for the OmniRoute endpoint
function validateBaseUrl(url) {
  if (!url || typeof url !== "string") {
    return "http://localhost:20333/v1";
  }
  const trimmed = url.trim().replace(/\/+$/, "");
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "http://localhost:20333/v1";
    }
    return parsed.origin + parsed.pathname.replace(/\/+$/, "");
  } catch {
    return "http://localhost:20333/v1";
  }
}

// OpenAI-compatible configuration — API key stays in main process only
// KAP_VISION_API_KEY is preferred; OPENAI_API_KEY is fallback for backwards compat
const openaiConfig = {
  apiKey: process.env.KAP_VISION_API_KEY || process.env.OPENAI_API_KEY || "",
  model: process.env.KAP_VISION_MODEL || "gpt-4o",
  provider: process.env.KAP_ANALYZER_PROVIDER || "openai",
  baseUrl: validateBaseUrl(process.env.KAP_VISION_BASE_URL),
  concurrency: parseInt(process.env.KAP_VISION_CONCURRENCY || "3", 10) || 3,
};

function getRecentFilesPath() {
  return path.join(app.getPath("userData"), "recent-files.json");
}

function loadRecentFiles() {
  try {
    const filePath = getRecentFilesPath();
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Failed to load recent files:", err);
  }
  return [];
}

function saveRecentFilesList(files) {
  try {
    const filePath = getRecentFilesPath();
    fs.writeFileSync(filePath, JSON.stringify(files.slice(0, 10), null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save recent files:", err);
  }
}

function addRecentFileToStore(filePath) {
  if (!filePath || typeof filePath !== "string") return [];
  let files = loadRecentFiles();
  files = files.filter((item) => item.path !== filePath && item !== filePath);
  const name = path.basename(filePath);
  files.unshift({ path: filePath, name, updatedAt: new Date().toISOString() });
  saveRecentFilesList(files);
  return files;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: "Question Bank — Desktop Editor",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.webContents.send("app:closeRequested");
    }
  });
}

// IPC Handlers
ipcMain.handle("dialog:openFile", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Open Question Bank Document",
    filters: [{ name: "Question Bank Document", extensions: ["qbank"] }],
    properties: ["openFile"],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const selectedPath = result.filePaths[0];
  try {
    const content = await fs.promises.readFile(selectedPath, "utf-8");
    addRecentFileToStore(selectedPath);
    return { filePath: selectedPath, content };
  } catch (error) {
    console.error("Error reading file:", error);
    throw new Error(`Failed to read file: ${error.message}`);
  }
});

ipcMain.handle("dialog:saveFile", async (_event, defaultTitle) => {
  if (!mainWindow) return null;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Save Question Bank Document",
    defaultPath: defaultTitle ? `${defaultTitle}.qbank` : "Untitled Question Paper.qbank",
    filters: [{ name: "Question Bank Document", extensions: ["qbank"] }],
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  let savePath = result.filePath;
  if (!savePath.endsWith(".qbank")) {
    savePath += ".qbank";
  }

  return savePath;
});

ipcMain.handle("file:read", async (_event, filePath) => {
  if (!filePath) throw new Error("File path is required.");
  try {
    const content = await fs.promises.readFile(filePath, "utf-8");
    addRecentFileToStore(filePath);
    return { filePath, content };
  } catch (error) {
    console.error("Error reading file:", error);
    throw new Error(`Failed to read file: ${error.message}`);
  }
});

ipcMain.handle("file:write", async (_event, { filePath, content }) => {
  if (!filePath || !content) throw new Error("File path and content are required.");

  let targetPath = filePath;
  if (!targetPath.endsWith(".qbank")) {
    targetPath += ".qbank";
  }

  const tempPath = `${targetPath}.tmp`;
  try {
    await fs.promises.writeFile(tempPath, content, "utf-8");
    await fs.promises.rename(tempPath, targetPath);
    addRecentFileToStore(targetPath);
    return { success: true, filePath: targetPath };
  } catch (error) {
    console.error("Error saving file atomically:", error);
    try {
      await fs.promises.writeFile(targetPath, content, "utf-8");
      addRecentFileToStore(targetPath);
      return { success: true, filePath: targetPath };
    } catch (fallbackError) {
      console.error("Error saving file directly:", fallbackError);
      throw new Error(`Failed to save file: ${fallbackError.message}`);
    }
  }
});

ipcMain.handle("recent:get", async () => {
  return loadRecentFiles();
});

ipcMain.handle("recent:add", async (_event, filePath) => {
  return addRecentFileToStore(filePath);
});

ipcMain.handle("pdf:export", async (_event, { htmlContent, defaultTitle }) => {
  if (!mainWindow) return null;

  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Export Question Paper to PDF",
    defaultPath: defaultTitle ? `${defaultTitle}.pdf` : "Question Paper.pdf",
    filters: [{ name: "PDF Document", extensions: ["pdf"] }],
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  let savePath = result.filePath;
  if (!savePath.endsWith(".pdf")) {
    savePath += ".pdf";
  }

  const printWin = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  try {
    const encodedHtml = "data:text/html;charset=utf-8," + encodeURIComponent(htmlContent);
    await printWin.loadURL(encodedHtml);

    const pdfBuffer = await printWin.webContents.printToPDF({
      printBackground: true,
      pageSize: "A4",
      landscape: false,
      margins: { marginType: "none" },
    });

    await fs.promises.writeFile(savePath, pdfBuffer);
    printWin.destroy();
    return { success: true, filePath: savePath };
  } catch (error) {
    if (!printWin.isDestroyed()) printWin.destroy();
    console.error("PDF Export main error:", error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
});

ipcMain.handle("document:print", async (_event, htmlContent) => {
  const printWin = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  try {
    const encodedHtml = "data:text/html;charset=utf-8," + encodeURIComponent(htmlContent);
    await printWin.loadURL(encodedHtml);
    printWin.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => {
      if (!success) console.error("Print failed:", failureReason);
      printWin.destroy();
    });
    return true;
  } catch (error) {
    if (!printWin.isDestroyed()) printWin.destroy();
    console.error("Print main error:", error);
    throw new Error(`Failed to trigger print: ${error.message}`);
  }
});


ipcMain.handle("dialog:confirmClose", async (_event, isDirty) => {
  if (!mainWindow) return "dontsave";

  if (!isDirty) {
    isQuitting = true;
    mainWindow.close();
    return "dontsave";
  }

  const result = await dialog.showMessageBox(mainWindow, {
    type: "warning",
    buttons: ["Save", "Don't Save", "Cancel"],
    defaultId: 0,
    cancelId: 2,
    title: "Unsaved Changes",
    message: "Do you want to save the changes you made to this document?",
    detail: "Your changes will be lost if you don't save them.",
  });

  if (result.response === 0) {
    return "save";
  } else if (result.response === 1) {
    isQuitting = true;
    mainWindow.close();
    return "dontsave";
  } else {
    return "cancel";
  }
});

// ============================================================
// KAP AI Analyzer IPC Handlers
// API key NEVER leaves the main process
// ============================================================

// Sanitize error messages to remove any leaked API keys or auth headers
function sanitizeError(error) {
  if (!error || !error.message) return "Unknown error";
  let msg = error.message;
  if (openaiConfig.apiKey) {
    msg = msg.replace(new RegExp(openaiConfig.apiKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "[REDACTED]");
  }
  msg = msg.replace(/sk-[a-zA-Z0-9]{20,}/g, "[REDACTED]");
  msg = msg.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED]");
  msg = msg.replace(/Authorization:\s*[^\s]*/gi, "Authorization: [REDACTED]");
  return msg;
}

// Validate font name parameter
function isValidFont(font) {
  return ["KAP110", "KAP111", "KAP112", "KAP122"].includes(font);
}

// Get analyzer status (no API key exposed)
ipcMain.handle("analyzer:getStatus", async () => {
  return {
    provider: openaiConfig.provider,
    model: openaiConfig.model,
    baseUrl: openaiConfig.baseUrl,
    apiKeyConfigured: !!openaiConfig.apiKey,
    apiKeyLast4: openaiConfig.apiKey ? openaiConfig.apiKey.slice(-4) : null,
  };
});

// Test OpenAI-compatible connection (API key stays in main process)
ipcMain.handle("analyzer:testConnection", async () => {
  if (!openaiConfig.apiKey) {
    return {
      success: false,
      error: "API key is not configured. Set KAP_VISION_API_KEY environment variable.",
    };
  }

  try {
    // Dynamic import to avoid exposing to renderer
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({
      apiKey: openaiConfig.apiKey,
      baseURL: openaiConfig.baseUrl,
    });

    // Simple test - list models to verify connection
    await client.models.list({ limit: 1 });
    return {
      success: true,
      model: openaiConfig.model,
      baseUrl: openaiConfig.baseUrl,
      provider: openaiConfig.provider,
    };
  } catch (error) {
    return {
      success: false,
      error: `Connection failed: ${sanitizeError(error)}`,
    };
  }
});

// Analyze a single glyph (API key stays in main process)
ipcMain.handle("analyzer:analyzeGlyph", async (_event, params) => {
  // Input validation
  if (!params || typeof params !== "object") {
    throw new Error("Invalid parameters: expected an object");
  }
  const { font, byte, hex, glyphImagePath, glyphName, hasGlyph } = params;
  if (!font || !isValidFont(font)) {
    throw new Error(`Invalid font: "${font}". Must be one of: KAP110, KAP111, KAP112, KAP122`);
  }
  if (typeof byte !== "number" || byte < 0 || byte > 255 || !Number.isInteger(byte)) {
    throw new Error(`Invalid byte value: ${byte}. Must be an integer 0-255`);
  }
  if (typeof hex !== "string" || !/^[0-9A-Fa-f]{2}$/.test(hex)) {
    throw new Error(`Invalid hex value: "${hex}". Must be a 2-character hex string`);
  }
  if (typeof glyphImagePath !== "string" || !glyphImagePath) {
    throw new Error("glyphImagePath is required");
  }

  if (!openaiConfig.apiKey) {
    throw new Error("API key is not configured. Set KAP_VISION_API_KEY environment variable.");
  }

  try {
    const { default: OpenAI } = await import("openai");

    const client = new OpenAI({
      apiKey: openaiConfig.apiKey,
      baseURL: openaiConfig.baseUrl,
    });

    // Read glyph image
    const fullImagePath = path.join(process.cwd(), glyphImagePath);
    const imageBuffer = fs.readFileSync(fullImagePath);
    const imageBase64 = imageBuffer.toString("base64");

    const asciiChar = byte >= 0x20 && byte <= 0x7E ? String.fromCharCode(byte) : "(non-printable)";

    const prompt = `You are analyzing a glyph from a legacy Gujarati KAP font.

CRITICAL INSTRUCTIONS:
1. The image is the PRIMARY evidence. Look at the rendered glyph carefully.
2. The byte/code is METADATA only - do NOT assume the byte value indicates the character.
3. This is a legacy Gujarati font. The glyph may represent a Gujarati character, part of a character, or a multi-byte sequence component.
4. Do NOT guess confidently when uncertain. Return "uncertain": true if unsure.
5. You may return MULTIPLE candidates if uncertain - this is encouraged.
6. NEVER force exactly one answer.

CONTEXT:
- Font: ${font}
- Byte: ${byte} (decimal)
- Hex: ${hex}
- ASCII: ${asciiChar}
- Glyph name: ${glyphName || "unknown"}

Analyze the rendered glyph image and determine which Gujarati Unicode character(s), if any, the glyph most closely represents.

Return a JSON response with this exact structure:
{
  "candidates": [
    {
      "unicode": "<unicode character(s)>",
      "unicodeName": "<Unicode name of the character>",
      "confidence": <0.0 to 1.0>,
      "reason": "<brief explanation of visual analysis>",
      "isSequence": <true if multi-byte sequence component>
    }
  ],
  "uncertain": <true if not confident>,
  "notes": "<any additional observations>"
}`;

    const response = await client.chat.completions.create({
      model: openaiConfig.model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: `data:image/png;base64,${imageBase64}`, detail: "high" },
            },
          ],
        },
      ],
      max_tokens: 1024,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenAI API");
    }

    // Parse response
    let parsed;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = { candidates: [], uncertain: true, notes: "Failed to parse response" };
    }

    return {
      candidates: (parsed.candidates || []).slice(0, 5),
      uncertain: parsed.uncertain || false,
      notes: parsed.notes || "",
      model: openaiConfig.model,
    };
  } catch (error) {
    throw new Error(`Analysis failed: ${sanitizeError(error)}`);
  }
});

// Analyze sequence (API key stays in main process)
ipcMain.handle("analyzer:analyzeSequence", async (_event, params) => {
  // Input validation
  if (!params || typeof params !== "object") {
    throw new Error("Invalid parameters: expected an object");
  }
  const { font, kapSequence, byteValues } = params;
  if (!font || !isValidFont(font)) {
    throw new Error(`Invalid font: "${font}". Must be one of: KAP110, KAP111, KAP112, KAP122`);
  }
  if (typeof kapSequence !== "string" || kapSequence.length === 0) {
    throw new Error("kapSequence is required and must be a non-empty string");
  }
  if (!Array.isArray(byteValues) || byteValues.length === 0) {
    throw new Error("byteValues is required and must be a non-empty array");
  }
  for (const val of byteValues) {
    if (typeof val !== "number" || val < 0 || val > 255 || !Number.isInteger(val)) {
      throw new Error(`Invalid byte value in byteValues: ${val}. Must be an integer 0-255`);
    }
  }

  if (!openaiConfig.apiKey) {
    throw new Error("API key is not configured. Set KAP_VISION_API_KEY environment variable.");
  }

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({
      apiKey: openaiConfig.apiKey,
      baseURL: openaiConfig.baseUrl,
    });

    const byteDescriptions = byteValues.map((val, i) => {
      const hex = `0x${val.toString(16).toUpperCase().padStart(2, "0")}`;
      const ascii = val >= 0x20 && val <= 0x7E ? String.fromCharCode(val) : "(non-printable)";
      return `  Byte ${i + 1}: ${val} (${hex}, ASCII: ${ascii})`;
    }).join("\n");

    const prompt = `You are analyzing a SEQUENCE of glyphs from a legacy Gujarati KAP font.

CRITICAL: This is a multi-byte sequence analysis. The entire sequence may map to a SINGLE Unicode string.

CONTEXT:
- Font: ${font}
- KAP Sequence: ${kapSequence}
- Byte count: ${byteValues.length}

Byte breakdown:
${byteDescriptions}

Known sequence anchor (for reference):
- "VF5[,F" → "ગુજરાતી" (Project golden sample)

Analyze the sequence and determine what Unicode string it represents.

Return JSON:
{
  "candidates": [
    {
      "unicode": "<full Unicode string>",
      "confidence": <0.0 to 1.0>,
      "reason": "<analysis>",
      "isSequence": true
    }
  ],
  "uncertain": <true if not confident>
}`;

    const response = await client.chat.completions.create({
      model: openaiConfig.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 512,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenAI API");
    }

    let parsed;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = { candidates: [], uncertain: true };
    }

    return {
      candidates: (parsed.candidates || []).slice(0, 3),
      uncertain: parsed.uncertain || false,
      model: openaiConfig.model,
    };
  } catch (error) {
    throw new Error(`Sequence analysis failed: ${sanitizeError(error)}`);
  }
});

// Read glyph dataset metadata
ipcMain.handle("analyzer:getGlyphDataset", async (_event, params) => {
  if (!params || typeof params !== "object" || !params.font) {
    throw new Error("Invalid parameters: font is required");
  }
  const { font } = params;
  if (!isValidFont(font)) {
    throw new Error(`Invalid font: "${font}". Must be one of: KAP110, KAP111, KAP112, KAP122`);
  }

  try {
    const datasetPath = path.join(process.cwd(), "mapping-data", "glyph-dataset", font, "meta.json");
    const content = fs.readFileSync(datasetPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
});

// Export verified mappings
ipcMain.handle("analyzer:exportVerified", async (_event, params) => {
  if (!params || typeof params !== "object") {
    throw new Error("Invalid parameters: expected an object");
  }
  const { font, mappings } = params;
  if (!font || !isValidFont(font)) {
    throw new Error(`Invalid font: "${font}". Must be one of: KAP110, KAP111, KAP112, KAP122`);
  }
  if (!Array.isArray(mappings)) {
    throw new Error("mappings must be an array");
  }

  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Export Verified KAP Mappings",
    defaultPath: `${font.toLowerCase()}-verified.json`,
    filters: [{ name: "JSON File", extensions: ["json"] }],
  });

  if (result.canceled || !result.filePath) {
    return null;
  }

  try {
    const exportData = {
      font,
      verifiedAt: new Date().toISOString(),
      verifiedBy: "human",
      mappings: mappings.filter(m => m.humanVerified && m.status === "verified"),
    };

    await fs.promises.writeFile(result.filePath, JSON.stringify(exportData, null, 2), "utf-8");
    return { success: true, filePath: result.filePath, count: exportData.mappings.length };
  } catch (error) {
    throw new Error(`Export failed: ${error.message}`);
  }
});

// Save analyzer state
ipcMain.handle("analyzer:saveState", async (_event, params) => {
  if (!params || typeof params !== "object") {
    throw new Error("Invalid parameters: expected an object");
  }
  const { font, state } = params;
  if (!font || !isValidFont(font)) {
    throw new Error(`Invalid font: "${font}". Must be one of: KAP110, KAP111, KAP112, KAP122`);
  }
  if (!state || typeof state !== "object") {
    throw new Error("state is required and must be an object");
  }

  const statePath = path.join(app.getPath("userData"), `analyzer-${font}.json`);
  try {
    await fs.promises.writeFile(statePath, JSON.stringify(state, null, 2), "utf-8");
    return { success: true };
  } catch (error) {
    console.error("Failed to save analyzer state:", error);
    return { success: false, error: error.message };
  }
});

// Load analyzer state
ipcMain.handle("analyzer:loadState", async (_event, params) => {
  if (!params || typeof params !== "object") {
    throw new Error("Invalid parameters: expected an object");
  }
  const { font } = params;
  if (!font || !isValidFont(font)) {
    throw new Error(`Invalid font: "${font}". Must be one of: KAP110, KAP111, KAP112, KAP122`);
  }

  const statePath = path.join(app.getPath("userData"), `analyzer-${font}.json`);
  try {
    if (fs.existsSync(statePath)) {
      const content = await fs.promises.readFile(statePath, "utf-8");
      return JSON.parse(content);
    }
  } catch (error) {
    console.error("Failed to load analyzer state:", error);
  }
  return null;
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});