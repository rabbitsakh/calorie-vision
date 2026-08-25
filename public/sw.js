/* eslint-disable no-restricted-globals */

/** Derive Next.js basePath from where this SW is registered (`…/sw.js`). */
function swBasePath() {
  const path = self.location.pathname || "";
  if (path.endsWith("/sw.js")) {
    return path.slice(0, -"/sw.js".length);
  }
  return "";
}

function withBase(path) {
  const base = swBasePath();
  if (!path.startsWith("/")) {
    return `${base}/${path}`;
  }
  return `${base}${path}`;
}

const CACHE_NAME = "cv-shell-v1";

/** App shell + static icons. Trailing-slash variants match next.config trailingSlash. */
function precacheUrls() {
  return [
    withBase("/"),
    withBase("/ration"),
    withBase("/ration/"),
    withBase("/manifest.json"),
    withBase("/icon-192.png"),
    withBase("/icon-512.png"),
    withBase("/apple-icon.png"),
  ];
}

function isShellPath(pathname) {
  const ration = withBase("/ration");
  return (
    pathname === withBase("/") ||
    pathname === ration ||
    pathname === `${ration}/` ||
    pathname === withBase("/manifest.json") ||
    pathname === withBase("/icon-192.png") ||
    pathname === withBase("/icon-512.png") ||
    pathname === withBase("/apple-icon.png")
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.all(
          precacheUrls().map((url) =>
            cache.add(url).catch(() => {
              // Missing asset or offline during install — skip, do not fail SW install.
            }),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!isShellPath(url.pathname)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      try {
        const response = await fetch(request);
        if (response.ok) {
          void cache.put(request, response.clone());
        }
        return response;
      } catch {
        if (cached) return cached;
        throw new Error("offline");
      }
    }),
  );
});

self.addEventListener("push", (event) => {
  let data = { title: "Calorie Vision", body: "Напоминание", url: withBase("/") };
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch {
    // use defaults
  }

  const targetUrl = data.url ?? withBase("/");

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: withBase("/icon-192.png"),
      badge: withBase("/icon-192.png"),
      tag: data.tag ?? "cv-reminder",
      data: { url: targetUrl },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? withBase("/");
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    }),
  );
});
