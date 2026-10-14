import { EXERCISES, PROGRAM } from "./data.js";
import { muscleMap, MUSCLE_NAMES } from "./muscles.js";
import * as store from "./store.js";
import { toMarkdown, shareOrDownload, fmtDate, fmtTime, fmtDur, fmtSet, tonnage, setCount } from "./export.js";

const $app = document.getElementById("app");
const $rest = document.getElementById("rest");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const go = (hash) => { location.hash = hash; };
const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
const target = (p) => `${p.sets} × ${p.min === p.max ? p.min : `${p.min}–${p.max}`}${p.unit === "sec" ? " с" : ""}`;
const plural = (n, one, few, many) => (n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many);
const repsText = (p) => `${p.min === p.max ? p.min : `${p.min}–${p.max}`} ${p.unit === "sec" ? "секунд" : plural(p.max, "повтор", "повтора", "повторов")}`;
const targetLong = (p) => `${p.sets} ${plural(p.sets, "подход", "подхода", "подходов")} по ${repsText(p)}`;
const exName = (it) => EXERCISES[it.ex].name + (it.superset ? ` + ${EXERCISES[it.superset].name}` : "");

// Черновик значений подхода (вес/повторы), чтобы перерисовка экрана их не сбрасывала
const draft = {};
// Какое упражнение суперсета показано в карточке: 0 — первое, 1 — второе
const supersetTab = {};
// Упражнения, где после плановых подходов попросили дополнительный
const extraSet = {};

/* ---------- звук, вибрация, экран ---------- */
let audio;
function unlockAudio() {
  if (!audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* без звука */ } }
  if (audio && audio.state === "suspended") audio.resume();
}
function beep() {
  if (!audio) return;
  [0, 0.28, 0.56].forEach((t) => {
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = 880; g.gain.value = 0.25;
    o.connect(g).connect(audio.destination);
    o.start(audio.currentTime + t); o.stop(audio.currentTime + t + 0.18);
  });
}
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && !wakeLock && "wakeLock" in navigator && document.visibilityState === "visible") {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { /* не поддерживается — не страшно */ }
}

/* ---------- роутер ---------- */
function route() {
  const [, view, arg] = location.hash.replace(/^#/, "").split("/");
  const a = store.active();
  keepAwake(!!a);
  if ((view === "w" || view === "e") && !a) return go("#/");
  window.scrollTo(0, 0);
  if (view === "w") renderWorkout();
  else if (view === "e") renderExercise(+arg);
  else if (view === "s") renderSummary(arg);
  else if (view === "h") renderHistory();
  else renderHome();
  renderRest();
}
window.addEventListener("hashchange", route);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { keepAwake(!!store.active()); route(); } });

/* ---------- главная ---------- */
let installPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installPrompt = e; if (!location.hash || location.hash === "#/") renderHome(); });

function renderHome() {
  const a = store.active();
  const next = store.nextDay();
  const hist = store.finished();
  $app.innerHTML = `
    <header class="top"><h1>Тренировки</h1></header>
    ${a ? `<button class="card resume" data-act="resume">
        <span class="badge live">идёт</span>
        <b>День ${a.day} · ${esc(PROGRAM[a.day].title)}</b>
        <span class="muted">Начата в ${fmtTime(a.startedAt)} · подходов: ${setCount(a)}</span>
        <span class="btn primary">Продолжить</span>
      </button>` : ""}
    <h2>${a ? "Или начать другую" : "Начать тренировку"}</h2>
    <div class="days">
      ${Object.entries(PROGRAM).map(([d, p]) => `
        <button class="card day ${d === next && !a ? "next" : ""}" data-act="start" data-day="${d}">
          <span class="letter">${d}</span>
          <span class="day-body"><b>${esc(p.title)}</b>
          <span class="muted">${p.items.length} упражнений${d === next ? " · следующая по очереди" : ""}</span></span>
        </button>`).join("")}
    </div>
    <h2>История</h2>
    ${hist.length ? `<button class="card row" data-act="history"><span>Прошлые тренировки</span><b>${hist.length} →</b></button>
      <p class="muted small">Последняя: ${fmtDate(hist[0].startedAt)}, день ${hist[0].day}</p>` : `<p class="muted">Пока пусто — первая тренировка появится здесь.</p>`}
    <h2>Данные</h2>
    <div class="grid2">
      <button class="btn" data-act="backup">Скачать копию (JSON)</button>
      <label class="btn">Восстановить из копии<input type="file" accept="application/json,.json" hidden data-act="restore"></label>
    </div>
    ${installPrompt ? `<button class="btn primary wide" data-act="install">Установить на главный экран</button>` : ""}
    <p class="muted small">Записи хранятся только на этом телефоне. Время от времени скачивай копию.</p>`;
}

