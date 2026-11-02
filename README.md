# Robotics Portfolio

GitHub static page version of [nori.fish/robotics](https://nori.fish/robotics/).

nori.fish is served from its own server. If that server is unreachable, Cloudflare serves the robotics pages from this site instead, and every other nori.fish page shows the status page.

## Layout

| Path | What it is |
|---|---|
| `/` | The robotics portfolio, with a notice that this is the GitHub static page version |
| `/status/` | "Nori is temporarily down" page with live status for the website and API |
| `css_global/`, `js_global/`, `fish_logo.png` | Shared Nori theme files the portfolio loads |
| `images/`, `videos/` | Portfolio media |

This repository is generated from the private nori-web source by `server/ops/build-robotics-portfolio.sh`; edit the source there.

Contact: dev@nori.fish
