import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { fetchPage, FetchError } from "./lib/fetchPage.js";
import { analyzeWithClaude, describeApiError, hasApiKey } from "./lib/analyze.js";
import { analyzeWithHeuristics } from "./lib/heuristics.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, "public");

const envFile = path.join(here, ".env");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

function serveStatic(req, res) {
  const pathname = new URL(req.url, "http://localhost").pathname;
  const file = path.join(publicDir, pathname === "/" ? "index.html" : decodeURIComponent(pathname));
  if (!file.startsWith(publicDir + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
      return;
    }
    res.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream" }).end(data);
  });
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 10_000) throw new FetchError("Request too large.");
  }
  try {
    return JSON.parse(body || "{}");
  } catch {
    throw new FetchError("Invalid request.");
  }
}

// Streams newline-delimited JSON so the page can show progress while the
// check runs: {type: "status"} lines, then one {type: "result"} or {type: "error"}.
async function handleCheck(req, res) {
  res.writeHead(200, { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" });
  const send = (event) => res.write(JSON.stringify(event) + "\n");

  try {
    const { url } = await readJson(req);
    send({ type: "status", message: "Opening the link" });
    const page = await fetchPage(url);

    const mode = hasApiKey() ? "ai" : "limited";
    let analysis;
    if (mode === "ai") {
      send({ type: "status", message: "Reading the content and picking out its claims" });
      analysis = await analyzeWithClaude(page, (message) => send({ type: "status", message }));
    } else {
      analysis = analyzeWithHeuristics(page);
    }

    send({
      type: "result",
      data: {
        mode,
        url: page.finalUrl,
        host: page.host,
        title: page.meta.title,
        notes: page.notes,
        ...analysis,
      },
    });
  } catch (error) {
    if (!(error instanceof FetchError)) console.error(error);
    send({ type: "error", message: error instanceof FetchError ? error.message : describeApiError(error) });
  }
  res.end();
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/check") {
    handleCheck(req, res);
  } else if (req.method === "GET" && req.url === "/api/status") {
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ mode: hasApiKey() ? "ai" : "limited" }));
  } else if (req.method === "GET") {
    serveStatic(req, res);
  } else {
    res.writeHead(405).end();
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Link Authenticator running at http://localhost:${PORT}`);
  console.log(hasApiKey() ? "AI fact-checking is on." : "No ANTHROPIC_API_KEY found: running in limited mode (see README).");
});