/* ---------- тренировка ---------- */
function itemStatus(it, plan) {
  if (it.endedAt) return ["done", "✓"];
  if (it.startedAt) return ["live", `${it.sets.length}/${plan.sets}`];
  return ["", `${plan.sets}×`];
}

function renderWorkout() {
  const s = store.active();
  const day = PROGRAM[s.day];
  const firstOpen = s.items.findIndex((it) => !it.endedAt);
  $app.innerHTML = `
    <header class="top"><button class="back" data-go="#/">←</button>
      <div><h1>День ${s.day}</h1><span class="muted">${esc(day.title)}</span></div>
      <span class="timer" data-elapsed="${s.startedAt}"></span></header>
    <ol class="list">
      ${s.items.map((it, i) => {
        const p = day.items[i];
        const [cls, label] = itemStatus(it, p);
        return `${p.abs && !day.items[i - 1]?.abs ? `<li class="sep">Пресс</li>` : ""}
        <li><button class="item ${cls} ${i === firstOpen ? "current" : ""}" data-go="#/e/${i}">
          <img src="${EXERCISES[it.ex].img[0]}" alt="" loading="lazy">
          <span class="item-body"><b>${esc(exName(it))}</b><span class="muted">${target(p)}${p.side ? " " + esc(p.side) : ""}</span></span>
          <span class="pill ${cls}">${label}</span></button></li>`;
      }).join("")}
    </ol>
    ${firstOpen >= 0 ? `<button class="btn primary wide" data-go="#/e/${firstOpen}">${s.items[firstOpen].startedAt ? "Вернуться к упражнению" : "К следующему упражнению"}</button>` : ""}
    <div class="grid2">
      <button class="btn" data-act="discard">Отменить тренировку</button>
      <button class="btn ${firstOpen < 0 ? "primary" : ""}" data-act="finish">Завершить тренировку</button>
    </div>`;
  tickElapsed();
}

/* ---------- карточка упражнения ---------- */
function defaults(idx) {
  const it = store.active().items[idx];
  const plan = PROGRAM[store.active().day].items[idx];
  const prev = it.sets[it.sets.length - 1] || store.lastResult(it.ex, it.superset)?.sets[0];
  return {
    w: prev?.w ?? "", r: prev?.r ?? plan.min,
    w2: prev?.w2 ?? "", r2: prev?.r2 ?? plan.min,
  };
}

function info(exKey) {
  const ex = EXERCISES[exKey];
  const names = (keys) => keys.map((k) => MUSCLE_NAMES[k]).join(", ");
  return `
    <div class="anim"><img src="${ex.img[0]}" alt="${esc(ex.name)}, положение 1"><img src="${ex.img[1]}" alt="${esc(ex.name)}, положение 2" class="f2"></div>
    <div class="eq"><span class="lbl">Тренажёр</span>${esc(ex.equipment)}</div>
    <div class="muscles">${muscleMap(ex.primary, ex.secondary)}
      <div class="legend">
        <p><i class="dot pri"></i><b>Основные:</b> ${names(ex.primary)}</p>
        ${ex.secondary.length ? `<p><i class="dot sec"></i><b>Помогают:</b> ${names(ex.secondary)}</p>` : ""}
        <p class="muted small">${esc(ex.muscleText)}</p>
      </div></div>
    ${ex.note ? `<p class="note">${esc(ex.note)}</p>` : ""}
    <details class="tech" ${store.active().items.some((i) => i.sets.length) ? "" : "open"}>
      <summary>Техника выполнения</summary><ol>${ex.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></details>
    <details class="tech"><summary>Типичные ошибки</summary><ul>${ex.mistakes.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></details>`;
}

function stepper(name, label, value, step, unit) {
  return `<div class="stepper"><span class="lbl">${esc(label)}</span>
    <div class="ctl"><button type="button" data-step="${name}" data-d="${-step}">−</button>
    <input name="${name}" type="number" inputmode="decimal" step="any" value="${esc(value)}" placeholder="0"><span class="unit">${unit}</span>
    <button type="button" data-step="${name}" data-d="${step}">+</button></div></div>`;
}

