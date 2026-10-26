
import crypto from 'node:crypto';
import {
  json,
  checkAccess,
  checkOrigin,
  validatePayload
} from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed.' });
  }

  if (!checkOrigin(req)) {
    return json(res, 403, {
      error: 'Origin is not allowed. Set SETU_ALLOWED_ORIGINS in Vercel.'
    });
  }

  if (!checkAccess(req)) {
    return json(res, 401, {
      error: 'Public builds are disabled. Set SETU_PUBLIC_BUILDS=true in Vercel, or configure a private build key for self-hosted use.'
    });
  }

  let config;

  try {
    config = validatePayload(req.body);
  } catch (error) {
    return json(res, 400, { error: error.message });
  }

  const {
    GITHUB_OWNER,
    GITHUB_REPO,
    GITHUB_WORKFLOW_ID,
    GITHUB_BUILD_TOKEN
  } = process.env;

  if (
    !GITHUB_OWNER ||
    !GITHUB_REPO ||
    !GITHUB_WORKFLOW_ID ||
    !GITHUB_BUILD_TOKEN
  ) {
    return json(res, 503, {
      error: 'Native build service is not configured. Add GITHUB_OWNER, GITHUB_REPO, GITHUB_WORKFLOW_ID and GITHUB_BUILD_TOKEN to Vercel.'
    });
  }

  const requestId = crypto.randomUUID();

  const apiUrl =
    `https://api.github.com/repos/${encodeURIComponent(GITHUB_OWNER)}` +
    `/${encodeURIComponent(GITHUB_REPO)}/actions/workflows/` +
    `${encodeURIComponent(GITHUB_WORKFLOW_ID)}/dispatches`;

  const appIconDataUrl = typeof req.body?.appIconDataUrl === 'string' ? req.body.appIconDataUrl : '';
  const splashDataUrl = typeof req.body?.splashDataUrl === 'string' ? req.body.splashDataUrl : '';
  const validImageDataUrl = value => !value || (
    value.length <= 28000 &&
    /^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(value)
  );

  if (appIconDataUrl.length + splashDataUrl.length > 56000 || !validImageDataUrl(appIconDataUrl) || !validImageDataUrl(splashDataUrl)) {
    return json(res, 400, {
      error: 'Custom images must be valid, resized PNG/JPEG data URLs under the build upload limit. Please reselect the images and try again.'
    });
  }

  const inputs = {
    request_id: requestId,
    app_name: config.appName,
    website_url: config.websiteUrl,
    platforms: config.platforms,
    android_package_id:
      config.androidPackageId || 'com.example.setuapp',
    ios_bundle_id:
      config.iosBundleId || 'com.example.setuapp',
    publish_google_play: config.publishGooglePlay ? 'true' : 'false',
    publish_app_store: config.publishAppStore ? 'true' : 'false',
    app_icon_data_url: appIconDataUrl,
    splash_data_url: splashDataUrl
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${GITHUB_BUILD_TOKEN}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'SETU-build-service'
      },
      body: JSON.stringify({
        ref: process.env.GITHUB_BUILD_REF || 'main',
        inputs
      })
    });

    if (!response.ok) {
      const detail = await response.text();

      return json(res, 502, {
        error: `GitHub could not start the native build (HTTP ${response.status}). Check token permissions and workflow file.`,
        detail: detail.slice(0, 500)
      });
    }

    return json(res, 202, {
      requestId,
      status: 'queued',
      message: 'Build queued in GitHub Actions. Binaries will be available when the workflow completes.'
    });
  } catch (error) {
    return json(res, 502, {
      error: `Could not contact GitHub Actions: ${error.message}`
    });
  }
}
