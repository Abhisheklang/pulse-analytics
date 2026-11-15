/*
 * Pulse Analytics — Web Vitals add-on (optional)
 *
 * Include this script alongside the standard Pulse tracking script:
 *
 *   <script async src="https://your-pulse-server/script.js" data-website-id="..."></script>
 *   <script async src="https://your-pulse-server/pulse-vitals.js"></script>
 *
 * It measures Core Web Vitals (LCP, INP, CLS, plus FCP and TTFB) in the
 * visitor's browser and reports each one as a "pulse.webvital" custom event
 * through the standard collection endpoint, with event data
 * { metric, value, path }. It does not modify the main tracker and sets no
 * cookies.
 */
(function () {
  'use strict';

  var trackerScript =
    document.querySelector('script[data-website-id]') || document.currentScript;
  if (!trackerScript) return;

  var websiteId = trackerScript.getAttribute('data-website-id');
  if (!websiteId) return;

  var endpoint = '/api/send';
  try {
    if (trackerScript.src) {
      endpoint = new URL('/api/send', trackerScript.src).href;
    }
  } catch (e) {
    /* keep relative fallback */
  }

  var values = {}; // metric -> latest value
  var reported = {};

  function report(metric, value) {
    values[metric] = value;
  }

  function send(metric) {
    if (reported[metric] || values[metric] == null) return;
    reported[metric] = true;

    var payload = {
      type: 'event',
      payload: {
        website: websiteId,
        url: location.href,
        referrer: document.referrer || '',
        hostname: location.hostname,
        name: 'pulse.webvital',
        data: {
          metric: metric,
          value: metric === 'cls' ? Math.round(values[metric] * 1000) / 1000 : Math.round(values[metric]),
          path: location.pathname,
        },
      },
    };

    try {
      fetch(endpoint, {
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

  function flush() {
    Object.keys(values).forEach(send);
  }

  function observe(type, callback, options) {
    try {
      var po = new PerformanceObserver(callback);
      po.observe(Object.assign({ type: type, buffered: true }, options || {}));
      return po;
    } catch (e) {
      return null;
    }
  }

  // TTFB + FCP from navigation / paint timing
  try {
    var nav = performance.getEntriesByType('navigation')[0];
    if (nav) report('ttfb', nav.responseStart);
  } catch (e) {}
  observe('paint', function (list) {
    list.getEntries().forEach(function (entry) {
      if (entry.name === 'first-contentful-paint') report('fcp', entry.startTime);
    });
  });

  // LCP
  observe('largest-contentful-paint', function (list) {
    var entries = list.getEntries();
    var last = entries[entries.length - 1];
    if (last) report('lcp', last.startTime);
  });

  // CLS (session-window accumulation, simplified)
  var clsValue = 0;
  var sessionValue = 0;
  var sessionEntries = [];
  observe('layout-shift', function (list) {
    list.getEntries().forEach(function (entry) {
      if (entry.hadRecentInput) return;
      var first = sessionEntries[0];
      var last = sessionEntries[sessionEntries.length - 1];
      if (sessionValue && first && last &&
          entry.startTime - last.startTime < 1000 &&
          entry.startTime - first.startTime < 5000) {
        sessionValue += entry.value;
        sessionEntries.push(entry);
      } else {
        if (sessionValue > clsValue) clsValue = sessionValue;
        sessionValue = entry.value;
        sessionEntries = [entry];
      }
      if (sessionValue > clsValue) clsValue = sessionValue;
      report('cls', clsValue);
    });
  });

  // INP (worst interaction duration, simplified from event timing)
  var interactions = {};
  observe('event', function (list) {
    list.getEntries().forEach(function (entry) {
      if (!entry.interactionId) return;
      var current = interactions[entry.interactionId] || 0;
      if (entry.duration > current) {
        interactions[entry.interactionId] = entry.duration;
        var worst = 0;
        Object.keys(interactions).forEach(function (id) {
          if (interactions[id] > worst) worst = interactions[id];
        });
        report('inp', worst);
      }
    });
  }, { durationThreshold: 40 });

  // Final values are sent when the page is hidden or unloaded.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
})();
