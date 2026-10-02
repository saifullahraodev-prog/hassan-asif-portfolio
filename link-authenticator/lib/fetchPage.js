// Fetches the link the user gave us and turns it into something we can analyse:
// page text and metadata for articles and video pages, raw bytes for images.

import dns from "node:dns/promises";
import net from "node:net";

const MAX_REDIRECTS = 5;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_HTML_BYTES = 3 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // Claude API per-image limit
export const MAX_TEXT_CHARS = 60_000;

const CLAUDE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const VIDEO_HOSTS = [
  "youtube.com", "youtu.be", "vimeo.com", "tiktok.com", "dailymotion.com",
  "twitch.tv", "rumble.com", "bitchute.com", "fb.watch",
];

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 LinkAuthenticator/1.0";

export class FetchError extends Error {}

export function normalizeUrl(input) {
  let raw = String(input ?? "").trim();
  if (!raw) throw new FetchError("Please enter a link.");
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = "https://" + raw;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new FetchError("That doesn't look like a valid link.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new FetchError("Only http and https links are supported.");
  }
  return url;
}

function isPrivateAddress(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const lower = address.toLowerCase();
  if (lower.startsWith("::ffff:")) return isPrivateAddress(lower.slice(7));
  return (
    lower === "::" || lower === "::1" ||
    lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80")
  );
}

// The server fetches whatever link it is given, so refuse anything that
// points back at this machine or the local network.
async function assertPublicHost(url) {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  let addresses;
  if (net.isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = (await dns.lookup(host, { all: true })).map((a) => a.address);
    } catch {
      throw new FetchError(`Could not find the website "${host}".`);
    }
  }
  if (addresses.some(isPrivateAddress)) {
    throw new FetchError("Links to local or private network addresses are not allowed.");
  }
}

async function safeFetch(startUrl, accept) {
  let url = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url);
    let response;
    try {
      response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { "user-agent": USER_AGENT, accept, "accept-language": "en" },
      });
    } catch (error) {
      const reason = error.name === "TimeoutError" ? "it took too long to respond" : "the connection failed";
      throw new FetchError(`Could not open the link: ${reason}.`);
    }
    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      url = new URL(response.headers.get("location"), url);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new FetchError("The link redirects somewhere that is not a web page.");
      }
      continue;
    }
    return { response, finalUrl: url };
  }
  throw new FetchError("The link redirects too many times.");
}

// Reads the body up to `limit` bytes. Returns { buffer, truncated }.
async function readBody(response, limit) {
  const chunks = [];
  let size = 0;
  let truncated = false;
  for await (const chunk of response.body ?? []) {
    size += chunk.length;
    if (size > limit) {
      truncated = true;
      break;
    }
    chunks.push(chunk);
  }
  return { buffer: Buffer.concat(chunks), truncated };
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", mdash: "—", ndash: "–", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
    if (code[0] === "#") {
      const point = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function metaContent(html, key) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const name = /\b(?:name|property|itemprop)\s*=\s*["']?([^"'\s>]+)/i.exec(tag)?.[1];
    if (name?.toLowerCase() !== key) continue;
    const content = /\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag);
    const value = content?.[1] ?? content?.[2];
    if (value) return decodeEntities(value).trim();
  }
  return null;
}

