# SETU — The Bridge from Web to App

SETU is an open-source web-to-mobile wrapper builder. It packages a public HTTPS website inside a Capacitor native shell, runs platform builds on GitHub Actions, and returns expiring download links from Cloudflare R2.

## What this version really does

- Vercel API routes validate build requests and dispatch a GitHub Actions workflow.
- Android builds produce a real debug APK. If an Android release keystore is configured, the workflow can also produce a signed AAB.
- iOS builds produce an iOS Simulator app archive. If Apple signing/provisioning is configured, the workflow can export a device IPA.
- Successful outputs are uploaded to a private Cloudflare R2 bucket. Vercel generates one-hour signed download links.
- The UI can share those direct download links and can optionally request Google Play or App Store Connect upload.
- Config JSON export and setup sharing remain available without native build service configuration.

**Important:** a website wrapper is not automatically store-ready. Some websites prohibit embedding, require OAuth redirect changes, use unsupported browser APIs, or may not meet Apple/Google minimum-functionality policies. Test the generated app thoroughly. Store publishing is attempted only when explicitly selected and the matching signing/store secrets exist.

## Architecture

```text
SETU React UI
   | POST /api/builds (private access key)
   v
Vercel serverless API -----> GitHub Actions workflow_dispatch
   |                               | Android: Linux + Gradle
   | GET /api/builds/:id            | iOS: macOS + Xcode
   v                               v
GitHub run status             Private Cloudflare R2 bucket
   |                               |
   +--- expiring signed URLs <------+
```

Vercel is the request/status/signing-link API, not the native compiler. GitHub Actions is the build runner. R2 stores binaries; files are not stored in the Git repository or Vercel function filesystem.

## Local UI

Requirements: Node.js 20+ and npm.

```bash
npm install
npm test
npm run build
npm run dev
```

The Vite dev server serves only the frontend. To run Vercel API routes locally, install the Vercel CLI and use:

```bash
npx vercel dev
```

Create `.env.local` from `.env.example` and configure the server-side variables. Never put the GitHub token, R2 credentials, signing keys, or store credentials in a `VITE_*` variable or client-side code.

## Deploy the build service

### 1. Push the repository to GitHub

The repository must include `.github/workflows/native-build.yml` on the branch selected by `GITHUB_BUILD_REF` (default `main`). Enable Actions for the repository.

Create a GitHub fine-grained token restricted to this repository with **Actions: read and write** and **Metadata: read** permissions. Store it as `GITHUB_BUILD_TOKEN` in Vercel. Use a GitHub App installation token for a longer-lived production deployment if preferred.

### 2. Create a private Cloudflare R2 bucket

Create an R2 bucket such as `setu-build-artifacts`, then create an R2 API token scoped to that bucket with object read/write permissions. Do not enable public bucket access. Add these server-side Vercel environment variables:

- `R2_ENDPOINT` — `https://<account-id>.r2.cloudflarestorage.com`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`

Add the same R2 credentials as GitHub repository Actions secrets for upload: `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.

### 3. Configure Vercel environment variables

Set the variables in `.env.example` in Vercel Project → Settings → Environment Variables:

- `SETU_BUILD_ACCESS_KEY` — a long random private key. This first implementation is designed for a private/self-hosted builder; anyone with this key can spend your GitHub Actions minutes.
- `SETU_ALLOWED_ORIGINS` — comma-separated exact origins, such as `https://setu.example.com`. Include `http://localhost:3000` only for local testing.
- `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_WORKFLOW_ID=native-build.yml`, `GITHUB_BUILD_REF=main`, `GITHUB_BUILD_TOKEN`.
- The four R2 variables listed above.

Use a different strong key for each deployment. Rotate it if shared. Do not expose it in a public repository. The UI keeps the entered access key in `sessionStorage` for the current tab session, and sends it only as the `x-setu-build-key` header.

### 4. Configure GitHub Actions secrets

Required for artifacts:

- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`

Optional Android release and Google Play upload:

- `ANDROID_KEYSTORE_BASE64` — base64-encoded release `.jks`/`.keystore`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `PLAY_STORE_SERVICE_ACCOUNT_JSON` — service-account JSON with the correct Play Console app permissions

Optional iOS physical-device IPA and App Store Connect upload (macOS runner required):

- `IOS_CERTIFICATE_BASE64` — base64-encoded Apple Distribution `.p12`
- `IOS_CERTIFICATE_PASSWORD`
- `IOS_PROVISIONING_PROFILE_BASE64` — base64-encoded App Store provisioning profile matching the bundle ID
- `IOS_TEAM_ID`
- `IOS_SIGNING_IDENTITY` — for example `Apple Distribution: Company Name (TEAMID)`
- `APP_STORE_CONNECT_KEY_ID`
- `APP_STORE_CONNECT_ISSUER_ID`
- `APP_STORE_CONNECT_PRIVATE_KEY_BASE64` — base64-encoded `.p8` private key

Use the publishing checkboxes only after the relevant store setup is complete. Google Play upload targets the `internal` track. App Store Connect upload sends the IPA to TestFlight processing; it does not bypass App Review or automatically release the app publicly.

### 5. Deploy to Vercel

Import the GitHub repository into Vercel and deploy the Vite project. Vercel serves `api/*.js` as serverless functions. Add all environment variables and redeploy after changing them. Confirm the deployed site origin exactly matches `SETU_ALLOWED_ORIGINS`.

## Security and operating limits

- The API requires a private build access key and checks the browser origin. This is suitable for a private/self-hosted first release, not a multi-tenant public SaaS. For a public hosted service, replace the shared access key with user authentication, per-user quotas, abuse protection, and a queue before opening it to everyone.
- The API key is not a GitHub token. GitHub/R2/signing/store secrets remain server-side.
- Signed R2 download URLs expire after one hour. Share a new link if one expires.
- The status endpoint searches the latest 100 runs for this workflow. A high-volume deployment should persist build records in a database and correlate webhook events instead.
- Public HTTPS sites only. Websites may still block WebViews, require domain association, or need OAuth/deep-link adjustments.
- iOS Simulator `.app` ZIP is not an installable iPhone IPA. A signed IPA needs Apple developer signing and provisioning assets.
- A debug APK is for testing. Google Play requires a properly signed release AAB and compliant store listing.
- No private signing material belongs in source control, browser storage, or frontend environment variables.

## Test

```bash
npm test
npm run build
```

API routes require the configured Vercel/GitHub/R2 secrets to execute a native build. A local frontend build alone cannot validate external build credentials or store upload permissions.

## License

Apache-2.0. See [LICENSE](./LICENSE).
