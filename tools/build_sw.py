"""Пересобирает sw.js: список файлов для офлайн-кэша и версию кэша.

Запускать после любых изменений в приложении:  python tools/build_sw.py
"""
import hashlib, os, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
FILES = ["./", "index.html", "styles.css", "manifest.webmanifest"]
for folder in ["js", "img", "icons"]:
    FILES += sorted(p.relative_to(ROOT).as_posix() for p in (ROOT / folder).iterdir() if p.is_file())

h = hashlib.sha1()
for f in FILES[1:]:
    h.update((ROOT / f).read_bytes())
version = h.hexdigest()[:10]

assets = ",\n  ".join(f'"{f}"' for f in FILES)
(ROOT / "sw.js").write_text(f"""// Сгенерировано tools/build_sw.py — не редактировать вручную.
const CACHE = "trenirovki-{version}";
const ASSETS = [
  {assets}
];

self.addEventListener("install", (e) => {{
  // cache: "reload" — мимо HTTP-кэша браузера, иначе новая версия может собраться из старых файлов
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(ASSETS.map((u) => new Request(u, {{ cache: "reload" }}))))
    .then(() => self.skipWaiting()));
}});

self.addEventListener("activate", (e) => {{
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
}});

// Сначала кэш (работает в зале без интернета), иначе сеть
self.addEventListener("fetch", (e) => {{
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request, {{ ignoreSearch: true }}).then((hit) => hit || fetch(e.request)));
}});
""", encoding="utf-8")
print(f"sw.js: {len(FILES)} файлов, версия {version}")
