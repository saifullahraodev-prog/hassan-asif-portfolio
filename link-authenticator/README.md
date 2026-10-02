# Link Authenticator

Paste a link to an article, image or video and get:

- an accuracy rating from 0 to 100
- a plain-language summary
- what the content gets right and what it gets wrong
- each main claim checked, with links to the sources used

## Run it

You need [Node.js](https://nodejs.org/) 20.12 or newer.

```bash
npm install
npm start
```

Then open http://localhost:3000.

## Turn on fact-checking

Fact-checking uses Claude (Anthropic's AI) with web search, which needs an API key.

1. Create a key at https://console.anthropic.com/ under **API keys**.
2. Copy `.env.example` to `.env`.
3. Paste the key after `ANTHROPIC_API_KEY=`.
4. Restart the app.

Each check is billed to your Anthropic account. Web search must be enabled for your organisation in the Anthropic Console.

Without a key the app runs in **limited mode**. It does not check any facts. It only scores signals about the source (secure connection, known outlet, named author, date, clickbait wording).

## What it can and can't do

- **Articles**: reads the page text, picks out the main claims and verifies them against other sources on the web.
- **Images**: looks at the image itself (JPEG, PNG, GIF or WebP up to 5 MB) for signs of AI generation or editing and searches for where it came from. Looking at an image can't prove it is genuine.
- **Videos**: the footage and audio are not watched. The check is based on the title, description and what reliable sources report about the video.
- Pages behind a login, a paywall or heavy JavaScript may not be readable.
- It is an automated check and can be wrong. Always open the listed sources yourself.

## How it works

| File | Purpose |
| --- | --- |
| `server.js` | Local web server and the `/api/check` endpoint |
| `lib/fetchPage.js` | Downloads the link safely and extracts text, metadata or the image |
| `lib/analyze.js` | Sends the content to Claude, which searches the web and returns the verdict |
| `lib/heuristics.js` | Limited mode scoring when no API key is set |
| `public/` | The web page |