function htmlToText(html) {
  const body = /<body\b[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html;
  // Prefer the article/main element when the page has one.
  const main =
    /<article\b[^>]*>([\s\S]*)<\/article>/i.exec(body)?.[1] ??
    /<main\b[^>]*>([\s\S]*)<\/main>/i.exec(body)?.[1] ??
    body;
  const text = main
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|nav|footer|header|aside|form|iframe|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|section)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(text)
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isVideoHost(hostname) {
  const host = hostname.replace(/^www\.|^m\./, "");
  return VIDEO_HOSTS.some((v) => host === v || host.endsWith("." + v));
}

// YouTube often serves a consent page to servers, so ask its oEmbed endpoint
// for the title and channel instead.
async function youtubeOEmbed(url) {
  try {
    const endpoint = new URL("https://www.youtube.com/oembed");
    endpoint.searchParams.set("url", url.href);
    endpoint.searchParams.set("format", "json");
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const data = await response.json();
    return { title: data.title ?? null, author: data.author_name ?? null };
  } catch {
    return null;
  }
}

/**
 * Returns a description of the link:
 * { url, finalUrl, kind: "article" | "image" | "video", https, meta, text, textTruncated,
 *   image: { mediaType, data } | null, linkCount, notes: string[] }
 */
export async function fetchPage(input) {
  const url = normalizeUrl(input);
  const { response, finalUrl } = await safeFetch(url, "text/html,application/xhtml+xml,image/*;q=0.9,*/*;q=0.5");

  const page = {
    url: url.href,
    finalUrl: finalUrl.href,
    host: finalUrl.hostname.replace(/^www\./, ""),
    https: finalUrl.protocol === "https:",
    kind: "article",
    meta: { title: null, description: null, siteName: null, author: null, published: null },
    text: "",
    textTruncated: false,
    image: null,
    linkCount: 0,
    notes: [],
  };

  const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();

  if (!response.ok) {
    // Some sites block automated readers. The AI can still try to read the
    // page itself and search for the story, so this is a note, not a failure.
    await response.body?.cancel();
    page.notes.push(`The site answered with an error (HTTP ${response.status}) when we tried to read the page directly.`);
    if (isVideoHost(finalUrl.hostname) || /\.(mp4|webm|mov|m4v)$/i.test(finalUrl.pathname)) page.kind = "video";
    else if (/\.(jpe?g|png|gif|webp|avif|bmp)$/i.test(finalUrl.pathname)) page.kind = "image";
    return page;
  }

  if (contentType.startsWith("image/")) {
    page.kind = "image";
    if (!CLAUDE_IMAGE_TYPES.includes(contentType)) {
      await response.body?.cancel();
      page.notes.push(`The image format (${contentType}) can't be inspected directly; only its web context was checked.`);
      return page;
    }
    const { buffer, truncated } = await readBody(response, MAX_IMAGE_BYTES);
    if (truncated) {
      page.notes.push("The image is larger than 5 MB, so its pixels were not inspected; only its web context was checked.");
    } else {
      page.image = { mediaType: contentType, data: buffer.toString("base64") };
    }
    return page;
  }

  if (contentType.startsWith("video/") || contentType.startsWith("audio/")) {
    await response.body?.cancel();
    page.kind = "video";
    page.notes.push("This is a direct media file. The footage itself can't be watched by the app; only its web context was checked.");
    return page;
  }

  if (contentType && !/html|xml|text\/plain/.test(contentType)) {
    await response.body?.cancel();
    throw new FetchError(`This link is a file (${contentType}), not an article, image or video page.`);
  }

  const { buffer } = await readBody(response, MAX_HTML_BYTES);
  const html = buffer.toString("utf8");

  const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  page.meta = {
    title: metaContent(html, "og:title") ?? (title ? decodeEntities(title).replace(/\s+/g, " ").trim() : null),
    description: metaContent(html, "og:description") ?? metaContent(html, "description"),
    siteName: metaContent(html, "og:site_name"),
    author: metaContent(html, "author") ?? metaContent(html, "article:author"),
    published: metaContent(html, "article:published_time") ?? metaContent(html, "datepublished") ?? metaContent(html, "date"),
  };

  const ogType = metaContent(html, "og:type") ?? "";
  if (isVideoHost(finalUrl.hostname) || ogType.startsWith("video")) {
    page.kind = "video";
    page.notes.push("The footage and audio can't be watched by the app. The rating is based on the video's title, description and what reliable sources say about it.");
    if (/youtu\.?be/.test(finalUrl.hostname)) {
      const embed = await youtubeOEmbed(finalUrl);
      if (embed) {
        page.meta.title = embed.title ?? page.meta.title;
        page.meta.author = embed.author ?? page.meta.author;
        page.meta.siteName = "YouTube";
      }
    }
    return page;
  }

  const text = contentType === "text/plain" ? html.trim() : htmlToText(html);
  page.linkCount = (html.match(/<a\b[^>]*\bhref\s*=\s*["']https?:\/\//gi) ?? []).length;
  if (text.length > MAX_TEXT_CHARS) {
    page.text = text.slice(0, MAX_TEXT_CHARS);
    page.textTruncated = true;
    page.notes.push(`The page is very long, so only the first ${MAX_TEXT_CHARS.toLocaleString("en")} characters were checked.`);
  } else {
    page.text = text;
  }
  if (page.text.length < 200) {
    page.notes.push("Very little readable text was found on the page (it may need JavaScript, a login or a subscription).");
  }
  return page;
}
