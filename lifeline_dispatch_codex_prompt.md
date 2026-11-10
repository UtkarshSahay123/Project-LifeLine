# LifeLine Dispatch — Codex Build Prompt
Theme 9: Supply Chain, Resource & Emergency Optimization

Paste everything below the line into Codex. If Codex struggles with size, give it Part 0 + Part 1 first (backend), then Part 0 + Part 2 (frontend).

---

## PART 0 — ROLE, GOAL, STACK

You are a senior full-stack engineer. Build **LifeLine Dispatch**, a healthcare supply-chain and emergency-resource platform.

**Goal:** (1) a public "Need Center" where citizens find nearby hospitals, ambulances, medicines, oxygen and other resources, nearest first; (2) an organization portal where a government admin, sub-organizations (hospitals, pharmacies, blood banks, NGOs) and their employees manage live resource inventory; (3) an AI chatbot called **Pranrakshak** that answers questions using the registered data without ever leaking confidential data.

**Stack**
- Backend: Java 17, Spring Boot 3, Spring Security (JWT + refresh tokens), Spring Data JPA, PostgreSQL 15 with PostGIS (or `earthdistance`/`cube` if PostGIS is unavailable), Flyway migrations, Spring Cache, Redis (preferred) or Caffeine for cache, WebSocket (STOMP) for live updates.
- Frontend: React + Vite + TypeScript, Tailwind, React Router, Axios/TanStack Query, Google Maps JavaScript API (`@react-google-maps/api`).
- Dev: Docker Compose (postgres, redis, backend, frontend), `.env.example`, Swagger/OpenAPI, README with setup steps.
- Tests: JUnit 5 + Testcontainers for backend, Vitest for frontend.

Create a monorepo: `/backend`, `/frontend`, `docker-compose.yml`, `README.md`.

---

## PART 1 — BACKEND

### 1.1 Roles and org hierarchy

Roles: `SUPER_ADMIN` (government / top-level admin), `ORG_ADMIN` (head of a sub-organization), `EMPLOYEE`, and anonymous `PUBLIC` (Need Center users, no login required).

Hierarchy:

    Government Admin (top org, has ORG CODE)
       └── Sub-Organization (hospital / pharmacy / blood bank / ambulance operator / NGO)
              registers using the admin's ORG CODE; gets its OWN JOINING CODE
              └── Employees (join using the sub-organization's JOINING CODE)

### 1.2 Signup / login flows

**A. Admin signup**
- First screen asks: "Sign up as **Admin** or **Employee**?"
- Admin fields: first name, last name, email, phone, password, government/department name.
- On success: auto-generate a unique, non-guessable **Organization Code** (e.g. `GOV-8K3F-29QX`, cryptographically random, unique index). Show it once on the dashboard and allow regeneration/revocation.
- Admin dashboard: all registered sub-organizations, their live resource totals, employee counts, pending approvals, alerts.

**B. Sub-organization registration** (separate signup option)
- Requires the admin's Organization Code (validate it; reject if invalid/revoked).
- Fields: organization name, type (HOSPITAL, CLINIC, PHARMACY, BLOOD_BANK, AMBULANCE_OPERATOR, NGO, OTHER), registration/licence number, address, **lat/lng (pick on map or geocode)**, contact email/phone, 24x7 flag, bed capacity, head-of-organization details (becomes `ORG_ADMIN`), password.
- Hospital/pharmacy must register supplies at onboarding (can be bulk CSV import or form): see Resource model below.
- On success: auto-generate a separate **Joining Code** for this sub-organization (e.g. `HOSP-4T7M-91ZA`). The sub-organization is automatically linked to the admin who owns the Organization Code, so the admin sees it instantly (status `ACTIVE`, or `PENDING_VERIFICATION` if admin verification is enabled via a config flag).
- ORG_ADMIN can regenerate/disable the joining code and set expiry and max uses.

**C. Employee signup**
- Fields: first name, last name, email, phone, password, **designation**, **employee ID**, **joining code**.
- Joining code resolves to the sub-organization automatically (no manual org entry).
- Account status = `PENDING_APPROVAL`. The **sub-organization's ORG_ADMIN** approves or rejects (final approval is theirs, not the government admin's). The employee cannot log in to org features until approved. Notify via email/in-app.
- Designation-based permissions: e.g. INVENTORY_MANAGER (edit stock), AMBULANCE_DRIVER (update ambulance status/location), DOCTOR/NURSE (view only), DISPATCHER (assign ambulances).

