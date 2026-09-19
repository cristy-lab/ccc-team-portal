/* CCC Team Portal API client.
 *
 * CCCApi.call(action, payload) always RESOLVES (never rejects) with the parsed
 * response object: {ok:true, ...} or {ok:false, error:{code, message, ...}}.
 * Network trouble, timeouts and unreadable responses become
 * {ok:false, error:{code:"NETWORK"}} so the UI has one thing to check.
 *
 * Apps Script sometimes answers with an error page (no JSON, no CORS header) even
 * after the script ran, so ping, dashboard, request, wish and the four Education calls
 * try once more after a NETWORK failure. A request sends the same client_request_id both
 * times, and the backend returns the saved request instead of adding a second one. The
 * Education writes carry one too. Login is never retried: a second try could count as one
 * more failed sign in.
 *
 * Messages (0.3.6, docs/API.md 1 and 14): messages_list, messages_thread, messages_send, messages_hide and
 * messages_photo try once more too. A send keeps its client_msg_id, so it is saved once, and a hide of a
 * hidden message only answers already. A send or a hide waits 45 seconds, a send with a photo 90 (two
 * uploads before the lock). messages_poll is never tried again (the next poll comes soon) and waits 20.
 */
(function (root) {
  "use strict";

  var TIMEOUT_MS = 35000;
  /* Sending a request can wait up to 10 seconds for the Apps Script lock, then writes
     the sheet and posts to Slack, so it gets longer before the app gives up. The three
     Education writes take the same lock and do the same work. */
  var REQUEST_TIMEOUT_MS = 45000;
  var SLOW_ACTIONS = { request: 1, training_start: 1, training_submit: 1, training_ack: 1, messages_send: 1, messages_hide: 1 };
  var PHOTO_TIMEOUT_MS = 90000;
  var POLL_TIMEOUT_MS = 20000;
  var RETRY_DELAY_MS = 1500;
  /* A wish is safe to send twice too: the same emoji to the same person on the same day is saved
     once. So are the Education calls: trainings only reads, and the three writes carry a
     client_request_id, so the backend answers with what it already saved. */
  var RETRY_ACTIONS = { ping: 1, dashboard: 1, request: 1, wish: 1, trainings: 1, training_start: 1, training_submit: 1, training_ack: 1,
    messages_list: 1, messages_thread: 1, messages_send: 1, messages_hide: 1, messages_photo: 1 };

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

  function timeoutFor(action, payload) {
    if (action === "messages_poll") return POLL_TIMEOUT_MS;
    if (action === "messages_send" && payload && payload.photo) return PHOTO_TIMEOUT_MS;
    return SLOW_ACTIONS[action] === 1 ? REQUEST_TIMEOUT_MS : TIMEOUT_MS;
  }

  function shouldRetry(action, res) {
    return RETRY_ACTIONS[action] === 1 && !!res && res.ok === false && !!res.error && res.error.code === "NETWORK";
  }

  function send(cfg, body, timeoutMs) {
    try {
      if (cfg.API_MODE === "gas") return gasTransport(body, timeoutMs);
      return httpTransport(cfg.API_URL || "/api", body, timeoutMs);
    } catch (e) {
      return Promise.resolve(netError("call threw"));
    }
  }

  function call(action, payload) {
    var cfg = root.CCC_CONFIG || {};
    var body = buildBody(action, payload);
    var timeoutMs = timeoutFor(action, payload);
    return send(cfg, body, timeoutMs).then(function (res) {
      if (!shouldRetry(action, res)) return res;
      return new Promise(function (resolve) {
        setTimeout(resolve, RETRY_DELAY_MS);
      }).then(function () {
        return send(cfg, body, timeoutMs); // the same body, so a request or a message keeps its id
      });
    });
  }

  root.CCCApi = {
    call: call,
    parseResponse: parseResponse,
    buildBody: buildBody,
    timeoutFor: timeoutFor,
    shouldRetry: shouldRetry,
    TIMEOUT_MS: TIMEOUT_MS,
    RETRY_DELAY_MS: RETRY_DELAY_MS
  };
})(window);
