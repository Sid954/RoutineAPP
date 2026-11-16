/**
 * Shared CORS handling for every api/* function.
 * The app calls the API from GitHub Pages, the Capacitor WebView (https://localhost) and
 * Vercel itself, and never sends cookies (passwords travel in the JSON body), so a
 * wildcard origin without Access-Control-Allow-Credentials is correct. Note that
 * `*` combined with Allow-Credentials: true is rejected by browsers anyway.
 */
const ALLOWED_HEADERS = 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization';

/**
 * Sets CORS headers and answers preflight requests.
 * @param {string} methods comma-separated allowed methods, e.g. 'GET,OPTIONS'
 * @returns {boolean} true when the request was an OPTIONS preflight and has been answered
 */
function applyCors(req, res, methods) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

module.exports = { applyCors };
