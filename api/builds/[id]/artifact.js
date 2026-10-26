import { Readable } from 'node:stream';
import { checkAccess, checkOrigin, json } from '../../_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });
  if (!checkOrigin(req)) return json(res, 403, { error: 'Origin is not allowed.' });
  if (!checkAccess(req)) return json(res, 401, { error: 'Build access key is missing or invalid.' });

  const requestId = String(req.query.id || '');
  const artifactName = String(req.query.name || '');
  if (!/^[0-9a-f-]{36}$/i.test(requestId) && !/^[a-zA-Z0-9._-]{1,80}$/.test(requestId)) {
    return json(res, 400, { error: 'Invalid build ID.' });
  }
  if (!/^setu-[a-zA-Z0-9._-]+-(android-apk|android-aab|ios-simulator|ios-ipa)$/.test(artifactName) ||
      !artifactName.startsWith(`setu-${requestId}-`)) {
    return json(res, 400, { error: 'Invalid artifact name.' });
  }

  const { GITHUB_OWNER, GITHUB_REPO, GITHUB_WORKFLOW_ID, GITHUB_BUILD_TOKEN } = process.env;
  if (!GITHUB_OWNER || !GITHUB_REPO || !GITHUB_WORKFLOW_ID || !GITHUB_BUILD_TOKEN) {
    return json(res, 503, { error: 'GitHub build service is not configured.' });
  }

  const headers = {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${GITHUB_BUILD_TOKEN}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'SETU-build-service'
  };

  try {
    const runsUrl = `https://api.github.com/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}/actions/workflows/${encodeURIComponent(GITHUB_WORKFLOW_ID)}/runs?event=workflow_dispatch&per_page=100`;
    const runsResponse = await fetch(runsUrl, { headers });
    if (!runsResponse.ok) return json(res, 502, { error: `GitHub run lookup failed (HTTP ${runsResponse.status}).` });
    const runsData = await runsResponse.json();
    const run = (runsData.workflow_runs || []).find(item =>
      item.display_title === `SETU build ${requestId}` || item.name === `SETU build ${requestId}`
    );
    if (!run || run.status !== 'completed' || run.conclusion !== 'success') {
      return json(res, 404, { error: 'Build is not complete yet, or no successful run was found for this request.' });
    }

    const artifactsUrl = `https://api.github.com/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}/actions/runs/${run.id}/artifacts?per_page=100`;
    const artifactsResponse = await fetch(artifactsUrl, { headers });
    if (!artifactsResponse.ok) return json(res, 502, { error: `GitHub artifact lookup failed (HTTP ${artifactsResponse.status}).` });
    const artifactsData = await artifactsResponse.json();
    const artifact = (artifactsData.artifacts || []).find(item => item.name === artifactName && !item.expired);
    if (!artifact) return json(res, 404, { error: 'Artifact not found or it has expired.' });

    const downloadResponse = await fetch(artifact.archive_download_url, { headers, redirect: 'follow' });
    if (!downloadResponse.ok || !downloadResponse.body) {
      return json(res, 502, { error: `GitHub artifact download failed (HTTP ${downloadResponse.status}).` });
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${artifactName}.zip"`);
    res.setHeader('Cache-Control', 'no-store');
    Readable.fromWeb(downloadResponse.body).pipe(res);
  } catch (error) {
    return json(res, 502, { error: `Could not download build artifact: ${error.message}` });
  }
}
