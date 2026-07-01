# GenuineCRO

AI-powered conversion friction analysis — paste a URL, get a prioritized,
revenue-ranked backlog of conversion-killing issues.

## Local development

```sh
npm install
npm run dev
```

## Production build

```sh
npm run build   # outputs to dist/
npm start        # serves dist/ via server.js on $PORT (default 3000)
```

## Deploying to Hostinger (Node.js App)

1. In hPanel, go to **Advanced → Node.js** and click **Create Application**.
2. Set **Node.js version** to the latest available LTS.
3. Set **Application root** to the folder this repo is deployed into.
4. Set **Application startup file** to `server.js`.
5. Under **Git**, connect this application to `https://github.com/startupxl/genuinecro`
   (branch `main`). Hostinger will pull the repo and run `npm install`,
   which triggers the `postinstall` script (`vite build`) automatically.
6. Add environment variables (see `.env.example` for the full list) in the
   Node.js app's **Environment variables** panel — never commit real values.
7. Start/restart the application from the hPanel Node.js App panel.
8. Push to `main` on GitHub to trigger a re-pull and restart on subsequent deploys.
