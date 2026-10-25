import { json, checkAccess, checkOrigin, listBuildArtifacts } from '../_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed.' });
  if (!checkOrigin(req)) return json(res, 403, { error: 'Origin is not allowed.' });
  if (!checkAccess(req)) return json(res, 401, { error: 'Build access key is missing or invalid.' });
  const requestId = String(req.query.id || '');
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) return json(res, 400, { error: 'Invalid build ID.' });
  const { GITHUB_OWNER, GITHUB_REPO, GITHUB_WORKFLOW_ID, GITHUB_BUILD_TOKEN } = process.env;
  if (!GITHUB_OWNER || !GITHUB_REPO || !GITHUB_WORKFLOW_ID || !GITHUB_BUILD_TOKEN) return json(res, 503, { error: 'GitHub build service is not configured.' });
  try {
    const url = `https://api.github.com/repos/${encodeURIComponent(GITHUB_OWNER)}/${encodeURIComponent(GITHUB_REPO)}/actions/workflows/${encodeURIComponent(GITHUB_WORKFLOW_ID)}/runs?event=workflow_dispatch&per_page=100`;
    const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${GITHUB_BUILD_TOKEN}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'SETU-build-service' } });
    if (!response.ok) return json(res, 502, { error: `GitHub status request failed (HTTP ${response.status}).` });
    const data = await response.json();
    const run = (data.workflow_runs || []).find(item => item.display_title === `SETU build ${requestId}` || item.name === `SETU build ${requestId}`);
    if (!run) return json(res, 200, { requestId, status: 'queued', message: 'Build request was sent. GitHub Actions may take a short time to start.' });
    const result = { requestId, status: run.status === 'completed' ? (run.conclusion === 'success' ? 'success' : 'failed') : run.status, conclusion: run.conclusion, runUrl: run.html_url, message: run.status === 'completed' ? (run.conclusion === 'success' ? 'Build finished.' : 'Build failed. Open the workflow run for logs.') : 'Native build is running.' };
    if (run.status === 'completed' && run.conclusion === 'success') {
      try { result.artifacts = await listBuildArtifacts(requestId); }
      catch (error) { result.storageWarning = error.message; result.artifacts = []; }
    }
    return json(res, 200, result);
  } catch (error) {
    return json(res, 502, { error: `Could not read build status: ${error.message}` });
  }
}
