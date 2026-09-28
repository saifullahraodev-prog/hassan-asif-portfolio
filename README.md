# Hassan Asif — Video Editor Portfolio

A bold, colourful one-page portfolio site. Plain HTML, CSS and JavaScript — no build step.

## Run locally
```
py -m http.server 5173
```
Then open http://localhost:5173

## Add videos
Edit the `SHOWREEL` and `PROJECTS` lists at the top of `script.js`. Each `video` can be:
```js
{ type: "youtube", id: "VIDEO_ID" }
{ type: "vimeo",   id: "VIDEO_ID" }
{ type: "file",    src: "videos/reel.mp4" }
```