function setInputs(exKey, plan, d, suffix) {
  const ex = EXERCISES[exKey];
  const sec = plan.unit === "sec";
  return `${ex.weightLabel ? stepper("w" + suffix, ex.weightLabel, d["w" + suffix], ex.weightStep, "кг") : ""}
    ${stepper("r" + suffix, sec ? "Секунд в подходе" : "Повторов в подходе", d["r" + suffix], sec ? 5 : 1, sec ? "с" : "раз")}`;
}

function progressHint(it, plan) {
  const last = store.lastResult(it.ex, it.superset);
  if (!last || plan.unit === "sec") return "";
  const top = last.sets.length >= plan.sets && last.sets.slice(0, plan.sets).every((s) => +s.r >= plan.max && (!it.superset || +s.r2 >= plan.max));
  return top && EXERCISES[it.ex].weightLabel ? `<p class="hint">В прошлый раз все подходы на верхней границе — пора добавить вес (+${EXERCISES[it.ex].weightStep} кг).</p>` : "";
}

function renderExercise(idx) {
  const s = store.active();
  const day = PROGRAM[s.day];
  const it = s.items[idx], plan = day.items[idx];
  if (!it) return go("#/w");
  const d = (draft[idx] ||= defaults(idx));
  const last = store.lastResult(it.ex, it.superset);
  const tab = supersetTab[idx] || 0;
  const shownEx = it.superset && tab === 1 ? it.superset : it.ex;
  const running = it.startedAt && !it.endedAt;
  const doneEnough = it.sets.length >= plan.sets;

  $app.innerHTML = `
    <header class="top"><button class="back" data-go="#/w">←</button>
      <div><span class="muted">${idx + 1} / ${s.items.length} · День ${s.day}</span><h1 class="ex-title">${esc(exName(it))}</h1></div>
      <span class="timer" data-elapsed="${s.startedAt}"></span></header>

    ${it.superset ? `<div class="seg">${[it.ex, it.superset].map((k, i) => `<button class="${i === tab ? "on" : ""}" data-act="tab" data-i="${i}">${esc(EXERCISES[k].name)}</button>`).join("")}</div>` : ""}
    ${info(shownEx)}

    <section class="plan">
      <div><span class="lbl">Цель по программе</span><b>${targetLong(plan)}</b>${plan.side ? ` <span class="muted">${esc(plan.side)}</span>` : ""}<span class="muted"> · отдых ${clock(plan.rest)}</span></div>
      ${plan.note ? `<p class="muted small">${esc(plan.note)}</p>` : ""}
      ${last ? `<div><span class="lbl">Прошлый раз, ${fmtDate(last.date)}</span>${last.sets.map((x) => fmtSet(it, plan, x)).join(" · ")}</div>` : ""}
      ${progressHint(it, plan)}
    </section>

    ${!it.startedAt ? `<button class="btn primary wide big" data-act="start-item">▶ Начать упражнение</button>` : ""}

    ${it.startedAt ? `<section class="sets">
      <div class="sets-head"><b>Подходы</b><span class="muted">начато в ${fmtTime(it.startedAt)}${it.endedAt ? ` · закончено в ${fmtTime(it.endedAt)} (${fmtDur(it.endedAt - it.startedAt)})` : ""}</span></div>
      <ol class="done-sets">${Array.from({ length: Math.max(plan.sets, it.sets.length) }, (_, k) => {
        const x = it.sets[k];
        if (x) return `<li><span>${k + 1}</span><b>${fmtSet(it, plan, x)}</b><span class="muted">${k >= plan.sets ? "доп. · " : ""}${fmtTime(x.t)}</span></li>`;
        return `<li class="todo ${k === it.sets.length && running ? "now" : ""}"><span>${k + 1}</span><span>${k === it.sets.length && running ? "сейчас" : "впереди"}</span><span>${repsText(plan)}</span></li>`;
      }).join("")}</ol>
      ${running ? `
        ${!doneEnough || extraSet[idx] ? `<form class="entry" data-idx="${idx}">
          ${it.superset ? `<p class="lbl">${esc(EXERCISES[it.ex].name)}</p>` : ""}
          ${setInputs(it.ex, plan, d, "")}
          ${it.superset ? `<p class="lbl">${esc(EXERCISES[it.superset].name)}</p>${setInputs(it.superset, plan, d, "2")}` : ""}
          <button class="btn ${doneEnough ? "" : "primary"} wide big" type="submit">✓ Подход ${it.sets.length + 1}${doneEnough ? " (дополнительный)" : ` из ${plan.sets}`} сделан</button>
        </form>` : `<p class="done-msg">Все ${plan.sets} ${plural(plan.sets, "подход", "подхода", "подходов")} по программе сделаны.</p>`}
        ${it.sets.length ? `<button class="link" data-act="undo">Отменить последний подход</button>` : ""}
        <button class="btn ${doneEnough ? "primary big" : ""} wide" data-act="end-item">■ Закончить упражнение</button>
        ${doneEnough && !extraSet[idx] ? `<button class="link" data-act="extra-set">+ Сделать дополнительный подход</button>` : ""}`
      : `<button class="link" data-act="reopen">Продолжить это упражнение</button>`}
    </section>` : ""}

    <nav class="pager">
      ${idx > 0 ? `<button class="btn" data-go="#/e/${idx - 1}">← Назад</button>` : `<span></span>`}
      ${idx < s.items.length - 1 ? `<button class="btn ${it.endedAt ? "primary" : ""}" data-go="#/e/${idx + 1}">Дальше →</button>`
        : `<button class="btn ${it.endedAt ? "primary" : ""}" data-act="finish">Завершить тренировку</button>`}
    </nav>`;
  tickElapsed();
}

