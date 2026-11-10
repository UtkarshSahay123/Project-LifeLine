# LifeLine Dispatch frontend

The frontend prototype uses plain HTML, CSS, and JavaScript. The animated home page is `index.html`; the four other primary pages live separately under `pages/`. Shared visual styles are in `assets/lifeline.css`, and common page interactions are in `assets/pages.js`.

## Pages

- Home — `index.html`
- Need Center — `pages/need-center.html`
- Org Portal — `pages/org-portal.html`
- Gov Dashboard — `pages/gov-dashboard.html`
- Employee View — `pages/employee-view.html`

Open `index.html` directly for the visual demo, or serve this directory over HTTP to use browser geolocation and the bug report endpoint. The interactive data and dispatch shown here are demo state. Connect the screens to the Spring Boot APIs before using them for live resource or emergency operations. The bug report form submits to `POST /api/public/bug-report`.

## Backend integration points

The UI is prepared to connect to the public resource search, route, ambulance request, chatbot, and bug-report endpoints described in `lifeline_dispatch_codex_prompt.md`. Organization-side pages need authenticated APIs and role guards before handling real user or inventory data. Google Maps and live ambulance updates also require configured API credentials and the backend WebSocket service.
