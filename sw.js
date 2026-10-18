// Сгенерировано tools/build_sw.py — не редактировать вручную.
const CACHE = "trenirovki-c0150bd63c";
const ASSETS = [
  "./",
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "js/app.js",
  "js/data.js",
  "js/export.js",
  "js/muscles.js",
  "js/store.js",
  "img/Ab_Crunch_Machine-0.jpg",
  "img/Ab_Crunch_Machine-1.jpg",
  "img/Ab_Roller-0.jpg",
  "img/Ab_Roller-1.jpg",
  "img/Band_Assisted_Pull-Up-0.jpg",
  "img/Band_Assisted_Pull-Up-1.jpg",
  "img/Barbell_Bench_Press_-_Medium_Grip-0.jpg",
  "img/Barbell_Bench_Press_-_Medium_Grip-1.jpg",
  "img/Cable_Crunch-0.jpg",
  "img/Cable_Crunch-1.jpg",
  "img/Dips_-_Triceps_Version-0.jpg",
  "img/Dips_-_Triceps_Version-1.jpg",
  "img/Dumbbell_Bench_Press-0.jpg",
  "img/Dumbbell_Bench_Press-1.jpg",
  "img/Dumbbell_Bicep_Curl-0.jpg",
  "img/Dumbbell_Bicep_Curl-1.jpg",
  "img/Dumbbell_Lunges-0.jpg",
  "img/Dumbbell_Lunges-1.jpg",
  "img/Dumbbell_Shoulder_Press-0.jpg",
  "img/Dumbbell_Shoulder_Press-1.jpg",
  "img/Elliptical_Trainer-0.jpg",
  "img/Elliptical_Trainer-1.jpg",
  "img/Face_Pull-0.jpg",
  "img/Face_Pull-1.jpg",
  "img/Goblet_Squat-0.jpg",
  "img/Goblet_Squat-1.jpg",
  "img/Hammer_Curls-0.jpg",
  "img/Hammer_Curls-1.jpg",
  "img/Hyperextensions_Back_Extensions-0.jpg",
  "img/Hyperextensions_Back_Extensions-1.jpg",
  "img/Incline_Dumbbell_Press-0.jpg",
  "img/Incline_Dumbbell_Press-1.jpg",
  "img/Knee_Hip_Raise_On_Parallel_Bars-0.jpg",
  "img/Knee_Hip_Raise_On_Parallel_Bars-1.jpg",
  "img/Leg_Press-0.jpg",
  "img/Leg_Press-1.jpg",
  "img/Leverage_Incline_Chest_Press-0.jpg",
  "img/Leverage_Incline_Chest_Press-1.jpg",
  "img/Leverage_Iso_Row-0.jpg",
  "img/Leverage_Iso_Row-1.jpg",
  "img/Lying_Leg_Curls-0.jpg",
  "img/Lying_Leg_Curls-1.jpg",
  "img/Machine_Shoulder_Military_Press-0.jpg",
  "img/Machine_Shoulder_Military_Press-1.jpg",
  "img/One-Arm_Dumbbell_Row-0.jpg",
  "img/One-Arm_Dumbbell_Row-1.jpg",
  "img/Pallof_Press-0.jpg",
  "img/Pallof_Press-1.jpg",
  "img/Plank-0.jpg",
  "img/Plank-1.jpg",
  "img/Reverse_Crunch-0.jpg",
  "img/Reverse_Crunch-1.jpg",
  "img/Seated_Cable_Rows-0.jpg",
  "img/Seated_Cable_Rows-1.jpg",
  "img/Side_Bridge-0.jpg",
  "img/Side_Bridge-1.jpg",
  "img/Side_Lateral_Raise-0.jpg",
  "img/Side_Lateral_Raise-1.jpg",
  "img/Standing_Biceps_Cable_Curl-0.jpg",
  "img/Standing_Biceps_Cable_Curl-1.jpg",
  "img/Stiff-Legged_Dumbbell_Deadlift-0.jpg",
  "img/Stiff-Legged_Dumbbell_Deadlift-1.jpg",
  "img/Triceps_Pushdown_-_Rope_Attachment-0.jpg",
  "img/Triceps_Pushdown_-_Rope_Attachment-1.jpg",
  "img/V-Bar_Pulldown-0.jpg",
  "img/V-Bar_Pulldown-1.jpg",
  "img/Wide-Grip_Lat_Pulldown-0.jpg",
  "img/Wide-Grip_Lat_Pulldown-1.jpg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png"
];

self.addEventListener("install", (e) => {
  // cache: "reload" — мимо HTTP-кэша браузера, иначе новая версия может собраться из старых файлов
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: "reload" }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Сначала кэш (работает в зале без интернета), иначе сеть
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)));
});
