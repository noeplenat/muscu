/* Service worker : un script que le navigateur garde en arrière-plan.
   Il met les fichiers de l'appli en cache pour qu'elle s'ouvre sans réseau.
   Il ne touche jamais à tes données (elles sont dans le localStorage). */

const CACHE = 'muscu-cache-v1';
const FICHIERS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

// Installation : on télécharge tous les fichiers une première fois.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FICHIERS)).then(() => self.skipWaiting())
  );
});

// Activation : on supprime les anciens caches s'il y en a.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((noms) => Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// À chaque demande de fichier : on répond tout de suite avec la copie en cache,
// et on télécharge en arrière-plan la version la plus récente pour la prochaine ouverture.
self.addEventListener('fetch', (event) => {
  const requete = event.request;
  if (requete.method !== 'GET' || new URL(requete.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(requete, { ignoreSearch: true }).then((enCache) => {
        const reseau = fetch(requete)
          .then((reponse) => {
            if (reponse && reponse.ok) cache.put(requete, reponse.clone());
            return reponse;
          })
          .catch(() => enCache);
        if (enCache) {
          event.waitUntil(reseau);
          return enCache;
        }
        return reseau;
      })
    )
  );
});
