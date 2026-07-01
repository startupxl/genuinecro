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

## Firebase project setup (manual, one-time)

1. Create a project at https://console.firebase.google.com.
2. **Authentication** → Sign-in method → enable **Email/Password** and **Google**.
3. **Firestore Database** → Create database (production mode, choose a region).
4. **Project settings → General** → under "Your apps", add a Web app and copy
   the config values into `VITE_FIREBASE_*` in your `.env`.
5. **Authentication → Users → Add user** — create a dedicated user for the
   server (e.g. `server@internal.genuinecro.app`) with a long, randomly
   generated password used nowhere else. Set `FIREBASE_SERVICE_EMAIL` and
   `FIREBASE_SERVICE_PASSWORD` to those values — in `.env` locally, and as
   Hostinger environment variables in production. This account only ever
   needs Firestore access to the `subscriptions` collection, granted via
   `firestore.rules`, not any GCP IAM role — no service-account key is
   created or needed. (If your organization's `iam.disableServiceAccountKeyCreation`
   policy blocks key creation and you can't get it overridden, this is why
   we use this approach instead.)
6. Log in and link the CLI to this project, then deploy the security rules
   (Firebase Storage isn't used in this project, so only Firestore rules apply):

```sh
firebase login
firebase use --add   # select the project you just created
firebase deploy --only firestore:rules,firestore:indexes
```
