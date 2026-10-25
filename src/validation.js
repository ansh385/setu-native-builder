export function isValidWebsiteUrl(value) {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) && parsed.hostname.includes('.');
  } catch { return false; }
}

export function isValidAndroidId(value) {
  return /^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*){2,}$/.test(value);
}

export function isValidIosBundleId(value) {
  return /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+){2,}$/.test(value);
}
