// Схема мышц: фигура спереди и сзади. Каждая фигура рисуется в своих координатах 0..100 × 0..200.

export const MUSCLE_NAMES = {
  chest: "Грудь",
  front_delt: "Передняя дельта",
  side_delt: "Средняя дельта",
  rear_delt: "Задняя дельта",
  biceps: "Бицепс",
  triceps: "Трицепс",
  forearms: "Предплечья",
  abs: "Пресс",
  obliques: "Косые мышцы живота",
  traps: "Трапеции",
  lats: "Широчайшие",
  midback: "Середина спины",
  lowerback: "Поясница",
  glutes: "Ягодицы",
  quads: "Квадрицепсы",
  hamstrings: "Задняя поверхность бедра",
  calves: "Икры",
};

// Отражение фигуры по вертикальной оси x = 50
const flip = (x) => +(100 - x).toFixed(2);
const mirror = (shape) => shape
  .replace(/cx="([\d.]+)"/, (_, x) => `cx="${flip(x)}"`)
  .replace(/points="([^"]+)"/, (_, pts) => `points="${pts.split(" ").map((p) => { const [x, y] = p.split(","); return `${flip(x)},${y}`; }).join(" ")}"`)
  .replace(/x="([\d.]+)" y="([\d.]+)" width="([\d.]+)"/, (_, x, y, w) => `x="${flip(+x + +w)}" y="${y}" width="${w}"`);

const pair = (key, shape) => [[key, shape], [key, mirror(shape)]];
const ell = (cx, cy, rx, ry) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>`;
const poly = (pts) => `<polygon points="${pts}"/>`;
const rect = (x, y, w, h, r = 2) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`;

const SHARED = [
  ["", `<circle cx="50" cy="13" r="10"/>`],
  ["", rect(45.5, 22, 9, 8, 2)],
  ...pair("", ell(21, 98, 3.5, 5)), // кисти
  ...pair("", ell(42, 184, 6, 4)), // стопы
  ...pair("forearms", ell(23, 80, 4.5, 12)),
];

const FRONT = [
  ...SHARED,
  ["traps", poly("39,31 50,28 61,31 56,34 44,34")],
  ...pair("side_delt", ell(25.5, 40, 4, 7.5)),
  ...pair("front_delt", ell(32, 39, 5, 7)),
  ...pair("chest", rect(37, 33.5, 12.5, 17, 5)),
  ...pair("biceps", ell(27, 57, 5, 10)),
  ...pair("obliques", poly("35.5,54 42,55 42,88 38,86 35,70")),
  ...pair("abs", rect(43.5, 53, 6, 8)),
  ...pair("abs", rect(43.5, 62.5, 6, 8)),
  ...pair("abs", rect(43.5, 72, 6, 8)),
  ...pair("abs", rect(43.5, 81.5, 6, 9)),
  ["", poly("38,91 62,91 60,101 40,101")],
  ...pair("quads", ell(42.5, 124, 8, 22)),
  ...pair("", ell(42.5, 149, 4.5, 3)),
  ...pair("calves", ell(42.5, 166, 4.5, 14)),
];

const BACK = [
  ...SHARED,
  ["traps", poly("38,31 50,26 62,31 57,41 50,45 43,41")],
  ...pair("side_delt", ell(25.5, 40, 4, 7.5)),
  ...pair("rear_delt", ell(32, 39, 5, 7)),
  ...pair("triceps", ell(27, 57, 5, 10)),
  ...pair("lats", poly("35.5,45 42.5,43 42.5,64 44,80 38.5,78 35,60")),
  ["midback", poly("43.5,42 50,46 56.5,42 57,63 50,67 43,63")],
  ["lowerback", poly("43,65 50,69 57,65 57.5,86 50,88 42.5,86")],
  ...pair("glutes", ell(43, 97, 8, 8.5)),
  ...pair("hamstrings", ell(42.5, 127, 7.5, 19)),
  ...pair("calves", ell(42.5, 163, 6, 14)),
];

function figure(parts, primary, secondary, dx, label) {
  const body = parts.map(([key, shape]) => {
    const cls = primary.includes(key) ? "m-pri" : secondary.includes(key) ? "m-sec" : "m-idle";
    return shape.replace(/^<(\w+)/, `<$1 class="${cls}"`);
  }).join("");
  return `<g transform="translate(${dx},0)">${body}<text x="50" y="198" class="m-label">${label}</text></g>`;
}

export function muscleMap(primary = [], secondary = []) {
  return `<svg class="muscle-map" viewBox="0 0 210 202" role="img" aria-label="Схема рабочих мышц">
    ${figure(FRONT, primary, secondary, 0, "спереди")}
    ${figure(BACK, primary, secondary, 110, "сзади")}
  </svg>`;
}
