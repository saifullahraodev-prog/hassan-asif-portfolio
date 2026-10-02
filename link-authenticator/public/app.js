const $ = (id) => document.getElementById(id);

const VERDICT_LABELS = {
  accurate: "Accurate",
  mostly_accurate: "Mostly accurate",
  mixed: "Mixed: partly right, partly wrong",
  mostly_inaccurate: "Mostly inaccurate",
  inaccurate: "Inaccurate",
  unverifiable: "Could not be verified",
};

const ASSESSMENTS = {
  correct: { label: "Correct", tone: "good" },
  partly_correct: { label: "Partly correct", tone: "warn" },
  misleading: { label: "Misleading", tone: "warn" },
  incorrect: { label: "Incorrect", tone: "bad" },
  unverifiable: { label: "Unverified", tone: "neutral" },
};

function toneForRating(rating) {
  if (rating === null) return "neutral";
  if (rating >= 70) return "good";
  if (rating >= 40) return "warn";
  return "bad";
}

function setTone(element, tone) {
  element.classList.remove("tone-good", "tone-warn", "tone-bad", "tone-neutral");
  element.classList.add("tone-" + tone);
}

function fillList(list, items, emptyText) {
  list.replaceChildren();
  for (const text of items.length ? items : [emptyText]) {
    const li = document.createElement("li");
    li.textContent = text;
    if (!items.length) li.className = "muted";
    list.append(li);
  }
}

function renderClaim(claim) {
  const info = ASSESSMENTS[claim.assessment] ?? ASSESSMENTS.unverifiable;
  const wrap = document.createElement("div");
  wrap.className = "claim";

  const head = document.createElement("div");
  head.className = "claim-head";
  const badge = document.createElement("span");
  badge.className = "badge tone-" + info.tone;
  badge.textContent = info.label;
  const text = document.createElement("p");
  text.className = "claim-text";
  text.textContent = claim.claim;
  head.append(badge, text);

  const explanation = document.createElement("p");
  explanation.textContent = claim.explanation;
  wrap.append(head, explanation);

  if (claim.sources.length) {
    const sources = document.createElement("ul");
    sources.className = "sources";
    for (const source of claim.sources) {
      const li = document.createElement("li");
      const link = document.createElement("a");
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = source.title;
      li.append("Source: ", link);
      sources.append(li);
    }
    wrap.append(sources);
  }
  return wrap;
}

function renderResult(data) {
  const limited = data.mode === "limited";
  const tone = limited ? "neutral" : toneForRating(data.rating);

  setTone($("score"), tone);
  setTone($("verdict-label"), tone);
  $("score-number").textContent = data.rating === null ? "?" : data.rating;
  $("score-label").textContent = data.rating === null ? "no score" : "out of 100";
  $("verdict-label").textContent = limited ? "Source signals only (facts not checked)" : VERDICT_LABELS[data.verdict];
  $("result-title").textContent = data.title ?? data.host;
  $("result-link").textContent = data.url;
  $("result-link").href = data.url;
  $("confidence").textContent = limited ? "" : `Confidence in this verdict: ${data.confidence}`;

  $("summary").textContent = data.summary;
  $("right-heading").textContent = limited ? "Good signs" : "What's right";
  $("wrong-heading").textContent = limited ? "Warning signs" : "What's wrong";
  fillList($("right-list"), data.whatIsRight, limited ? "No good signs found." : "Nothing could be confirmed as correct.");
  fillList($("wrong-list"), data.whatIsWrong, limited ? "No warning signs found." : "No errors were found.");

  $("claims").replaceChildren(...data.claims.map(renderClaim));
  $("claims-card").hidden = data.claims.length === 0;

  const limits = [data.limitations, ...data.notes].filter(Boolean);
  fillList($("limits"), limits, "");
  $("limits-card").hidden = limits.length === 0;

  $("result").hidden = false;
}

function showError(message) {
  $("error").textContent = message;
  $("error").hidden = false;
}

async function checkLink(url) {
  const response = await fetch("/api/check", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!response.ok || !response.body) throw new Error("The server could not start the check.");

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let finished = false;
  const handle = (line) => {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (event.type === "status") $("progress-text").textContent = event.message;
    if (event.type === "result") { renderResult(event.data); finished = true; }
    if (event.type === "error") { showError(event.message); finished = true; }
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop();
    lines.forEach(handle);
  }
  handle(buffer);
  if (!finished) throw new Error("The check stopped before it finished. Please try again.");
}

$("check-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const url = $("url").value.trim();
  if (!url) return;

  $("error").hidden = true;
  $("result").hidden = true;
  $("progress-text").textContent = "Opening the link";
  $("progress").hidden = false;
  $("submit").disabled = true;
  try {
    await checkLink(url);
  } catch (error) {
    showError(error.message || "Something went wrong.");
  } finally {
    $("progress").hidden = true;
    $("submit").disabled = false;
  }
});

fetch("/api/status")
  .then((response) => response.json())
  .then(({ mode }) => { $("mode-banner").hidden = mode !== "limited"; })
  .catch(() => {});