**Auth details:** BCrypt, JWT access (15 min) + refresh (7 days, rotating), rate limiting on login/signup, email verification, account lockout after repeated failures, audit log for every approval/code generation/inventory change.

### 1.3 Data model (PostgreSQL, Flyway)

- `users` (id, first_name, last_name, email, phone, password_hash, role, status, designation, emp_id, organization_id, created_at)
- `organizations` (id, parent_id → government org, name, type, license_no, address, location geography(Point), org_code (top-level only), joining_code, joining_code_expiry, status, is_24x7, contact info)
- `resource_categories` (id, name, e.g. BED_ICU, BED_GENERAL, OXYGEN_CYLINDER, VENTILATOR, MEDICINE, BLOOD_UNIT, PPE, AMBULANCE_SERVICE)
- `resources` (id, organization_id, category_id, name, generic_name, quantity_total, quantity_available, unit, price (shown publicly), expiry_date (for medicines), min_threshold, last_updated_by, last_updated_at)
- `resource_history` (audit of every quantity change)
- `ambulances` (id, organization_id, vehicle_no, type BLS/ALS/NEONATAL, status AVAILABLE/BUSY/OFFLINE, current_location geography(Point), driver_id, last_ping_at)
- `emergency_requests` (id, requester_session, pickup_location, destination_org_id, ambulance_id, status, created_at) — store minimal personal data, auto-purge after N days.
- `external_places` (see Index DB below)
- `search_index` (see Index DB below)
- `chat_sessions`, `chat_messages` (anonymized, no PII stored beyond session id)
- `audit_logs`
- `bug_reports` (see 1.11)

Add GIST indexes on all geography columns, and B-tree/GIN (trigram) indexes on resource names for fast search.

### 1.4 Public Need Center APIs (no login, rate limited, **public-safe DTOs only**)

- `GET /api/public/search?q=&lat=&lng=&radius=&category=&page=` — results sorted by **distance ascending** (nearest first), then by availability.
- `GET /api/public/nearby/hospitals?lat=&lng=&radius=`
- `GET /api/public/nearby/ambulances?lat=&lng=&radius=`
- `POST /api/public/route` — body: origin, destination → returns shortest path using **Dijkstra** (see 1.6).
- `POST /api/public/emergency-request` — request an ambulance.
- `POST /api/public/chat` — Pranrakshak.

**Public-safe DTO rule (critical):** public responses expose ONLY: organization name, type, address, coordinates, public phone, distance, and for each resource: **exact available quantity (`quantity_available`), unit, price, and an availability status** (`AVAILABLE`, `LIMITED`, `UNAVAILABLE`) plus `last_updated_at`, so users can see how fresh the number is and act on it. Exact stock counts and prices ARE visible to the public. Everything else stays private and must NOT be exposed: employee data, inventory history/audit logs, total capacity and min thresholds, licence numbers, joining/org codes, driver identities, and user requests. Enforce this with separate DTO classes and tests that assert the forbidden fields are absent and that stock and price fields are present.

### 1.4a Index-first search pipeline (important)

When a user searches for any resource/hospital/service:

