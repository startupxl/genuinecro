# Hosting Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing GenuineCRO app (unmodified in behavior) deployable to Hostinger's Node.js App hosting via a GitHub-connected Express server, with the current source safely committed to git for the first time.

**Architecture:** A thin Express server (`server.js` at repo root — the file Hostinger's Node.js App panel points at) serves the Vite-built `dist/` folder with SPA fallback routing, plus a single `/api/health` route. No business logic moves yet — the app still calls Supabase directly from the browser exactly as it does today. This plan only proves the hosting/deploy mechanics work; later plans handle the Firebase/OpenAI/PayPal migration.

**Tech Stack:** Express 4, Node.js (matching Hostinger's supported LTS), Vite (existing build), git, GitHub.

## Global Constraints

- Target host: Hostinger shared/Business hosting, Node.js App feature (no root/SSH access, no arbitrary system services).
- Deploy mechanism: Hostinger hPanel's Git integration pulls from `https://github.com/startupxl/genuinecro` (public repo, default branch `main`) and restarts the app — no GitHub Actions.
- No secrets are ever committed. `.env` currently holds `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL` and must stay gitignored.
- Server must run same-origin with the frontend (no CORS needed for first-party API routes going forward).
- Reference spec: `docs/superpowers/specs/2026-07-01-node-hostinger-redesign-design.md` §3 (Architecture: Hosting & Deployment).

---

### Task 1: Lock down `.gitignore` and import the existing source as a clean baseline commit

**Files:**
- Modify: `.gitignore`
- Create (nothing — this task only stages/commits existing files)

**Interfaces:**
- Consumes: nothing (first real task)
- Produces: a git history with a clean baseline commit that later tasks build on top of

- [ ] **Step 1: Add missing exclusions to `.gitignore`**

Open `.gitignore` and append:

```gitignore

# Env files (never commit secrets)
.env
.env.*
!.env.example

# Sandbox/tooling artifacts (not part of the shipped app)
.git.broken-worktree-pointer.bak
.superpowers/
.workspace/

# TypeScript incremental build info
*.tsbuildinfo
```

- [ ] **Step 2: Verify `.env` is now ignored**

Run: `git check-ignore -v .env`
Expected output: a line showing `.gitignore` as the matching rule (confirms `.env` will never be staged).

- [ ] **Step 3: Stage and commit the existing source as a baseline**

```bash
git add .gitignore package.json package-lock.json bun.lock bun.lockb components.json \
  eslint.config.js index.html playwright-fixture.ts playwright.config.ts postcss.config.js \
  README.md tailwind.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json \
  vite.config.ts vitest.config.ts public src supabase
git status --short
```

Expected: every file above shows as staged (`A`), and `.env`, `.git.broken-worktree-pointer.bak`, `.superpowers/`, `.workspace/`, `*.tsbuildinfo` do **not** appear in the list.

- [ ] **Step 4: Commit**

```bash
git commit -m "Import existing GenuineCRO source as baseline

Pre-migration snapshot of the Lovable-exported Vite/React/Supabase app,
committed as-is before the Node.js/Hostinger/Firebase migration begins."
```

---

### Task 2: Add the Express hosting server

**Files:**
- Create: `server.js`
- Modify: `package.json` (dependencies + scripts)
- Test: manual verification via `curl` (see steps below) — this is infrastructure/config, not application logic, so verification is behavioral rather than unit-tested

**Interfaces:**
- Consumes: the built `dist/` directory produced by `vite build` (already configured in `vite.config.ts`, unchanged)
- Produces: an HTTP server listening on `process.env.PORT || 3000`, serving:
  - `GET /api/health` → `200 { "status": "ok" }`
  - any other `GET` request → static file from `dist/` if it exists, else `dist/index.html` (SPA fallback)

- [ ] **Step 1: Install Express**

```bash
npm install express@^4
```

- [ ] **Step 2: Write `server.js`**

```javascript
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(__dirname, "dist");

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use(express.static(DIST_DIR));

// SPA fallback: any non-API GET request that isn't a static file gets index.html
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(DIST_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`GenuineCRO server listening on port ${PORT}`);
});
```

- [ ] **Step 3: Add `postinstall` build hook and `start` script to `package.json`**

Add to the `"scripts"` block (keep all existing scripts, add these two — `postinstall` is what makes a plain `npm install` on Hostinger also produce `dist/`, since the hPanel Node.js App panel has no separate "build" step):

```json
"postinstall": "vite build",
"start": "node server.js"
```

- [ ] **Step 4: Build and verify the server serves the app**

```bash
npm run build
node server.js &
sleep 1
curl -s http://localhost:3000/api/health
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/help
kill %1
```

Expected:
- First curl: `{"status":"ok"}`
- Second and third curl: `200` (root and `/help` both resolve via SPA fallback to `index.html`)

- [ ] **Step 5: Commit**

```bash
git add server.js package.json package-lock.json
git commit -m "Add Express hosting server for Hostinger Node.js App deployment

Serves the Vite build with SPA fallback routing and a health check route.
No application behavior changes — Supabase calls still happen client-side
exactly as before; this only proves the hosting mechanics."
```

---

### Task 3: Document the Hostinger hPanel setup

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: `server.js` and the `start`/`postinstall` scripts from Task 2
- Produces: a documented, repeatable hPanel configuration procedure for the user (not automatable — this is manual hPanel UI work on the user's account)

- [ ] **Step 1: Replace the Lovable-specific README content with deployment instructions**

Replace the entire contents of `README.md` with:

```markdown
# GenuineCRO

AI-powered conversion friction analysis — paste a URL, get a prioritized,
revenue-ranked backlog of conversion-killing issues.

## Local development

\`\`\`sh
npm install
npm run dev
\`\`\`

## Production build

\`\`\`sh
npm run build   # outputs to dist/
npm start        # serves dist/ via server.js on $PORT (default 3000)
\`\`\`

## Deploying to Hostinger (Node.js App)

1. In hPanel, go to **Advanced → Node.js** and click **Create Application**.
2. Set **Node.js version** to the latest available LTS.
3. Set **Application root** to the folder this repo is deployed into.
4. Set **Application startup file** to \`server.js\`.
5. Under **Git**, connect this application to \`https://github.com/startupxl/genuinecro\`
   (branch \`main\`). Hostinger will pull the repo and run \`npm install\`,
   which triggers the \`postinstall\` script (\`vite build\`) automatically.
6. Add environment variables (see \`.env.example\` for the full list) in the
   Node.js app's **Environment variables** panel — never commit real values.
7. Start/restart the application from the hPanel Node.js App panel.
8. Push to \`main\` on GitHub to trigger a re-pull and restart on subsequent deploys.
```

- [ ] **Step 2: Create `.env.example` documenting required variables**

```bash
cat > .env.example <<'EOF'
VITE_SUPABASE_PROJECT_ID=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_URL=
EOF
```

(Later plans will extend this file as Firebase/OpenAI/PayPal/Kit variables replace the Supabase ones.)

- [ ] **Step 3: Commit**

```bash
git add README.md .env.example
git commit -m "Document Hostinger Node.js App deployment steps"
```

---

### Task 4: Push to GitHub

**Files:** none (git remote operation only)

**Interfaces:**
- Consumes: the local `main` branch built in Tasks 1-3
- Produces: `main` on `github.com/startupxl/genuinecro` matching local history

- [ ] **Step 1: Confirm with the user before pushing**

This is a shared/remote-state action (visible to anyone with repo access) — stop and get explicit go-ahead before running the push, even though the repo was set up for this purpose. Also confirm which credential to use: the previously-shared classic PAT should be rotated (it was pasted in chat history), so prefer a fresh fine-grained token scoped to `Contents: Read and write` on `startupxl/genuinecro` only, supplied via environment variable (never pasted in chat).

- [ ] **Step 2: Add the remote and push**

```bash
git remote add origin https://github.com/startupxl/genuinecro.git
GIT_ASKPASS=true git -c credential.helper= push \
  https://x-access-token:${GH_TOKEN}@github.com/startupxl/genuinecro.git main
```

(Using the token inline in the push URL, not stored in `.git/config`, keeps it out of any file on disk.)

- [ ] **Step 3: Verify**

```bash
git ls-remote origin main
```

Expected: the remote `main` ref's commit hash matches `git rev-parse main` locally.

---

## What this plan does NOT cover (by design)

Firebase migration (Auth/Firestore/Storage), OpenAI/PayPal Express routes, the visual redesign, the new IA/Dashboard shell, Monitoring, Action Center, Reports (PDF/white-label), Kit email, and i18n are all separate future plans — see `docs/superpowers/specs/2026-07-01-node-hostinger-redesign-design.md` and the companion roadmap doc. This plan's sole job is proving the hosting/deploy path works with zero behavior change.
