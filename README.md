# SETU — The Bridge from Web to App

SETU is an open-source web-to-mobile wrapper builder. It packages a public HTTPS website inside a Capacitor native shell, runs platform builds on GitHub Actions, and makes build artifacts available through GitHub Actions artifact storage—without requiring a paid Cloudflare R2 setup.

## What this version really does

- Vercel API routes validate build requests and dispatch a GitHub Actions workflow.
- Android builds produce a real debug APK. If an Android release keystore is configured, the workflow can also produce a signed AAB.
- iOS builds produce an iOS Simulator app archive. If Apple signing/provisioning is configured, the workflow can export a device IPA.
- Successful outputs are uploaded as GitHub Actions artifacts with a 7-day retention period.
- The SETU UI can query artifact metadata and request authenticated downloads through the Vercel API. Users can also open the GitHub Actions run and download artifacts there.
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
   |                               v
   +--- authenticated download <- GitHub Actions artifacts
```

Vercel is the request/status/download-proxy API, not the native compiler. GitHub Actions is the build runner and artifact store. Build outputs are not committed to the Git repository or stored on the Vercel function filesystem.



## End-to-end guide: website URL → GitHub Actions → APK download

Use this guide when you want to create an Android APK from your website using the live SETU builder.

### Part A — Submit your website in SETU

1. Open the live builder: **https://setu-native-builder.vercel.app/**
2. Find **Enter website URL** and enter your full public website address, including `https://`. Example: `https://yourwebsite.com`.
3. Tap/click **Validate URL**. This checks URL syntax only; it does not prove the website is online or compatible with Android WebView.
4. In **App configuration**, set:
   - **App name** — the name shown for the app (up to 50 characters).
   - **Android package ID** — use a unique reverse-domain ID such as `com.yourname.yoursite`. Use lowercase letters/numbers and dots for a typical ID; do not reuse another app's ID.
   - **iOS bundle ID** — required by the current form when Android + iOS or iOS is selected. If building Android only, it is not used by the Android workflow.
   - **App icon** and **Splash screen** are optional in the UI, but the current main-branch build workflow does not apply custom icon/splash uploads to the APK. Do not rely on these images appearing in the output.
5. Under **Choose your platform**, select **Android** to build an APK only. Select **Both platforms** only if you also want an iOS Simulator build.
6. Leave the Google Play and App Store upload checkboxes off unless the corresponding signing and store credentials have been configured by the project owner.
7. Press **Build native app**. SETU submits the request to its Vercel API, which dispatches the `SETU Native Build` workflow in GitHub Actions. Keep the SETU page open so it can poll for status and show download links.

### Part B — Watch the build in GitHub Actions

1. Open the SETU repository: **https://github.com/ansh385/setu-native-builder**
2. Select the **Actions** tab.
3. Open the newest run named **SETU build <request ID>** / **SETU Native Build**. You can also use the **Open GitHub build logs** link in SETU's **Build output** panel after the run appears.
4. Open the run details and watch the **android** job. A normal run checks the HTTPS URL, creates a temporary Capacitor Android project, runs Gradle to build a debug APK, and uploads the APK as an artifact.
5. Wait until the run finishes. The run must show a successful conclusion before the artifact can be downloaded. If it fails, open the failed step and read its log; common causes include an invalid URL, an incompatible website/build environment, or GitHub configuration/permissions.

### Part C — Download the APK from GitHub

1. On the completed successful workflow run page, scroll to the **Artifacts** section near the bottom.
2. Select the artifact named like `setu-<request_id>-android-apk`. GitHub downloads a ZIP file; the artifact is not itself the APK file.
3. On your computer or Android device, open/extract the downloaded ZIP.
4. Inside the extracted folder, locate **`app-debug.apk`**.
5. Transfer/open `app-debug.apk` on your Android phone and install it. Android may ask you to allow installation from that browser or file manager; only proceed if you trust the APK and built it yourself.
6. Launch the app and test navigation, login, forms, links, and any other important features. The wrapper loads the website; it does not automatically convert the website's backend or make every website feature native.

**Alternative:** When SETU shows **Ready to download**, use the artifact's **Download ZIP** button in the SETU **Build output** panel. Extract the downloaded ZIP and install `app-debug.apk` as described above. The **Open GitHub build logs** link opens the same workflow run for troubleshooting.

### Run a workflow manually (fallback)

Use this only if you intentionally want to start a run from GitHub rather than submitting through SETU:

1. Open the repository's **Actions** tab.
2. Select **SETU Native Build** and click **Run workflow**.
3. Select the branch containing `.github/workflows/native-build.yml`.
4. Fill the required inputs: `request_id`, `app_name`, `website_url`, `platforms`, `android_package_id`, and `ios_bundle_id`. Use a unique request ID, a public HTTPS website URL, and `android` for APK-only output. Keep both publishing inputs set to `false` unless publishing is fully configured.
5. Click **Run workflow**, open the new run, wait for success, then download `setu-<request_id>-android-apk` from the **Artifacts** section and extract `app-debug.apk`.

