// Limited mode, used when no API key is set. It cannot check facts. It only
// looks at signals about the source and how the page is written, and says so.

const ESTABLISHED = [
  "reuters.com", "apnews.com", "bbc.com", "bbc.co.uk", "nature.com", "science.org",
  "who.int", "un.org", "nasa.gov", "nih.gov", "cdc.gov", "europa.eu", "npr.org",
  "theguardian.com", "nytimes.com", "washingtonpost.com", "economist.com", "ft.com",
  "aljazeera.com", "dawn.com", "snopes.com", "factcheck.org", "politifact.com",
  "fullfact.org", "wikipedia.org", "britannica.com",
];
const SATIRE = ["theonion.com", "babylonbee.com", "clickhole.com", "thedailymash.co.uk", "waterfordwhispersnews.com"];
const SENSATIONAL = /\b(shocking|you won'?t believe|miracle|secret(s)? (they|doctors)|exposed|destroys?|hoax|what happened next|doctors hate|100% proof|wake up)\b/i;

function matches(host, list) {
  return list.some((d) => host === d || host.endsWith("." + d));
}

export function analyzeWithHeuristics(page) {
  const good = [];
  const bad = [];
  let score = 50;

  if (page.https) {
    good.push("The link uses a secure (HTTPS) connection.");
    score += 5;
  } else {
    bad.push("The link does not use a secure (HTTPS) connection.");
    score -= 10;
  }

  if (matches(page.host, SATIRE)) {
    bad.push(`${page.host} is a satire site. Its stories are jokes, not news.`);
    score -= 35;
  } else if (matches(page.host, ESTABLISHED) || /\.(gov|edu)$/.test(page.host)) {
    good.push(`${page.host} is an established source with editorial standards.`);
    score += 25;
  } else {
    bad.push(`${page.host} is not on the short built-in list of established sources. That alone doesn't make it wrong.`);
  }

  if (page.kind === "article") {
    if (page.meta.author) {
      good.push(`A named author is given (${page.meta.author}).`);
      score += 5;
    } else {
      bad.push("No author is named on the page.");
      score -= 5;
    }
    if (page.meta.published) {
      good.push("The page states when it was published.");
      score += 5;
    } else {
      bad.push("No publication date was found.");
      score -= 5;
    }
    if (page.linkCount >= 5) {
      good.push("The page links out to other sources.");
      score += 5;
    }
  }

  const title = page.meta.title ?? "";
  const letters = title.replace(/[^a-z]/gi, "");
  const shouting = letters.length > 15 && letters.replace(/[^A-Z]/g, "").length / letters.length > 0.6;
  if (SENSATIONAL.test(title) || /!{2,}|\?!/.test(title) || shouting) {
    bad.push("The headline uses sensational or clickbait wording.");
    score -= 15;
  }

  return {
    contentType: page.kind,
    verdict: "unverifiable",
    rating: Math.min(100, Math.max(0, score)),
    confidence: "low",
    summary:
      "Limited mode: the facts in this link were not checked. The score only reflects signals about the source and how the page is presented, so treat it as a rough hint. Add an Anthropic API key to get a real fact-check.",
    whatIsRight: good,
    whatIsWrong: bad,
    claims: [],
    limitations: "No claims were verified against other sources. A trustworthy-looking page can still be wrong, and an unknown site can be right.",
  };
}
