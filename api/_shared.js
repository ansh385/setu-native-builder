import crypto from 'node:crypto';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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

export function s3Client() {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey || !process.env.R2_BUCKET) return null;
  return new S3Client({ region: 'auto', endpoint, credentials: { accessKeyId, secretAccessKey } });
}

export async function listBuildArtifacts(requestId) {
  const client = s3Client();
  if (!client) throw new Error('Artifact storage is not configured. Set the R2 environment variables in Vercel.');
  const bucket = process.env.R2_BUCKET;
  const result = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: `builds/${requestId}/` }));
  const objects = result.Contents || [];
  const artifacts = [];
  for (const item of objects) {
    if (!item.Key || item.Key.endsWith('/')) continue;
    const filename = item.Key.split('/').pop();
    const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: item.Key, ResponseContentDisposition: `attachment; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}"` }), { expiresIn: 60 * 60 });
    artifacts.push({ filename, size: item.Size || 0, downloadUrl: url, expiresInSeconds: 3600 });
  }
  return artifacts;
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
  return { appName, websiteUrl, platforms, androidPackageId, iosBundleId };
}