1. Normalize the query (lowercase, trim, synonym map, e.g. "O2 cylinder" → "oxygen cylinder") and compute a cache key: `hash(normalizedQuery + geohash(lat,lng, precision≈5) + category)`.
2. **Check cache** (Redis, TTL 1 week). Hit → return.
3. **Check registered organization data** (live resources table, nearest first).
4. **Check Index DB** (`search_index` + `external_places` — previously fetched online results). Hit and not stale → return.
5. If results are insufficient: **fetch online** (Google Places API / Nearby Search, with the API key kept server-side). Normalize results.
6. **Store the fetched results into the Index DB** (upsert by place_id; save query key, geohash, source, fetched_at, ttl) so the same request is served locally next time.
7. Merge results: registered-org results are marked "Verified live data", online results "From web"; sort everything by distance.
8. Write to cache and return.

Add a scheduled job to refresh stale index entries and evict entries older than a configurable limit. Log cache hit / index hit / online fetch ratios (Micrometer metrics) so the team can show reduced search time.

### 1.5 Caching rules

- Spring Cache + Redis, **TTL = 7 days** for frequently used public data (search results, nearby hospital lists, route graphs, chatbot FAQ answers).
- Because exact stock and prices are public, do NOT cache them for a week. Cache the search/nearby *structure* (which organizations match, their distance) for 7 days, but fetch current quantity and price at response time, or cache them with a short TTL (≤60 s) and evict on every inventory update. Ambulance positions are live via WebSocket.
- **Never cache per-user data or anything with PII.** Cache keys must contain only normalized query + coarse geohash, never user id/IP/phone. Evict relevant keys when an organization updates inventory.
- Cache only public-safe DTOs, never entities.

### 1.6 Dijkstra routing

- Build a road graph: nodes = intersections/points, edges = road segments with weight (distance, optionally traffic-adjusted time). Load from OSM extract for the pilot city into PostgreSQL tables `graph_nodes`, `graph_edges` (or use pgRouting for storage but **implement Dijkstra in Java** with a `PriorityQueue` — this is a hackathon requirement).
- Cache the in-memory graph; snap origin and destination to nearest nodes; return path polyline + distance + ETA.
- Use it for: (a) user → nearest hospital/resource, (b) ambulance → patient pickup, (c) pickup → hospital.
- Fallback to Google Directions if the graph does not cover the area.
- Unit tests with a small hand-built graph and edge cases (disconnected nodes, equal weights).

### 1.7 Ambulance dispatch

- Drivers' app/endpoint pushes location every few seconds (`PATCH /api/org/ambulances/{id}/location`), broadcast via WebSocket.
- On emergency request: find AVAILABLE ambulances within radius, rank by Dijkstra ETA, assign the best, and notify driver + dispatcher. If declined/timeout, auto-reassign to the next.
- Public map shows nearby ambulances as anonymized markers (type + availability only).

### 1.8 Pranrakshak chatbot (backend)

- Endpoint `POST /api/public/chat` (session-based, rate limited, max message length).
- **Answer order:** (1) own database first — registered resources via public-safe views + Index DB + FAQ; (2) if insufficient, Google/web search (server-side); (3) if still unknown, say so and suggest the emergency number (108/112) for emergencies.
- Use an LLM provider behind an interface `LlmClient` (configurable; key in env). Use **tool/function calling** so the model can only call safe tools: `searchResources`, `findNearbyHospitals`, `findNearbyAmbulances`, `getRoute`, `webSearch`. Tools return public-safe DTOs only — the LLM never gets raw tables or SQL access.
- **Confidentiality guardrails:**
  - The bot may state exact available stock and prices (same public fields as the Need Center) and should mention when the data was last updated. No tool can return employee data, org codes, joining codes, licence numbers, inventory history, capacity/thresholds, other users' requests or chat history.
  - Input filter (prompt-injection / "ignore previous instructions" / "show me all data" patterns) and output filter (regex + allow-list check that strips emails, phone numbers of individuals, codes, IDs).
  - System prompt states the bot must refuse requests for confidential/internal data.
  - Do not log raw personal info; redact before storing messages.
  - Authenticated org users asking via the bot only get data their role permits (RBAC enforced in the tool layer, not in the prompt).