/* ---------- итог и история ---------- */
function renderSummary(id) {
  const s = store.session(id);
  if (!s) return go("#/");
  const day = PROGRAM[s.day];
  const end = s.endedAt || Date.now();
  $app.innerHTML = `
    <header class="top"><button class="back" data-go="#/h">←</button>
      <div><span class="muted">${fmtDate(s.startedAt)}</span><h1>День ${s.day} · ${esc(day.title)}</h1></div></header>
    <div class="stats">
      <div><b>${fmtDur(end - s.startedAt)}</b><span>${fmtTime(s.startedAt)}–${fmtTime(end)}</span></div>
      <div><b>${setCount(s)}</b><span>подходов</span></div>
      <div><b>${tonnage(s).toLocaleString("ru")}</b><span>кг тоннаж</span></div>
    </div>
    <ol class="list summary">
      ${s.items.map((it, i) => `<li class="card">
        <b>${esc(exName(it))}</b>
        <span class="muted small">${it.startedAt ? `${fmtTime(it.startedAt)}–${it.endedAt ? fmtTime(it.endedAt) : "…"}` : "пропущено"}</span>
        ${it.sets.length ? `<p>${it.sets.map((x) => fmtSet(it, day.items[i], x)).join(" · ")}</p>` : ""}</li>`).join("")}
    </ol>
    <button class="btn primary wide big" data-act="export-md" data-id="${s.id}">Экспорт в Obsidian (.md)</button>
    <div class="grid2">
      <button class="btn" data-go="#/">На главную</button>
      <button class="btn danger" data-act="delete" data-id="${s.id}">Удалить</button>
    </div>`;
}

function renderHistory() {
  const list = store.finished();
  $app.innerHTML = `
    <header class="top"><button class="back" data-go="#/">←</button><h1>История</h1></header>
    ${list.length ? `<ol class="list">${list.map((s) => `<li><button class="card row" data-go="#/s/${s.id}">
      <span><b>${fmtDate(s.startedAt)} · День ${s.day}</b><br><span class="muted small">${fmtDur(s.endedAt - s.startedAt)} · ${setCount(s)} подходов · ${tonnage(s).toLocaleString("ru")} кг</span></span><b>→</b></button></li>`).join("")}</ol>`
      : `<p class="muted">Тренировок пока нет.</p>`}`;
}

/* ---------- таймеры ---------- */
function tickElapsed() {
  document.querySelectorAll("[data-elapsed]").forEach((el) => { el.textContent = clock((Date.now() - +el.dataset.elapsed) / 1000); });
}

function renderRest() {
  const r = store.getState().rest;
  if (!r || !store.active()) { $rest.hidden = true; return; }
  const left = Math.ceil((r.endsAt - Date.now()) / 1000);
  if (left <= 0 && !r.fired) {
    store.markRestFired();
    if (navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 400]);
    beep();
  }
  $rest.hidden = false;
  $rest.classList.toggle("over", left <= 0);
  $rest.innerHTML = `<span class="rest-time">${left > 0 ? `Отдых ${clock(left)}` : `Пора${left < -1 ? ` · +${clock(-left)}` : "!"}`}</span>
    <button data-act="rest-add">+30 с</button><button data-act="rest-stop">${left > 0 ? "Пропустить" : "Ок"}</button>`;
}

