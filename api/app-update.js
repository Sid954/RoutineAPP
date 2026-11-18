/**
 * In-app updater backend.
 *
 *   GET /api/app-update            -> latest release metadata (JSON)
 *   GET /api/app-update?download=1 -> 302 to a short-lived download link for the APK
 *
 * Source of truth is the latest GitHub release that CI published (it only exists once
 * the signed APK is uploaded, so the app never sees an update it cannot download yet).
 * Works for public AND private repos: set GITHUB_TOKEN on Vercel to a fine-grained token
 * with read-only "Contents" access to this repository. The APK bytes never pass through
 * Vercel: GitHub answers the asset request with a pre-signed CDN URL, which we redirect to.
 *
 * Env: GITHUB_TOKEN (needed once the repo is private), GITHUB_REPO (default Sid954/RoutineAPP)
 */
const { applyCors } = require('./_lib/cors.js');
const { guard } = require('./_lib/security.js');

const REPO = process.env.GITHUB_REPO || 'Sid954/RoutineAPP';
const ASSET_NAME = 'app-release.apk';
const GH = 'https://api.github.com';

function ghHeaders(accept = 'application/vnd.github+json') {
  const h = { Accept: accept, 'User-Agent': 'routine-app-updater', 'X-GitHub-Api-Version': '2022-11-28' };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

async function gh(path, accept) {
  const res = await fetch(`${GH}${path}`, { headers: ghHeaders(accept) });
  if (!res.ok) {
    const err = new Error(`GitHub ${res.status} for ${path}`);
    err.status = res.status;
    throw err;
  }
  return accept && accept.includes('raw') ? res.text() : res.json();
}

async function latestRelease() {
  const rel = await gh(`/repos/${REPO}/releases/latest`);
  const asset = (rel.assets || []).find(a => a.name === ASSET_NAME);
  if (!asset) {
    const err = new Error('Latest release has no APK yet');
    err.status = 404;
    throw err;
  }
  return { rel, asset };
}

/** version.json as it was at the release tag (versionCode lives there, not in the tag). */
async function versionAtTag(tag) {
  try {
    const raw = await gh(`/repos/${REPO}/contents/version.json?ref=${encodeURIComponent(tag)}`, 'application/vnd.github.raw+json');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function sha256Of(asset) {
  const d = String(asset.digest || '');
  return d.startsWith('sha256:') ? d.slice(7).toLowerCase() : '';
}

module.exports = async (req, res) => {
  if (applyCors(req, res, 'GET,OPTIONS')) return;
  if (guard(req, res, 'app-update', { read: { max: 30, windowMs: 60 * 1000 } })) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const wantsDownload = req.query && (req.query.download === '1' || req.query.download === 'true');

  try {
    const { rel, asset } = await latestRelease();

    if (wantsDownload) {
      // Ask GitHub for the binary; it replies 302 with a pre-signed URL (valid a few minutes)
      const r = await fetch(asset.url, { headers: ghHeaders('application/octet-stream'), redirect: 'manual' });
      const location = r.headers.get('location');
      if ((r.status === 301 || r.status === 302 || r.status === 307) && location) {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Location', location);
        return res.status(302).end();
      }
      // Public repos may also be served straight from browser_download_url
      if (asset.browser_download_url && !process.env.GITHUB_TOKEN) {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Location', asset.browser_download_url);
        return res.status(302).end();
      }
      return res.status(502).json({ error: `Could not get a download link (GitHub ${r.status}).` });
    }

    const tag = rel.tag_name || '';
    const ver = (await versionAtTag(tag)) || {};
    const versionName = ver.versionName || tag.replace(/^v/i, '');
    const versionCode = Number(ver.versionCode) || 0;
    const host = req.headers['x-forwarded-host'] || req.headers.host || '';
    const base = host ? `https://${host}` : '';

    // Edge-cache: every client checks on launch; GitHub's API has rate limits
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900');
    return res.status(200).json({
      versionCode,
      versionName,
      minRequiredVersionCode: Number(ver.minRequiredVersionCode) || 0,
      summary: ver.releaseNotes || '',
      notes: String(rel.body || '').slice(0, 6000),
      publishedAt: rel.published_at || '',
      size: asset.size || 0,
      sha256: sha256Of(asset),
      downloadUrl: `${base}/api/app-update?download=1&v=${versionCode || encodeURIComponent(versionName)}`
    });
  } catch (err) {
    const status = err.status === 404 ? 404 : 502;
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    return res.status(status).json({
      error: err.status === 404
        ? 'No published release found.'
        : (err.status === 401 || err.status === 403)
          ? 'Update server cannot read the repository (check GITHUB_TOKEN on Vercel).'
          : 'Update server could not reach GitHub.'
    });
  }
};
