/* VYBORA offline shell. Never cache authenticated API responses or private user data. */
'use strict';
const CACHE_NAME = 'vybora-shell-v1';
const SHELL = ['/', '/index.html', '/social-features.js'];
const SUPABASE_SCRIPT = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(SHELL.map(async path => {
      try { await cache.add(new Request(path, { cache: 'reload' })); } catch (_) {}
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('vybora-shell-') && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Cache only the public Supabase client library, never API/auth/database responses.
  if (url.origin !== self.location.origin && url.href.startsWith('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response.ok || response.type === 'opaque') await cache.put(request, response.clone());
        return response;
      } catch (_) {
        return (await cache.match(request)) || Response.error();
      }
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.put('/', response.clone());
          await cache.put('/index.html', response.clone());
        }
        return response;
      } catch (_) {
        return (await cache.match(request)) || (await cache.match('/index.html')) || new Response(
          '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>VYBORA offline</title><main style="font:16px system-ui;padding:24px;background:#080810;color:#f8f7ff;min-height:90vh"><h1>VYBORA</h1><p>You are offline. Reconnect to load the latest feed and community features.</p><button onclick="location.reload()">Try again</button></main>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
    })());
    return;
  }

  if (url.pathname === '/social-features.js') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      const update = fetch(request).then(response => {
        if (response.ok) cache.put(request, response.clone());
        return response;
      });
      if (cached) { event.waitUntil(update.catch(() => {})); return cached; }
      try { return await update; } catch (_) { return Response.error(); }
    })());
  }
});