setInterval(() => { tickElapsed(); if (store.getState().rest) renderRest(); }, 500);

/* ---------- действия ---------- */
function readForm(form) {
  const idx = +form.dataset.idx;
  const d = (draft[idx] ||= {});
  form.querySelectorAll("input").forEach((i) => { d[i.name] = i.value; });
  return { idx, d };
}

document.addEventListener("input", (e) => {
  const form = e.target.closest("form.entry");
  if (form) readForm(form);
});

document.addEventListener("submit", (e) => {
  const form = e.target.closest("form.entry");
  if (!form) return;
  e.preventDefault();
  unlockAudio();
  const { idx, d } = readForm(form);
  const it = store.active().items[idx];
  const plan = PROGRAM[store.active().day].items[idx];
  const set = { w: d.w ?? "", r: d.r === "" ? null : +d.r };
  if (it.superset) Object.assign(set, { w2: d.w2 ?? "", r2: d.r2 === "" ? null : +d.r2 });
  store.addSet(idx, set);
  // последний плановый подход тоже даёт отдых — следующим будет другое упражнение
  store.startRest(plan.rest);
  route();
});

document.addEventListener("change", async (e) => {
  if (e.target.dataset.act !== "restore" || !e.target.files[0]) return;
  try {
    const n = store.importJSON(await e.target.files[0].text());
    alert(`Восстановлено тренировок: ${n}`);
  } catch (err) { alert("Не получилось прочитать файл: " + err.message); }
  route();
});

document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-go],[data-act],[data-step]");
  if (!el) return;
  unlockAudio();
  if (el.dataset.go) return go(el.dataset.go);

  if (el.dataset.step) {
    const input = el.closest(".ctl").querySelector("input");
    const v = Math.max(0, (parseFloat(input.value) || 0) + parseFloat(el.dataset.d));
    input.value = +v.toFixed(2);
    readForm(el.closest("form"));
    return;
  }

  const idx = +location.hash.split("/")[2];
  switch (el.dataset.act) {
    case "resume": return go("#/w");
    case "start": {
      const a = store.active();
      if (a && !confirm(`Сейчас идёт тренировка ${a.day}. Удалить её и начать день ${el.dataset.day}?`)) return;
      if (a) store.discardSession();
      store.startSession(el.dataset.day);
      Object.keys(draft).forEach((k) => delete draft[k]);
      [supersetTab, extraSet].forEach((o) => Object.keys(o).forEach((k) => delete o[k]));
      try { navigator.storage?.persist?.(); } catch (err) { /* не важно */ }
      return go("#/w");
    }
    case "history": return go("#/h");
    case "start-item": store.startItem(idx); return route();
    case "end-item": store.endItem(idx); return route();
    case "reopen": store.startItem(idx); return route();
    case "undo": store.removeLastSet(idx); return route();
    case "tab": supersetTab[idx] = +el.dataset.i; return route();
    case "extra-set": extraSet[idx] = true; return route();
    case "rest-add": store.extendRest(30); return renderRest();
    case "rest-stop": store.stopRest(); return renderRest();
    case "finish": {
      const s = store.active();
      const left = s.items.filter((it) => !it.endedAt && !it.sets.length).length;
      if (left && !confirm(`Не сделано упражнений: ${left}. Всё равно завершить?`)) return;
      const done = store.finishSession();
      return go(`#/s/${done.id}`);
    }
    case "discard":
      if (confirm("Отменить тренировку? Все записи этой тренировки удалятся.")) { store.discardSession(); go("#/"); }
      return;
    case "export-md": {
      const s = store.session(el.dataset.id);
      return shareOrDownload(`${fmtDate(s.startedAt)} ${s.day}.md`, toMarkdown(s), "text/plain");
    }
    case "delete":
      if (confirm("Удалить эту тренировку из истории?")) { store.deleteSession(el.dataset.id); go("#/h"); }
      return;
    case "backup": return shareOrDownload(`trenirovki-backup-${fmtDate(Date.now())}.json`, store.exportJSON(), "application/json");
    case "install":
      if (installPrompt) { installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; renderHome(); }
      return;
  }
});

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
route();