### Artifacts produced by the current workflow

| Target | Artifact name pattern | Output and requirements |
| --- | --- | --- |
| Android testing | `setu-<request_id>-android-apk` | Debug APK; suitable for installing and testing on Android. |
| Android release bundle | `setu-<request_id>-android-aab` | Signed AAB only when all Android keystore secrets are configured. |
| iOS Simulator | `setu-<request_id>-ios-simulator` | ZIP containing a Simulator `.app`; not an installable iPhone IPA. |
| iOS device | `setu-<request_id>-ios-ipa` | Signed IPA only when iOS signing/provisioning is configured. |

Artifacts are retained for **7 days**. Download and save a needed build before it expires. The current workflow uses GitHub Actions artifact storage; it does not require Cloudflare R2. GitHub Actions minutes, storage, and repository limits still apply.

### GitHub configuration required

- Enable GitHub Actions for the repository.
- Keep `.github/workflows/native-build.yml` on the branch selected by `GITHUB_BUILD_REF` (defaults to `main`).
- The token used by Vercel needs repository **Actions: read and write** and **Metadata: read** permissions.
- Configure `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_WORKFLOW_ID`, and `GITHUB_BUILD_TOKEN` in Vercel's server-side environment variables. Use `GITHUB_WORKFLOW_ID=native-build.yml`.
- Never put the GitHub token in frontend code, a `VITE_*` variable, README, screenshots, or a public issue. If a token is exposed, revoke it and create a replacement.

### What the workflow does not guarantee

- A successful build does not guarantee that every website will behave correctly inside a mobile WebView.
- Only public HTTPS websites are accepted by the workflow. Login/OAuth flows, popups, downloads, camera/location access, and other browser-specific features may need additional configuration or testing.
- A debug APK is for testing, not a Play Store release. Store publishing is optional and should remain disabled until signing, store credentials, listing, and policy requirements are ready.
- iOS Simulator output cannot be installed on a physical iPhone. A physical-device IPA requires valid Apple signing and provisioning.
- Public build access can consume the owner's GitHub Actions quota. Before operating SETU as a public multi-user service, add proper user authentication, quotas, abuse controls, and queueing.

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

Create local environment variables for the server-side configuration. Never put the GitHub token or signing/store credentials in a `VITE_*` variable or client-side code.

## Deploy the build service

### 1. Push the repository to GitHub

The repository must include `.github/workflows/native-build.yml` on the branch selected by `GITHUB_BUILD_REF` (default `main`). Enable Actions for the repository.

Create a GitHub fine-grained token restricted to this repository with **Actions: read and write** and **Metadata: read** permissions. Store it as `GITHUB_BUILD_TOKEN` in Vercel. The token is used by the server-side API to dispatch builds, read run status, list artifacts, and authorize downloads.

### 2. Configure Vercel environment variables

Set these variables in Vercel Project → Settings → Environment Variables:

- `SETU_BUILD_ACCESS_KEY` — a long random private key. This first implementation is designed for a private/self-hosted builder; anyone with this key can spend your GitHub Actions minutes.
- `SETU_ALLOWED_ORIGINS` — comma-separated exact origins, such as `https://setu-native-builder.vercel.app`. Include `http://localhost:3000` only for local testing.
- `GITHUB_OWNER=ansh385`
- `GITHUB_REPO=setu-native-builder`
- `GITHUB_WORKFLOW_ID=native-build.yml`
- `GITHUB_BUILD_REF=main`
- `GITHUB_BUILD_TOKEN`

After setting or changing environment variables, redeploy the Vercel project. Confirm the deployed site origin exactly matches one of the entries in `SETU_ALLOWED_ORIGINS`.

### 3. Configure GitHub Actions permissions and secrets

The GitHub token used by Vercel must be able to dispatch workflows and read workflow runs/artifacts. The workflow uploads outputs using `actions/upload-artifact@v4` with 7-day retention; **Cloudflare R2 credentials are not required**.

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

### 4. Deploy to Vercel

Import the GitHub repository into Vercel and deploy the Vite project. Vercel serves `api/*.js` as serverless functions. Add all required environment variables and redeploy after changing them.

## Security and operating limits

- The API requires a private build access key and checks the browser origin. This is suitable for a private/self-hosted first release, not a multi-tenant public SaaS. For a public hosted service, replace the shared access key with user authentication, per-user quotas, abuse protection, and a queue before opening it to everyone.
- The API key is not a GitHub token. GitHub/signing/store secrets remain server-side.
- GitHub Actions artifacts are retained for 7 days by this workflow. Download them before expiry; GitHub plan and repository usage limits still apply.
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

A local frontend build alone cannot validate external GitHub token permissions or store upload permissions.

## License

Apache-2.0. See [LICENSE](./LICENSE).
