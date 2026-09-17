/* CCC Team Portal runtime configuration.
 *
 * API_MODE
 *   "http" : POST JSON (as text/plain) to API_URL. Use "/api" with the local mock
 *            server, or the Apps Script web app URL (https://script.google.com/macros/s/.../exec)
 *            when the site is hosted on GitHub Pages.
 *   "gas"  : the page is served by Apps Script HtmlService; calls go through
 *            google.script.run.api(jsonString). API_URL is ignored.
 *
 * When you change this file on a live site, also bump the ?v= query in index.html
 * and CACHE_VERSION in sw.js so phones pick up the change.
 */
window.CCC_CONFIG = {
  API_MODE: "http",
  API_URL: "https://script.google.com/macros/s/AKfycbzTAotiG1l2zHk16NNn7EdJQt1-04T5h0obp5U-EvJdlj8UpPC3LbhJzRZs9vy0fv9S/exec",
  APP_VERSION: "0.3.1"
};