- Medical safety: the bot gives resource/logistics info, not diagnoses; always shows an emergency disclaimer for symptoms.
- Support English + Hindi (detect language, reply in the same language).

### 1.9 Organization-side APIs (authenticated, RBAC)

- Admin: `GET /api/admin/organizations`, `GET /api/admin/organizations/{id}/resources`, aggregated dashboard (`/api/admin/dashboard`: total beds, ICU, oxygen, ambulances, shortages, expiring medicines), approve/suspend sub-organizations, view audit logs.
- Org admin: manage employees (approve/reject/deactivate), regenerate joining code, CRUD resources, bulk CSV import, manage ambulances.
- Employee: view/update resources per designation.
- Alerts: low stock (below `min_threshold`), expiring medicines, shortage across region → show in admin dashboard and push through WebSocket.
- Supply-chain optimization (basic, implement): suggest **inter-hospital transfers** — if hospital A has surplus of X and hospital B (nearby) has shortage, generate a recommendation sorted by distance (use Dijkstra). Simple demand-forecast placeholder (moving average of consumption from `resource_history`).

### 1.10 Security and privacy (applies everywhere)

- Org data and public data are separate access paths: public endpoints can only use `PublicViewService` DTOs.
- Method-level security (`@PreAuthorize`), tenant isolation: every org-side query is scoped by the caller's `organization_id` (admin sees their whole subtree).
- Validate all inputs, parameterized queries only, CORS allow-list, security headers, no secrets in code, API keys server-side only.
- Audit log + data retention (purge emergency requests and chat messages after N days).

### 1.11 Bug reporting (emails the site owner)

