import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, ArrowDownToLine, ArrowRight, ArrowUpRight, Box, Check, CheckCircle2,
  ChevronRight, CircleHelp, Code2, Compass, Download, ExternalLink, Eye, FilePlus2,
  FolderOpen, Grid2X2, Layers3, Link2, LockKeyhole, Menu, Moon, Plus, RefreshCw,
  Rocket, Settings, ShieldCheck, Smartphone, Sparkles, Sun, Upload, X, Zap
} from 'lucide-react';
import './styles.css';

const starterApps = [
  { name: 'VOID Portfolio', url: 'https://void.example', platform: 'Android + iOS', status: 'Demo', initials: 'V', updated: 'Sample project' },
  { name: 'Bean & Byte', url: 'https://beanbyte.example', platform: 'Android', status: 'Demo', initials: 'B', updated: 'Sample project' }
];

import { isValidWebsiteUrl, isValidAndroidId, isValidIosBundleId } from './validation.js';

function App() {
  const [activeNav, setActiveNav] = useState('Home');
  const [url, setUrl] = useState('');
  const [appName, setAppName] = useState('My App');
  const [androidId, setAndroidId] = useState('com.example.myapp');
  const [iosId, setIosId] = useState('com.example.myapp');
  const [platform, setPlatform] = useState('both');
  const [analysed, setAnalysed] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [buildMessage, setBuildMessage] = useState('Configure the native build service to generate installable app files.');
  const [appIcon, setAppIcon] = useState('');
  const [splash, setSplash] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [previewPlatform, setPreviewPlatform] = useState('android');
  const [apps, setApps] = useState(starterApps);
  const [toast, setToast] = useState('');
  const [buildAccessKey, setBuildAccessKey] = useState(() => sessionStorage.getItem('setu-build-access-key') || '');
  const [nativeBuildId, setNativeBuildId] = useState('');
  const [nativeBuildStatus, setNativeBuildStatus] = useState('idle');
  const [nativeBuildUrl, setNativeBuildUrl] = useState('');
  const [nativeArtifacts, setNativeArtifacts] = useState([]);
  const [nativeBuildError, setNativeBuildError] = useState('');
  const [publishGooglePlay, setPublishGooglePlay] = useState(false);
  const [publishAppStore, setPublishAppStore] = useState(false);
  const iconInput = useRef(null);
  const splashInput = useRef(null);
  const validUrl = useMemo(() => isValidWebsiteUrl(url), [url]);

  useEffect(() => {
    if (buildAccessKey) sessionStorage.setItem('setu-build-access-key', buildAccessKey);
    else sessionStorage.removeItem('setu-build-access-key');
  }, [buildAccessKey]);

  useEffect(() => {
    const match = window.location.hash.match(/(?:^#|&)setup=([^&]+)/);
    if (!match) return;
    try {
      const shared = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(match[1])))));
      if (shared.websiteUrl && isValidWebsiteUrl(shared.websiteUrl)) setUrl(shared.websiteUrl);
      if (shared.appName) setAppName(shared.appName);
      if (shared.androidPackageId) setAndroidId(shared.androidPackageId);
      if (shared.iosBundleId) setIosId(shared.iosBundleId);
      if (Array.isArray(shared.platforms)) setPlatform(shared.platforms.length > 1 ? 'both' : shared.platforms[0] || 'both');
      setAnalysed(Boolean(shared.websiteUrl && isValidWebsiteUrl(shared.websiteUrl)));
      setBuildMessage('Shared setup loaded from link. Validate the values before exporting.');
    } catch { /* Ignore malformed shared links. */ }
  }, []);

  useEffect(() => {
    if (!nativeBuildId || !buildAccessKey || !['queued', 'in_progress', 'requested', 'waiting'].includes(nativeBuildStatus)) return undefined;
    let cancelled = false;
    let timer;
    const poll = async () => {
      try {
        const response = await fetch(`/api/builds/${encodeURIComponent(nativeBuildId)}`, { headers: { 'x-setu-build-key': buildAccessKey } });
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok) throw new Error(data.error || 'Could not read build status.');
        const status = data.status || 'queued';
        setNativeBuildStatus(status);
        setNativeBuildUrl(data.runUrl || '');
        setNativeArtifacts(data.artifacts || []);
        if (data.error) setNativeBuildError(data.error);
        if (data.storageWarning) setNativeBuildError(data.storageWarning);
        if (status === 'success') setBuildMessage('Native build completed. Download links are ready below.');
        else if (status === 'failed') setBuildMessage('Native build failed. Open the GitHub Actions run for logs.');
        else setBuildMessage('Native build is running in GitHub Actions…');
        if (['queued', 'in_progress', 'requested', 'waiting'].includes(status)) timer = window.setTimeout(poll, 10000);
      } catch (err) {
        if (!cancelled) {
          setNativeBuildError(err.message || 'Could not refresh build status.');
          timer = window.setTimeout(poll, 15000);
        }
      }
    };
    timer = window.setTimeout(poll, 2500);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [nativeBuildId, buildAccessKey]);

  function notify(message) {
    setToast(message);
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setToast(''), 3600);
  }

  function analyseWebsite(event) {
    event?.preventDefault();
    setError('');
    if (!validUrl) {
      setAnalysed(false);
      setError('Enter a valid public URL, including https://');
      return;
    }
    setAnalysed(true);
    setBuildMessage('URL syntax validated. This browser demo does not verify remote reachability or WebView compatibility.');
    if (appName === 'My App') {
      try {
        setAppName(new URL(url).hostname.replace(/^www\./, '').split('.')[0].replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
      } catch { /* URL has already passed validation. */ }
    }
    notify('URL format looks valid. Remote site checks are not performed by this demo.');
  }

  function loadImage(event, target) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { notify('Choose an image file.'); event.target.value = ''; return; }
    const maxBytes = (target === 'icon' ? 2 : 5) * 1024 * 1024;
    if (file.size > maxBytes) { notify(`Image must be ${target === 'icon' ? '2' : '5'} MB or smaller.`); event.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => target === 'icon' ? setAppIcon(String(reader.result)) : setSplash(String(reader.result));
    reader.onerror = () => notify('Could not read that image. Try another file.');
    reader.readAsDataURL(file);
  }

  function resetForm() {
    setUrl(''); setAppName('My App'); setAndroidId('com.example.myapp'); setIosId('com.example.myapp');
    setPlatform('both'); setAnalysed(false); setError(''); setAppIcon(''); setSplash('');
    setBuildMessage('Configure the native build service to generate installable app files.');
    if (iconInput.current) iconInput.current.value = '';
    if (splashInput.current) splashInput.current.value = '';
    notify('Form reset.');
  }

  function prepareProject() {
    setError('');
    if (!validUrl) { setError('Enter a valid website URL before preparing a project.'); notify('A valid website URL is required.'); return; }
    if (!appName.trim()) { notify('Enter an app name.'); return; }
    if (!isValidAndroidId(androidId)) { notify('Android package ID must look like com.example.myapp.'); return; }
    if (!isValidIosBundleId(iosId)) { notify('iOS bundle ID must look like com.example.myapp.'); return; }
    setBusy(true);
    setBuildMessage('Validating configuration…');
    window.setTimeout(() => {
      setBusy(false);
      setBuildMessage('Configuration validated. Export JSON to continue with a native build toolchain.');
      setApps(previous => [{
        name: appName.trim(), url,
        platform: platform === 'both' ? 'Android + iOS' : platform === 'android' ? 'Android' : 'iOS',
        status: 'Configured', initials: appName.trim().slice(0, 1).toUpperCase(), updated: 'Just now'
      }, ...previous.filter(item => item.url !== url)]);
      notify('Configuration is ready. No APK/IPA was compiled.');
    }, 450);
  }

  async function startNativeBuild() {
    setError(''); setNativeBuildError(''); setNativeArtifacts([]); setNativeBuildUrl('');
    if (!buildAccessKey.trim()) { setNativeBuildError('Enter your private SETU build access key. It is stored only in this browser session.'); return; }
    if (!validUrl || !analysed) { setNativeBuildError('Enter a public HTTPS URL and click Validate URL first.'); return; }
    if (new URL(url).protocol !== 'https:') { setNativeBuildError('Native builds currently require an HTTPS website URL.'); return; }
    if (!appName.trim()) { setNativeBuildError('Enter an app name.'); return; }
    if (platform !== 'ios' && !isValidAndroidId(androidId)) { setNativeBuildError('Android package ID is invalid.'); return; }
    if (platform !== 'android' && !isValidIosBundleId(iosId)) { setNativeBuildError('iOS bundle ID is invalid.'); return; }
    setBusy(true); setNativeBuildStatus('requested'); setBuildMessage('Submitting a real native build to GitHub Actions…');
    try {
      const response = await fetch('/api/builds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-setu-build-key': buildAccessKey.trim() },
        body: JSON.stringify({ appName: appName.trim(), websiteUrl: url.trim(), androidPackageId: androidId.trim(), iosBundleId: iosId.trim(), platforms: platform, publishGooglePlay: publishGooglePlay && platform !== 'ios', publishAppStore: publishAppStore && platform !== 'android' })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Build request failed (${response.status}).`);
      setNativeBuildId(data.requestId);
      setNativeBuildStatus(data.status || 'queued');
      setBuildMessage(data.message || 'Build queued in GitHub Actions.');
      setApps(previous => [{ name: appName.trim(), url, platform: platform === 'both' ? 'Android + iOS' : platform === 'android' ? 'Android' : 'iOS', status: 'Building', initials: appName.trim().slice(0, 1).toUpperCase(), updated: 'Build queued', buildId: data.requestId }, ...previous.filter(item => item.url !== url)]);
      notify('Native build queued. Keep this page open to see status.');
    } catch (err) {
      setNativeBuildStatus('failed'); setNativeBuildError(err.message || 'Could not start native build.');
      setBuildMessage('Build request failed. Check the setup guide and backend configuration.');
    } finally { setBusy(false); }
  }

  async function refreshNativeBuild() {
    if (!nativeBuildId || !buildAccessKey) return;
    setNativeBuildError('');
    try {
      const response = await fetch(`/api/builds/${encodeURIComponent(nativeBuildId)}`, { headers: { 'x-setu-build-key': buildAccessKey } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not refresh build status.');
      setNativeBuildStatus(data.status || 'queued'); setNativeBuildUrl(data.runUrl || ''); setNativeArtifacts(data.artifacts || []);
      if (data.storageWarning) setNativeBuildError(data.storageWarning);
      setBuildMessage(data.message || 'Build status updated.');
    } catch (err) { setNativeBuildError(err.message || 'Could not refresh build status.'); }
  }

  async function downloadArtifact(artifact) {
    if (!buildAccessKey) { setNativeBuildError('Enter your private SETU build access key again to download this artifact.'); return; }
    try {
      const response = await fetch(artifact.downloadUrl, { headers: { 'x-setu-build-key': buildAccessKey } });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Could not download artifact.');
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${artifact.filename}.zip`;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
      notify('Artifact download started. Extract the ZIP to get the APK or other build file.');
    } catch (err) {
      setNativeBuildError(err.message || 'Could not download artifact.');
    }
  }

  async function shareArtifact(artifact) {
    const shareUrl = nativeBuildUrl || window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: `${appName} build artifact`, text: `Open the GitHub Actions run to access ${artifact.filename}.`, url: shareUrl });
      else { await navigator.clipboard.writeText(shareUrl); notify('GitHub Actions run link copied.'); }
    } catch (err) {
      if (err.name !== 'AbortError') {
        try { await navigator.clipboard.writeText(shareUrl); notify('GitHub Actions run link copied.'); }
        catch { notify('Could not share this link from this browser.'); }
      }
    }
  }

  function getConfig() {
    return {
      appName: appName.trim(), websiteUrl: url.trim(),
      androidPackageId: androidId.trim(), iosBundleId: iosId.trim(),
      platforms: platform === 'both' ? ['android', 'ios'] : [platform],
      assets: { appIconSelected: Boolean(appIcon), splashScreenSelected: Boolean(splash) },
      exportedAt: new Date().toISOString(),
      buildStatus: 'not-started',
      note: 'This JSON is configuration only. Use Build native app to submit a native build when the Vercel, GitHub Actions, and artifact-storage services are configured.'
    };
  }

  function downloadFile(filename, content, type = 'application/json') {
    const blob = new Blob([content], { type });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl; anchor.download = filename;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }

  function exportConfig() {
    if (!validUrl) { setError('Enter a valid website URL before exporting.'); notify('Website URL is required.'); return; }
    if (!appName.trim()) { notify('Enter an app name.'); return; }
    if ((platform !== 'ios' && !isValidAndroidId(androidId)) || (platform !== 'android' && !isValidIosBundleId(iosId))) {
      notify('Check the package or bundle ID for your selected platform.'); return;
    }
    const config = getConfig();
    downloadFile(`${appName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'app'}-setu-build-config.json`, JSON.stringify(config, null, 2));
    setBuildMessage('Build configuration downloaded. This is not an installable APK/IPA yet.');
    notify('Configuration downloaded. See the publishing guide for the next steps.');
  }

  function shareSetup() {
    if (!validUrl) { setError('Enter a valid website URL before sharing.'); notify('Website URL is required.'); return; }
    const config = getConfig();
    const shareUrl = `${window.location.origin}${window.location.pathname}#setup=${encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(config)))) )}`;
    const shareData = { title: `SETU app setup — ${appName.trim() || 'My App'}`, text: `App setup for ${appName.trim() || 'My App'} (${platform === 'both' ? 'Android + iOS' : platform}). Open SETU to view the setup.`, url: shareUrl };
    if (navigator.share) {
      navigator.share(shareData).then(() => notify('Setup shared.')).catch(error => { if (error.name !== 'AbortError') copyShareLink(shareUrl); });
    } else copyShareLink(shareUrl);
  }

  async function copyShareLink(shareUrl) {
    try { await navigator.clipboard.writeText(shareUrl); notify('Share link copied to clipboard.'); }
    catch { downloadFile('setu-share-link.txt', shareUrl, 'text/plain'); notify('Share link downloaded as a text file.'); }
  }

  function downloadPublishingGuide() {
    const targets = platform === 'both' ? ['Android', 'iOS'] : [platform === 'android' ? 'Android' : 'iOS'];
    const guide = `SETU — ${appName.trim() || 'My App'} publishing checklist

Website: ${url}
Platforms: ${targets.join(' + ')}

IMPORTANT
This guide and config do not contain a compiled or signed mobile app.

ANDROID
1. Create a native wrapper project (for example Capacitor) and configure its server URL.
2. Build and test an APK on devices.
3. Create a signed release AAB for Google Play.
4. Complete Play Console app content, privacy, screenshots, data safety and testing requirements.
5. Upload the AAB in Google Play Console.
Official: https://developer.android.com/studio/publish
Play Console: https://play.google.com/console/

IOS
1. Use macOS with Xcode and a native wrapper project (for example Capacitor).
2. Configure bundle ID, Apple Developer signing and provisioning.
3. Archive and validate the app in Xcode.
4. Upload using Xcode/Transporter and complete App Store Connect metadata and review requirements.
Official: https://developer.apple.com/app-store/submissions/
App Store Connect: https://appstoreconnect.apple.com/

SETU CONFIG
${JSON.stringify(getConfig(), null, 2)}
`;
    downloadFile(`${(appName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'app')}-publishing-guide.txt`, guide, 'text/plain');
    notify('Publishing checklist downloaded.');
  }

  const navItems = [
    { label: 'Home', icon: Compass },
    { label: 'New App', icon: FilePlus2 },
    { label: 'My Apps', icon: Grid2X2 },
    { label: 'Templates', icon: Layers3 },
    { label: 'Settings', icon: Settings },
    { label: 'Docs', icon: CircleHelp }
  ];

  function navigate(label) {
    setActiveNav(label);
    setMobileMenu(false);
    if (label === 'New App' || label === 'Home') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
        <button className="brand" onClick={() => navigate('Home')} aria-label="Setu home">
          <img className="brand-logo" src="/setu-logo.svg" alt="Setu — Web to Mobile" />
        </button>
        <div className="sidebar-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${activeNav === label ? 'active' : ''}`} onClick={() => navigate(label)}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
              {label === 'My Apps' && <span className="nav-count">{apps.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="open-source-mark"><Code2 size={19} /></div>
          <div><strong>Open source</strong><small>Free forever. Self-hostable.</small></div>
          <a href="https://github.com/" target="_blank" rel="noreferrer" aria-label="GitHub" className="tiny-link"><ExternalLink size={15} /></a>
        </div>
      </aside>
      {mobileMenu && <button className="scrim" onClick={() => setMobileMenu(false)} aria-label="Close navigation" />}

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu-button icon-button" onClick={() => setMobileMenu(value => !value)} aria-label="Toggle navigation"><Menu size={19} /></button>
          <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{activeNav}</strong></div>
          <div className="top-actions">
            <span className="open-pill"><i /> OPEN SOURCE · FREE FOREVER</span>
            <a className="github-button" href="https://github.com/" target="_blank" rel="noreferrer"><Code2 size={16} /><span>View on GitHub</span><ArrowUpRight size={14} /></a>
          </div>
        </header>

        {activeNav === 'My Apps' ? (
          <section className="page-section">
            <div className="section-heading"><div><div className="eyebrow">YOUR WORKSPACE</div><h1>Projects, <em>in one place.</em></h1><p>Configurations created in this browser session.</p></div><button className="white-button" onClick={() => navigate('New App')}><Plus size={16} /> New app</button></div>
            <div className="apps-grid">{apps.map((app, index) => <article className="app-card" key={`${app.url}-${index}`}><div className="app-card-top"><span className="app-letter">{app.initials}</span><span className="status">{app.status}</span></div><h3>{app.name}</h3><p>{app.url}</p><div className="app-card-meta"><span><Smartphone size={14} />{app.platform}</span><span>{app.updated}</span></div><button className="outline-button" onClick={() => { setUrl(app.url); setAppName(app.name); setActiveNav('New App'); window.scrollTo({ top: 0, behavior: 'smooth' }); notify('Configuration loaded into the builder.'); }}>Open configuration <ArrowRight size={14} /></button></article>)}</div>
          </section>
        ) : activeNav === 'Templates' || activeNav === 'Settings' || activeNav === 'Docs' ? (
          <section className="page-section secondary-page">
            <div className="eyebrow">{activeNav.toUpperCase()}</div>
            <h1>{activeNav === 'Templates' ? <>A considered start.<br /><em>Never a compromise.</em></> : activeNav === 'Settings' ? <>Your workspace,<br /><em>your rules.</em></> : <>Build with clarity.<br /><em>Ship with confidence.</em></>}</h1>
            <p>{activeNav === 'Templates' ? 'Starter templates are planned for a later contribution. The original website remains the source of truth.' : activeNav === 'Settings' ? 'This local-first demo keeps configuration in the current browser session. No account or subscription is required.' : 'SETU sends native build jobs to GitHub Actions through a protected Vercel API. See README for deployment, artifact storage, signing, and publishing setup.'}</p>
            <div className="notice-card"><Sparkles size={20} /><div><strong>{activeNav === 'Docs' ? 'Honest by design' : 'Open source. Free forever.'}</strong><span>{activeNav === 'Docs' ? 'Android builds run on Linux runners; iOS builds run on macOS runners. Signing and store upload remain opt-in and require your own credentials.' : 'No paywalls, no subscriptions, and no mandatory account.'}</span></div></div>
            <button className="white-button" onClick={() => navigate('Home')}>Back to builder <ArrowRight size={15} /></button>
          </section>
        ) : (
          <>
            <section className="hero">
              <div className="hero-backdrop" aria-hidden="true"><div className="orb orb-one" /><div className="orb orb-two" /><div className="horizon" /></div>
              <div className="hero-copy">
                <div className="eyebrow"><span /> WEB TO MOBILE <b /></div>
                <h1>The Web.<br /><em>Now Mobile.</em><span className="hero-arrow">↗</span></h1>
                <h2>Same UI. Same Features. A mobile experience.</h2>
                <p>Bridge your existing website to mobile.<br className="desktop-break" /> Keep your design. Bring your experience along.</p>
                <div className="hero-tags">
                  <div><Box size={19} /><span><strong>Original UI</strong><small>Your site stays the source</small></span></div>
                  <div><Zap size={19} /><span><strong>Android & iOS</strong><small>One focused workflow</small></span></div>
                  <div><Layers3 size={19} /><span><strong>Open Source</strong><small>Free and self-hostable</small></span></div>
                  <div><ShieldCheck size={19} /><span><strong>Privacy first</strong><small>Your builds, your control</small></span></div>
                </div>
              </div>
              <div className="hero-phones" aria-label="Illustrative mobile app previews">
                <div className="phone phone-back"><div className="phone-status"><span>9:41</span><span>•••</span></div><div className="phone-site-title">bean & byte <Menu size={12} /></div><div className="coffee-image"><span>BEAN<br />& BYTE</span></div><div className="phone-serif">Where Coffee<br />Meets Code.</div><div className="phone-small">A little ritual for big ideas.</div><span className="phone-cta">Explore menu ↗</span></div>
                <div className="phone phone-front"><div className="phone-status"><span>9:41</span><span>•••</span></div><div className="phone-site-title">VOID <Menu size={12} /></div><div className="void-art"><div className="void-sun" /></div><div className="phone-serif">Web into<br />Mobile.</div><div className="phone-small">Digital things that matter.</div><span className="phone-cta">View work ↗</span></div>
                <div className="hero-caption">ANY WEBSITE <span>—</span> ANY APP</div>
              </div>
              <div className="hero-corner">N° 001<br /><span>MAKE IT MOBILE</span></div>
            </section>

            <section className="workspace" id="builder">
              <div className="builder-column">
                <section className="panel url-panel">
                  <div className="panel-heading"><div className="step-number">01</div><div className="panel-title"><h3>Enter website URL</h3><p>Start with the public website you want to bring to mobile.</p></div><span className="panel-state">{analysed ? <><CheckCircle2 size={14} /> URL VALID</> : 'STEP 01 / 03'}</span></div>
                  <form className="url-row" onSubmit={analyseWebsite}>
                    <div className="input-wrap url-input"><Link2 size={17} /><input value={url} onChange={event => { setUrl(event.target.value); setAnalysed(false); setError(''); }} placeholder="https://yourwebsite.com" aria-label="Website URL" autoComplete="url" /></div>
                    <button className="white-button analyse-button" type="submit"><Activity size={16} /> Validate URL <ArrowRight size={15} /></button>
                  </form>
                  {error && <p className="field-error" role="alert">{error}</p>}
                  <div className="check-row">
                    <span className={`check-chip ${analysed ? 'good' : ''}`}><CheckCircle2 size={14} /> URL syntax</span>
                    <span className="check-chip"><Smartphone size={14} /> Mobile check pending</span>
                    <span className="check-chip"><LockKeyhole size={14} /> HTTPS recommended</span>
                    <span className="check-chip"><ShieldCheck size={14} /> Compatibility pending</span>
                  </div>
                  {analysed && <div className="analysis-note"><Check size={14} /> URL syntax is valid. Actual reachability, mobile layout, and WebView compatibility are not tested here.</div>}
                </section>

                <section className="panel config-panel">
                  <div className="panel-heading"><div className="step-number">02</div><div className="panel-title"><h3>App configuration</h3><p>Small details. A considered finish.</p></div><button className="subtle-button" type="button" onClick={resetForm}><RefreshCw size={13} /> Reset</button></div>
                  <div className="config-grid">
                    <div className="fields">
                      <label>App name<input value={appName} onChange={event => setAppName(event.target.value)} placeholder="My App" maxLength={50} /></label>
                      <label>Android package ID<input value={androidId} onChange={event => setAndroidId(event.target.value)} placeholder="com.example.myapp" spellCheck="false" /></label>
                      <label>iOS bundle ID<input value={iosId} onChange={event => setIosId(event.target.value)} placeholder="com.example.myapp" spellCheck="false" /></label>
                    </div>
                    <div className="uploads">
                      <div className="upload-block"><label>App icon <span>PNG / JPG · max 2 MB</span></label><div className="upload-line"><button className="upload-drop" onClick={() => iconInput.current?.click()} type="button">{appIcon ? <img src={appIcon} alt="Selected app icon" /> : <><Upload size={20} /><span><strong>Choose app icon</strong><small>Square image recommended</small></span></>}</button><div className="icon-preview">{appIcon ? <img src={appIcon} alt="App icon preview" /> : <img className="n-mark-img" src="/setu-icon.svg" alt="Setu icon" />}</div></div><input ref={iconInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event => loadImage(event, 'icon')} /></div>
                      <div className="upload-block"><label>Splash screen <span>PNG / JPG · max 5 MB</span></label><div className="upload-line"><button className="upload-drop" onClick={() => splashInput.current?.click()} type="button">{splash ? <img src={splash} alt="Selected splash screen" /> : <><Upload size={20} /><span><strong>Choose splash screen</strong><small>Portrait image recommended</small></span></>}</button><div className="splash-preview">{splash ? <img src={splash} alt="Splash preview" /> : <div className="mini-landscape"><span /></div>}</div></div><input ref={splashInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event => loadImage(event, 'splash')} /></div>
                    </div>
                  </div>
                </section>

                <section className="panel platform-panel">
                  <div className="panel-heading"><div className="step-number">03</div><div className="panel-title"><h3>Choose your platform</h3><p>Choose where you want to take your website.</p></div></div>
                  <div className="platform-options">
                    <button className={`platform-option ${platform === 'android' ? 'selected' : ''}`} onClick={() => setPlatform('android')}><span className="platform-symbol android-symbol">A</span><span><strong>Android</strong><small>APK / AAB workflow</small></span><span className="radio-check">{platform === 'android' && <Check size={12} />}</span></button>
                    <button className={`platform-option ${platform === 'ios' ? 'selected' : ''}`} onClick={() => setPlatform('ios')}><span className="platform-symbol apple-symbol">●</span><span><strong>iOS</strong><small>IPA / Xcode workflow</small></span><span className="radio-check">{platform === 'ios' && <Check size={12} />}</span></button>
                    <button className={`platform-option ${platform === 'both' ? 'selected' : ''}`} onClick={() => setPlatform('both')}><span className="platform-symbol dual-symbol"><span>A</span><span>●</span></span><span><strong>Both platforms</strong><small>Android + iOS</small></span><span className="radio-check">{platform === 'both' && <Check size={12} />}</span></button>
                  </div>
                  <button className="generate-button" onClick={startNativeBuild} disabled={busy}>{busy ? <><RefreshCw size={17} className="spin" /> Queueing build…</> : <><Rocket size={17} /> Build native app <ArrowRight size={17} /></>}</button>
                  <p className="microcopy"><LockKeyhole size={12} /> Native builds run on your configured GitHub Actions runner. Signing and store credentials stay server-side.</p>
                </section>
              </div>

              <aside className="preview-column">
                <section className="panel live-panel">
                  <div className="side-panel-heading"><div className="side-icon"><Eye size={18} /></div><div><h3>Live preview</h3><p>Illustrative mobile frame.</p></div><span className="live-indicator"><i /> PREVIEW</span></div>
                  <div className="device-tabs"><button className={previewPlatform === 'android' ? 'active' : ''} onClick={() => setPreviewPlatform('android')}><Smartphone size={13} /> Android</button><button className={previewPlatform === 'ios' ? 'active' : ''} onClick={() => setPreviewPlatform('ios')}><span className="tiny-apple">●</span> iOS</button></div>
                  <div className={`device ${previewPlatform === 'ios' ? 'ios-device' : ''}`}>
                    <div className="device-notch"><span /></div><div className="device-status"><span>9:41</span><span>▮ ▴ ▰</span></div>
                    <div className="device-sitebar"><span>{appName || 'Your App'}</span><Menu size={16} /></div>
                    <div className="device-visual"><div className="device-moon" /><div className="device-mountain m1" /><div className="device-mountain m2" /></div>
                    <div className="device-content"><div className="device-kicker">{validUrl ? new URL(url).hostname.replace(/^www\./, '') : 'YOUR WEBSITE'}</div><h4>{appName && appName !== 'My App' ? appName : 'Web into'}<br />{appName && appName !== 'My App' ? 'Mobile' : 'Mobile.'}</h4><p>Your website experience,<br />made ready for mobile.</p><span className="device-cta">Explore ↗</span></div>
                    <div className="device-bottom-line" />
                  </div>
                  <div className="preview-foot"><span><i /> Preview responds to your app name</span><button onClick={() => notify('This is an illustrative mockup, not a live rendering of the remote website.')}><Eye size={13} /> About preview</button></div>
                </section>

                <section className="panel output-panel">
                  <div className="side-panel-heading"><div className="side-icon cube"><Box size={19} /></div><div><h3>Build output</h3><p>Native build status</p></div><span className="status">Remote</span></div>
                  <div className="output-message">{buildMessage}</div>
                  <label className="build-key-label">Private build access key <input type="password" value={buildAccessKey} onChange={event => setBuildAccessKey(event.target.value)} placeholder="Enter your Vercel SETU_BUILD_ACCESS_KEY" autoComplete="off" /><small>For self-hosted deployments. Stored in this browser session only; never put GitHub or store credentials here.</small></label>
                  <div className="store-publish-options"><label><input type="checkbox" checked={publishGooglePlay} onChange={event => setPublishGooglePlay(event.target.checked)} disabled={platform === 'ios'} /><span>Upload signed Android AAB to Google Play after build<small>Requires Android release keystore and Play Console service-account secrets.</small></span></label><label><input type="checkbox" checked={publishAppStore} onChange={event => setPublishAppStore(event.target.checked)} disabled={platform === 'android'} /><span>Upload signed iOS IPA to App Store Connect after build<small>Requires Apple signing, provisioning, and App Store Connect API secrets.</small></span></label></div>
                  {nativeBuildError && <div className="build-error" role="alert">{nativeBuildError}</div>}
                  {nativeBuildId && <div className="native-build-status"><div><strong>Build ID</strong><code>{nativeBuildId}</code><span className={`build-status-pill ${nativeBuildStatus}`}>{nativeBuildStatus.replace('_', ' ')}</span></div><button className="outline-button" onClick={refreshNativeBuild}><RefreshCw size={13} /> Refresh status</button>{nativeBuildUrl && <a href={nativeBuildUrl} target="_blank" rel="noreferrer">Open GitHub build logs <ArrowUpRight size={13} /></a>}</div>}
                  {nativeArtifacts.length > 0 && <div className="native-artifacts"><strong>Ready to download</strong>{nativeArtifacts.map(artifact => <div className="native-artifact" key={artifact.filename}><div><Download size={15} /><span>{artifact.filename}<small>{(artifact.size / 1024 / 1024).toFixed(1)} MB · retained for 7 days</small></span></div><button className="artifact-download" onClick={() => downloadArtifact(artifact)}>Download ZIP</button><button className="artifact-share" onClick={() => shareArtifact(artifact)} aria-label={`Share ${artifact.filename}`}><ExternalLink size={14} /></button></div>)}</div>}
                  <div className="output-actions"><button className="download-button" onClick={exportConfig}><Download size={15} /> Download config</button><button className="outline-button" onClick={shareSetup}><ExternalLink size={14} /> Share setup</button><button className="outline-button wide-action" onClick={downloadPublishingGuide}><Rocket size={14} /> Publishing guide</button></div>
                  <div className="output-note"><div className="qr-faux" aria-hidden="true"><div className="qr-grid">{Array.from({ length: 81 }, (_, index) => <i key={index} style={{ opacity: ((index * 7 + (index % 5) * 3) % 11) > 4 ? 1 : .15 }} />)}</div></div><div><strong>Native build service</strong><p>Build jobs run on GitHub Actions. Android produces a debug APK; signed AAB and signed iOS IPA require release credentials. iOS Simulator output is for testing only.</p></div></div>
                </section>
                <div className="side-note"><ShieldCheck size={15} /><span>Transparent by design: a config export is not a compiled mobile app.</span></div>
              </aside>
            </section>
            <footer className="footer"><span>© 2026 SETU COMMUNITY</span><span>PURE BLACK <i /> INKWELL VELVET <i /> TITANIUM WHITE</span><a href="https://github.com/" target="_blank" rel="noreferrer">CONTRIBUTE <ArrowUpRight size={12} /></a></footer>
          </>
        )}
      </main>
      {toast && <div className="toast" role="status"><CheckCircle2 size={17} /><span>{toast}</span><button onClick={() => setToast('')} aria-label="Dismiss notification"><X size={14} /></button></div>}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
