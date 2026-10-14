// Экспорт тренировки в Markdown (формат дневника Obsidian) и отдача файлов на телефоне.
import { EXERCISES, PROGRAM } from "./data.js";
import { planOf } from "./store.js";

const pad = (n) => String(n).padStart(2, "0");
export const fmtDate = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const fmtTime = (t) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const fmtDur = (ms) => {
  const m = Math.round(ms / 60000);
  return m < 60 ? `${m} мин` : `${Math.floor(m / 60)} ч ${m % 60} мин`;
};

const num = (v) => (v === "" || v == null || isNaN(v) ? null : +v);

// Один подход одного упражнения: «14×10», «10» (без веса), «45 с»
export function fmtPart(exKey, w, r, unit = "reps") {
  if (unit === "sec") return `${r ?? "—"} с`;
  const ex = EXERCISES[exKey];
  return ex.weightLabel && num(w) != null ? `${+w}×${r ?? "—"}` : `${r ?? "—"}`;
}

export function fmtSet(item, plan, set) {
  const unit = plan?.unit || "reps";
  const a = fmtPart(item.ex, set.w, set.r, unit);
  return item.superset ? `${a} + ${fmtPart(item.superset, set.w2, set.r2, unit)}` : a;
}

export function tonnage(session) {
  let t = 0;
  session.items.forEach((it) => it.sets.forEach((s) => {
    t += (num(s.w) || 0) * (num(s.r) || 0) + (num(s.w2) || 0) * (num(s.r2) || 0);
  }));
  // планки в секундах не считаем — у них нет веса, так что они и так дают 0
  return Math.round(t);
}

export const setCount = (session) => session.items.reduce((n, it) => n + it.sets.length, 0);

export function toMarkdown(session) {
  const day = PROGRAM[session.day];
  const cols = Math.max(3, ...session.items.map((it) => it.sets.length));
  const head = `| Упражнение | ${Array.from({ length: cols }, (_, i) => `Подход ${i + 1}`).join(" | ")} | Время |`;
  const sep = `|---|${"---|".repeat(cols)}---|`;
  const rows = session.items.map((it, i) => {
    const plan = planOf(session, i);
    const name = `[[${EXERCISES[it.ex].name}]]` + (it.superset ? ` + [[${EXERCISES[it.superset].name}]]` : "");
    const cells = plan.warmup
      ? Array.from({ length: cols }, (_, k) => (k === 0 && it.endedAt ? fmtDur(it.endedAt - it.startedAt) : ""))
      : Array.from({ length: cols }, (_, k) => (it.sets[k] ? fmtSet(it, plan, it.sets[k]) : (k < plan.sets ? "—" : "")));
    const time = it.startedAt ? `${fmtTime(it.startedAt)}–${it.endedAt ? fmtTime(it.endedAt) : "…"}` : "пропущено";
    return `| ${name} | ${cells.join(" | ")} | ${time} |`;
  });
  const end = session.endedAt || Date.now();
  return [
    "---",
    "tags: [тренировки, дневник]",
    `дата: ${fmtDate(session.startedAt)}`,
    `день: ${session.day}`,
    "---",
    `# Тренировка — ${fmtDate(session.startedAt)} (День ${session.day}: ${day.title})`,
    "",
    `**Время:** ${fmtTime(session.startedAt)}–${fmtTime(end)} (${fmtDur(end - session.startedAt)}) · **Подходов:** ${setCount(session)} · **Тоннаж:** ${tonnage(session)} кг`,
    "",
    "Записано в приложении. Формат: вес × повторы (для гантелей — вес одной гантели).",
    "",
    head, sep, ...rows,
    "",
    "## Самочувствие",
    "- Энергия (1–5):",
    "- Сон накануне (часов):",
    "- Что было тяжело или непонятно:",
    "- Где добавить вес в следующий раз:",
    "",
  ].join("\n");
}

// На Android открывает меню «Поделиться» (можно сразу в Obsidian), иначе скачивает файл
export async function shareOrDownload(filename, text, mime) {
  const file = new File([text], filename, { type: mime });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