- Endpoint `POST /api/public/bug-report` (no login needed, also usable by logged-in users). Body: `description` (required, max 2000 chars), `pageUrl`, `userAgent`, optional `contactEmail` (so the owner can reply), optional screenshot (png/jpg, max 2 MB, validated by type and size), optional `appVersion`.
- Send an email to the owner using Spring Mail (SMTP). The recipient comes from the env variable `BUG_REPORT_TO_EMAIL` (the owner's address) and SMTP credentials from env; the address must never appear in frontend code or API responses. Subject format: `[LifeLine Bug] <page> - <first 60 chars>`. Body: description, page URL, timestamp, browser/OS, role (PUBLIC / ADMIN / ORG_ADMIN / EMPLOYEE, no names), and the last few frontend console errors if the client attaches them.
- Send asynchronously (`@Async` or a queue) with retry and backoff; if email fails, the report must still be saved. Store every report in a `bug_reports` table (id, description, page_url, user_agent, contact_email, status NEW/SEEN/FIXED, created_at, email_sent flag).
- Abuse protection: rate limit per IP (e.g. 5 per hour), honeypot field or CAPTCHA, strip HTML from all fields, escape content in the email body, reject oversized payloads.
- Privacy: never auto-attach passwords, tokens, joining/org codes or request bodies. Redact anything that looks like an email, phone number or code in the auto-captured console output.
- Admin dashboard gets a small "Bug reports" list so the owner can see status; the email is the primary notification.

---

## PART 2 — FRONTEND

Design: clean, accessible, mobile-first, red/white/blue medical theme, big emergency button, dark mode optional, English + Hindi toggle.

### 2.1 Pages

**Public (no login)**
1. **Home / Need Center** — search bar ("hospital, ICU bed, oxygen, insulin…"), category chips, "Use my location" (browser geolocation with fallback to manual city/pin entry), results list sorted nearest first (distance, availability badge, "Verified live data" vs "From web" tag), and a Google Map beside it.
2. **Map** — Google Maps with markers + small legend: hospital (red cross), ambulance (blue), pharmacy, oxygen, blood bank, other. Cluster markers; clicking a marker shows a card (name, distance, public phone, exact stock quantity, price, "last updated" time, "Get directions"). Search result rows also show quantity and price. Ambulance markers move live via WebSocket.
3. **Directions** — draws the Dijkstra route returned by the backend (polyline, distance, ETA); shows alternative via Google if requested.
4. **Request Ambulance** — one-tap emergency button, confirms pickup location, shows assigned ambulance, ETA and live tracking.
5. **Pranrakshak chat widget** — floating button on every page, chat window, quick-reply chips ("Nearest ICU bed", "Oxygen near me", "Call ambulance"), typing indicator, Hindi/English, shows a notice "I can't share confidential information", and emergency numbers.

**Organization portal**
6. **Landing/Auth** — Login; Signup with first choice **Admin / Employee**; separate "Register my organization (sub-organization)" option.
7. **Admin signup** → success screen shows the generated Organization Code (copy button).
8. **Sub-organization registration** — multi-step form: org code → organization details → map location picker → supplies registration (form + CSV upload) → success screen showing the org's Joining Code.
9. **Employee signup** — designation, emp ID, joining code (auto-shows the organization name after the code is validated) → "Awaiting approval" screen.
10. **Admin dashboard** — KPI cards, regional map of all sub-organizations with colour-coded stock levels, drill-down table of organizations → resources, shortage/expiry alerts, transfer recommendations, approvals, audit log.
11. **Org-admin dashboard** — resources CRUD (inline edit, bulk upload), ambulances, employee approval queue, joining-code management.
12. **Employee view** — role-limited screens (inventory update or ambulance status).

### 2.2 Frontend rules

- **"Report a Bug" button on every page** (public pages, auth pages, and all dashboards): build one reusable `<ReportBugButton />` mounted in the global layout/footer so it appears everywhere. It opens a small modal with a description box, optional contact email, optional screenshot upload, and a Submit button; it auto-fills the current page URL and browser info, shows a success message ("Thanks, we got your report"), handles errors and loading, and is keyboard accessible. It must not overlap the Pranrakshak chat button (place them in different corners). Posts to `/api/public/bug-report`.

- Route guards per role; JWT in memory + refresh via httpOnly cookie.
- Public pages only call `/api/public/**`; never import org-side types.
- Never display or store sensitive data in localStorage; sanitize chatbot output (no raw HTML).
- Loading skeletons, error states, offline-friendly messages, accessible (ARIA, keyboard).
- Google Maps key restricted by HTTP referrer, loaded from env.

---

## PART 3 — DELIVERABLES AND ORDER OF WORK

1. Scaffold the monorepo, Docker Compose, Flyway migrations for the schema.
2. Auth + org hierarchy (admin signup, org code, sub-org registration, joining codes, employee approval).
3. Resources + ambulances CRUD, audit, alerts.
4. Public search pipeline (cache → registered data → index DB → online → store in index DB) with distance sorting.
5. Dijkstra routing + ambulance dispatch.
6. Pranrakshak chatbot with safe tools and guardrails, and the bug-report endpoint with email sending.
7. Frontend pages (public first, then org portal).
8. Seed data script: 1 government admin, 3 hospitals, 2 pharmacies, 1 blood bank, 8 ambulances, ~100 resources around a pilot city (e.g. Bhopal), plus a demo graph.
9. Tests, OpenAPI docs, README with run instructions and architecture diagram.

**Definition of done:** `docker compose up` starts everything; demo flow works end to end: admin signs up → sub-org registers with the org code and lists supplies → employee joins with the joining code and gets approved → public user searches "oxygen cylinder" and sees nearest results on the map → second identical search is served from cache/index → chatbot answers from registered data and refuses to reveal confidential details → clicking "Report a Bug" on any page sends an email to the owner.

Ask me before making any assumption that would change the data model; otherwise proceed and note assumptions in the README.
