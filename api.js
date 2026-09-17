/* CCC Team Portal API client.
 *
 * CCCApi.call(action, payload) always RESOLVES (never rejects) with the parsed
 * response object: {ok:true, ...} or {ok:false, error:{code, message, ...}}.
 * Network trouble, timeouts and unreadable responses become
 * {ok:false, error:{code:"NETWORK"}} so the UI has one thing to check.
 */
(function (root) {
  "use strict";

  var TIMEOUT_MS = 20000;
  /* Sending a request can wait up to 10 seconds for the Apps Script lock, then writes
     the sheet and posts to Slack, so it gets longer before the app gives up. */
  var REQUEST_TIMEOUT_MS = 45000;

  function netError(message) {
    return { ok: false, error: { code: "NETWORK", message: message || "network error" } };
  }

  function parseResponse(text) {
    var data;
    try {
      data = typeof text === "string" ? JSON.parse(text) : text;
    } catch (e) {
      return netError("response was not JSON");
    }
    if (!data || typeof data !== "object" || typeof data.ok !== "boolean") {
      return netError("response had no ok field");
    }
    if (data.ok === false && (!data.error || typeof data.error.code !== "string")) {
      return { ok: false, error: { code: "SERVER", message: "error without code" } };
    }
    return data;
  }

  function buildBody(action, payload) {
    var body = {};
    if (payload && typeof payload === "object") {
      Object.keys(payload).forEach(function (k) {
        body[k] = payload[k];
      });
    }
    body.action = action;
    return JSON.stringify(body);
  }

  function httpTransport(url, bodyString, timeoutMs) {
    if (typeof fetch !== "function") return Promise.resolve(netError("fetch unavailable"));
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer = null;
    var timeout = new Promise(function (resolve) {
      timer = setTimeout(function () {
        if (controller) controller.abort();
        resolve(netError("timeout"));
      }, timeoutMs);
    });
    var request = fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: bodyString,
      redirect: "follow",
      cache: "no-store",
      credentials: "omit",
      signal: controller ? controller.signal : undefined
    })
      .then(function (res) {
        return res.text();
      })
      .then(parseResponse, function () {
        return netError("fetch failed");
      });
    return Promise.race([request, timeout]).then(function (result) {
      clearTimeout(timer);
      return result;
    });
  }

  function gasTransport(bodyString, timeoutMs) {
    return new Promise(function (resolve) {
      var done = false;
      function finish(v) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(v);
      }
      var timer = setTimeout(function () {
        finish(netError("timeout"));
      }, timeoutMs);
      try {
        root.google.script.run
          .withSuccessHandler(function (s) {
            finish(parseResponse(s));
          })
          .withFailureHandler(function () {
            finish(netError("google.script.run failed"));
          })
          .api(bodyString);
      } catch (e) {
        finish(netError("google.script.run unavailable"));
      }
    });
  }

  function timeoutFor(action) {
    return action === "request" ? REQUEST_TIMEOUT_MS : TIMEOUT_MS;
  }

  function call(action, payload) {
    var cfg = root.CCC_CONFIG || {};
    var body = buildBody(action, payload);
    var timeoutMs = timeoutFor(action);
    try {
      if (cfg.API_MODE === "gas") return gasTransport(body, timeoutMs);
      return httpTransport(cfg.API_URL || "/api", body, timeoutMs);
    } catch (e) {
      return Promise.resolve(netError("call threw"));
    }
  }

  root.CCCApi = {
    call: call,
    parseResponse: parseResponse,
    buildBody: buildBody,
    timeoutFor: timeoutFor,
    TIMEOUT_MS: TIMEOUT_MS
  };
})(window);
