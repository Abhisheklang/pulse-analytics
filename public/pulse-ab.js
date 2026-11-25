/*
 * Pulse Analytics — A/B testing add-on (optional)
 *
 * Include this script alongside the standard Pulse tracking script:
 *
 *   <script async src="https://your-pulse-server/script.js" data-website-id="..."></script>
 *   <script async src="https://your-pulse-server/pulse-ab.js"></script>
 *
 * For every experiment currently running on the website it assigns the
 * visitor to a variant (deterministically, from a persistent random visitor
 * id kept in localStorage), reports an "experiment.exposure" event with data
 * { experiment, variant } through the standard collection endpoint, and
 * exposes the assignment as window.pulseAb.getVariant(experimentKey) and as
 * a "data-pulse-ab-<key>" attribute on <html>. It does not modify the main
 * tracker and sets no cookies.
 */
(function () {
  'use strict';

  var trackerScript = document.querySelector('script[data-website-id]') || document.currentScript;
  if (!trackerScript) return;

  var websiteId = trackerScript.getAttribute('data-website-id');
  if (!websiteId) return;

  var base = '';
  try {
    if (trackerScript.src) base = new URL('/', trackerScript.src).href.replace(/\/$/, '');
  } catch (e) {
    /* keep relative fallback */
  }

  function hashString(str) {
    var h = 5381;
    var i;
    for (i = 0; i < str.length; i++) {
      h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    }
    return h;
  }

  function visitorId() {
    var key = 'pulse-ab-visitor';
    var id;
    try {
      id = window.localStorage.getItem(key);
      if (!id) {
        id =
          'v' +
          Math.random().toString(36).slice(2, 10) +
          Date.now().toString(36);
        window.localStorage.setItem(key, id);
      }
      return id;
    } catch (e) {
      return 'anonymous';
    }
  }

  var assignments = {};

  function sendExposure(experiment, variant) {
    var payload = {
      type: 'event',
      payload: {
        website: websiteId,
        url: location.href,
        referrer: document.referrer || '',
        hostname: location.hostname,
        name: 'experiment.exposure',
        data: { experiment: experiment, variant: variant },
      },
    };
    try {
      fetch(base + '/api/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
        credentials: 'omit',
      }).catch(function () {});
    } catch (e) {
      /* never break the host page */
    }
  }

  function assign(experiment, vid) {
    var storeKey = 'pulse-ab-' + experiment.key;
    var stored;
    var i;
    try {
      stored = window.localStorage.getItem(storeKey);
      if (stored) return stored;
    } catch (e) {
      /* fall through to deterministic assignment */
    }

    var total = 0;
    experiment.variants.forEach(function (v) {
      total += v.weight || 0;
    });
    if (!total) return null;

    var bucket = hashString(websiteId + ':' + experiment.key + ':' + vid) % total;
    var chosen = experiment.variants[experiment.variants.length - 1].key;
    for (i = 0; i < experiment.variants.length; i++) {
      bucket -= experiment.variants[i].weight || 0;
      if (bucket < 0) {
        chosen = experiment.variants[i].key;
        break;
      }
    }

    try {
      window.localStorage.setItem(storeKey, chosen);
    } catch (e) {
      /* storage unavailable; assignment still applies for this load */
    }
    return chosen;
  }

  window.pulseAb = {
    getVariant: function (experimentKey) {
      return assignments[experimentKey] || null;
    },
    getAssignments: function () {
      return Object.assign({}, assignments);
    },
  };

  fetch(base + '/api/pulse/experiments/config?website=' + encodeURIComponent(websiteId), {
    credentials: 'omit',
  })
    .then(function (res) {
      return res.ok ? res.json() : null;
    })
    .then(function (json) {
      if (!json || !json.experiments) return;
      var vid = visitorId();
      json.experiments.forEach(function (experiment) {
        var variant = assign(experiment, vid);
        if (!variant) return;
        assignments[experiment.key] = variant;
        try {
          document.documentElement.setAttribute(
            'data-pulse-ab-' + experiment.key,
            variant,
          );
        } catch (e) {
          /* ignore */
        }
        sendExposure(experiment.key, variant);
      });
    })
    .catch(function () {
      /* never break the host page */
    });
})();
