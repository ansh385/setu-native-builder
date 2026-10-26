import crypto from 'node:crypto';

export function json(res, status, data) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8').send(JSON.stringify(data));
}

export function checkAccess(req) {
  const expected = process.env.SETU_BUILD_ACCESS_KEY;
  const provided = req.headers['x-setu-build-key'];
  if (!expected || !provided) return false;
  const a = Buffer.from(String(expected));
  const b = Buffer.from(String(provided));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function checkOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // CLI/automation requests still require the access key.
  const allowed = (process.env.SETU_ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
  if (allowed.length === 0) return false;
  return allowed.includes(origin);
}

export function validatePayload(body = {}) {
  const appName = String(body.appName || '').trim();
  const websiteUrl = String(body.websiteUrl || '').trim();
  const platforms = String(body.platforms || '');
  const androidPackageId = String(body.androidPackageId || '').trim();
  const iosBundleId = String(body.iosBundleId || '').trim();
  let parsed;
  try { parsed = new URL(websiteUrl); } catch { throw new Error('Enter a valid public website URL.'); }
  if (parsed.protocol !== 'https:' || !parsed.hostname.includes('.')) throw new Error('Website URL must use public HTTPS for a native build.');
  if (!appName || appName.length > 50) throw new Error('App name is required and must be 50 characters or fewer.');
  if (!['android', 'ios', 'both'].includes(platforms)) throw new Error('Choose Android, iOS, or both.');
  const idPattern = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/;
  if (platforms !== 'ios' && !idPattern.test(androidPackageId)) throw new Error('Android package ID is invalid.');
  if (platforms !== 'android' && !idPattern.test(iosBundleId)) throw new Error('iOS bundle ID is invalid.');
  return {
    appName,
    websiteUrl,
    platforms,
    androidPackageId,
    iosBundleId,
    publishGooglePlay: body.publishGooglePlay === true,
    publishAppStore: body.publishAppStore === true
  };
}
