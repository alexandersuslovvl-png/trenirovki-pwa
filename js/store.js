// Хранилище тренировок в localStorage. Все времена — метки Date.now().
import { PROGRAM } from "./data.js";

const KEY = "gym.v1";
const DAYS = ["A", "B", "C"];

let state = load();

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.sessions)) return s;
  } catch (e) { /* повреждённые данные — начинаем с чистого листа */ }
  return { sessions: [], activeId: null, rest: null };
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { alert("Не удалось сохранить данные: " + e.message); }
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// План упражнения внутри тренировки. Тренировки до 2026-10-15 хранили только ссылку на программу,
// поэтому для них ищем такое же упражнение в текущей программе.
export function planOf(session, idx) {
  const it = session.items[idx];
  if (it.plan) return it.plan;
  const same = PROGRAM[session.day]?.items.find((p) => p.ex === it.ex && (p.superset || null) === it.superset);
  return same || { ex: it.ex, sets: Math.max(1, it.sets.length), min: 0, max: 0, rest: 60, unit: "reps" };
}

export const getState = () => state;
export const active = () => state.sessions.find((s) => s.id === state.activeId) || null;
export const session = (id) => state.sessions.find((s) => s.id === id) || null;
export const finished = () => state.sessions.filter((s) => s.endedAt).sort((a, b) => b.startedAt - a.startedAt);

export function nextDay() {
  const last = finished()[0];
  return last ? DAYS[(DAYS.indexOf(last.day) + 1) % DAYS.length] : "A";
}

export function startSession(day) {
  const s = {
    id: uid(), day, startedAt: Date.now(), endedAt: null,
    items: PROGRAM[day].items.map((it) => ({ ex: it.ex, superset: it.superset || null, plan: { ...it }, startedAt: null, endedAt: null, sets: [] })),
  };
  state.sessions.push(s);
  state.activeId = s.id;
  state.rest = null;
  save();
  return s;
}

export function startItem(idx) {
  const it = active().items[idx];
  if (!it.startedAt) it.startedAt = Date.now();
  it.endedAt = null;
  save();
}

export function addSet(idx, set) {
  const it = active().items[idx];
  if (!it.startedAt) it.startedAt = Date.now();
  it.sets.push({ ...set, t: Date.now() });
  save();
}

export function removeLastSet(idx) {
  active().items[idx].sets.pop();
  save();
}

export function endItem(idx) {
  const it = active().items[idx];
  if (!it.startedAt) it.startedAt = Date.now();
  it.endedAt = Date.now();
  save();
}

export function finishSession() {
  const s = active();
  const now = Date.now();
  s.items.forEach((it) => { if (it.startedAt && !it.endedAt) it.endedAt = now; });
  s.endedAt = now;
  state.activeId = null;
  state.rest = null;
  save();
  return s;
}

export function discardSession() {
  state.sessions = state.sessions.filter((s) => s.id !== state.activeId);
  state.activeId = null;
  state.rest = null;
  save();
}

export function deleteSession(id) {
  state.sessions = state.sessions.filter((s) => s.id !== id);
  save();
}

export function startRest(seconds) {
  state.rest = seconds > 0 ? { endsAt: Date.now() + seconds * 1000, fired: false } : null;
  save();
}
export function extendRest(seconds) {
  if (!state.rest) return;
  state.rest.endsAt = Math.max(state.rest.endsAt, Date.now()) + seconds * 1000;
  state.rest.fired = false;
  save();
}
export function stopRest() { state.rest = null; save(); }
export function markRestFired() { if (state.rest) { state.rest.fired = true; save(); } }

// Последний законченный результат упражнения (с тем же суперсетом), кроме активной тренировки
export function lastResult(ex, superset = null) {
  for (const s of finished()) {
    const it = s.items.find((i) => i.ex === ex && (i.superset || null) === superset && i.sets.length);
    if (it) return { date: s.startedAt, sets: it.sets };
  }
  return null;
}

export function exportJSON() {
  return JSON.stringify({ app: "trenirovki-pwa", version: 1, exportedAt: new Date().toISOString(), ...state }, null, 1);
}

// Добавляет тренировки из копии к текущим (по id), ничего не удаляя.
// Незаконченная тренировка из копии не переносится — её нельзя продолжить на другом телефоне.
export function importJSON(text) {
  const d = JSON.parse(text);
  if (!d || !Array.isArray(d.sessions)) throw new Error("В файле нет тренировок");
  const have = new Set(state.sessions.map((s) => s.id));
  const fresh = d.sessions.filter((s) => s && s.id && s.endedAt && Array.isArray(s.items) && !have.has(s.id));
  state.sessions.push(...fresh);
  save();
  return { added: fresh.length, total: state.sessions.length };
}
