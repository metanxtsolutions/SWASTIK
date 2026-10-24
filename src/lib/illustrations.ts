/**
 * Original flower illustrations drawn in code (SVG). They are the brand's
 * placeholder art: shown when a product or category has no photograph yet, in the
 * hero when no banner photo is uploaded, and used to render sample images for
 * the preview catalogue. They are illustrations, never presented as product photos.
 */

export type IllustrationKind = "marigold" | "rose" | "jasmine" | "hibiscus" | "lotus" | "leaves" | "garland" | "bundle" | "daily" | "festival" | "generic";

const C = {
  bg: "#FBF3E6",
  bg2: "#F6E7D0",
  saffron: "#EE8A1B",
  marigold: "#F6A723",
  yellow: "#FBC93D",
  deep: "#C9561A",
  rose: "#C8234B",
  roseDark: "#8E1535",
  roseLight: "#E5577A",
  white: "#FFFDF8",
  cream: "#F3E9D4",
  pink: "#F2A1BF",
  pinkDeep: "#D9578A",
  red: "#D7262E",
  redDark: "#9C1520",
  leaf: "#3E7B4F",
  leafDark: "#2B5C3A",
  leafLight: "#6FA36F",
  stem: "#557A3E",
};

const r2 = (n: number) => Math.round(n * 100) / 100;

function marigold(cx: number, cy: number, R: number, palette: [string, string, string] = [C.deep, C.saffron, C.marigold]): string {
  let out = "";
  const rings = [1, 0.78, 0.56, 0.34];
  rings.forEach((f, i) => {
    const radius = R * f;
    const petal = Math.max(R * 0.16, 1.4);
    const count = Math.max(6, Math.floor((2 * Math.PI * radius) / (petal * 1.15)));
    const color = palette[i % 3];
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 2 + i * 0.4;
      out += `<circle cx="${r2(cx + Math.cos(a) * radius)}" cy="${r2(cy + Math.sin(a) * radius)}" r="${r2(petal)}" fill="${color}"/>`;
    }
  });
  out += `<circle cx="${cx}" cy="${cy}" r="${r2(R * 0.22)}" fill="${palette[1]}"/>`;
  return out;
}

function leaf(x: number, y: number, len: number, angle: number, color = C.leaf): string {
  const w = len * 0.42;
  return `<g transform="translate(${x} ${y}) rotate(${angle})"><path d="M0 0 Q ${r2(len * 0.5)} ${r2(-w)} ${len} 0 Q ${r2(len * 0.5)} ${r2(w)} 0 0Z" fill="${color}"/><path d="M0 0 L ${r2(len * 0.92)} 0" stroke="${C.leafDark}" stroke-width="1.2" opacity="0.5"/></g>`;
}

function rose(cx: number, cy: number, R: number): string {
  let out = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${C.rose}"/>`;
  const layers = [0.85, 0.66, 0.48, 0.3];
  layers.forEach((f, i) => {
    const rr = R * f;
    const rot = i * 35;
    out += `<g transform="rotate(${rot} ${cx} ${cy})"><path d="M ${r2(cx - rr)} ${cy} A ${rr} ${r2(rr * 0.9)} 0 0 1 ${r2(cx + rr)} ${cy}" fill="none" stroke="${C.roseDark}" stroke-width="${r2(R * 0.07)}" stroke-linecap="round"/><path d="M ${r2(cx + rr * 0.7)} ${r2(cy + rr * 0.5)} A ${rr} ${rr} 0 0 1 ${r2(cx - rr * 0.6)} ${r2(cy + rr * 0.6)}" fill="none" stroke="${C.roseLight}" stroke-width="${r2(R * 0.05)}" stroke-linecap="round" opacity="0.8"/></g>`;
  });
  out += `<circle cx="${cx}" cy="${cy}" r="${r2(R * 0.12)}" fill="${C.roseDark}"/>`;
  return out;
}

function fivePetal(cx: number, cy: number, R: number, fill: string, stroke: string, center: string, rot = 0): string {
  let out = "";
  for (let k = 0; k < 5; k++) {
    const a = rot + k * 72;
    out += `<ellipse cx="${cx}" cy="${r2(cy - R * 0.55)}" rx="${r2(R * 0.34)}" ry="${r2(R * 0.55)}" fill="${fill}" stroke="${stroke}" stroke-width="1" transform="rotate(${a} ${cx} ${cy})"/>`;
  }
  out += `<circle cx="${cx}" cy="${cy}" r="${r2(R * 0.18)}" fill="${center}"/>`;
  return out;
}

function hibiscus(cx: number, cy: number, R: number, rot = -10): string {
  let out = "";
  for (let k = 0; k < 5; k++) {
    const a = rot + k * 72;
    out += `<g transform="rotate(${a} ${cx} ${cy})"><path d="M ${cx} ${cy} C ${r2(cx - R * 0.9)} ${r2(cy - R * 0.5)} ${r2(cx - R * 0.6)} ${r2(cy - R * 1.15)} ${cx} ${r2(cy - R)} C ${r2(cx + R * 0.6)} ${r2(cy - R * 1.15)} ${r2(cx + R * 0.9)} ${r2(cy - R * 0.5)} ${cx} ${cy}Z" fill="${C.red}" stroke="${C.redDark}" stroke-width="1.2"/><path d="M ${cx} ${cy} L ${cx} ${r2(cy - R * 0.85)}" stroke="${C.redDark}" stroke-width="1" opacity="0.5"/></g>`;
  }
  out += `<circle cx="${cx}" cy="${cy}" r="${r2(R * 0.22)}" fill="${C.redDark}"/>`;
  const ex = cx + R * 0.9;
  const ey = cy - R * 0.55;
  out += `<path d="M ${cx} ${cy} Q ${r2(cx + R * 0.5)} ${r2(cy - R * 0.1)} ${r2(ex)} ${r2(ey)}" stroke="${C.yellow}" stroke-width="${r2(R * 0.06)}" fill="none" stroke-linecap="round"/>`;
  for (let k = 0; k < 5; k++) out += `<circle cx="${r2(ex + Math.cos(k) * R * 0.08)}" cy="${r2(ey + Math.sin(k * 1.7) * R * 0.08)}" r="${r2(R * 0.05)}" fill="${C.yellow}"/>`;
  return out;
}

function lotusPetal(cx: number, base: number, h: number, w: number, angle: number, fill: string): string {
  return `<path d="M ${cx} ${base} Q ${r2(cx - w)} ${r2(base - h * 0.55)} ${cx} ${r2(base - h)} Q ${r2(cx + w)} ${r2(base - h * 0.55)} ${cx} ${base}Z" fill="${fill}" stroke="${C.pinkDeep}" stroke-width="1" transform="rotate(${angle} ${cx} ${base})"/>`;
}

function lotus(cx: number, base: number, H: number): string {
  let out = "";
  [-62, 62, -40, 40].forEach((a) => (out += lotusPetal(cx, base, H * 0.8, H * 0.28, a, C.pink)));
  [-20, 20].forEach((a) => (out += lotusPetal(cx, base, H * 0.95, H * 0.3, a, "#F5B6CD")));
  out += lotusPetal(cx, base, H, H * 0.3, 0, "#F8C6D8");
  out += `<ellipse cx="${cx}" cy="${r2(base + 3)}" rx="${r2(H * 0.75)}" ry="${r2(H * 0.09)}" fill="${C.leaf}"/>`;
  return out;
}

function belLeaves(cx: number, cy: number, L: number): string {
  let out = `<path d="M ${cx} ${r2(cy + L * 0.9)} L ${cx} ${cy}" stroke="${C.stem}" stroke-width="3" stroke-linecap="round"/>`;
  out += leaf(cx, cy, L, -90, C.leaf);
  out += leaf(cx, cy, L * 0.85, -150, C.leafLight);
  out += leaf(cx, cy, L * 0.85, -30, C.leafLight);
  return out;
}

function garlandArc(x1: number, x2: number, y: number, sag: number, size: number): string {
  let out = "";
  const n = Math.floor((x2 - x1) / (size * 1.5));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = x1 + (x2 - x1) * t;
    const yy = y + sag * 4 * t * (1 - t);
    const pal: [string, string, string] = i % 2 ? [C.saffron, C.marigold, C.yellow] : [C.deep, C.saffron, C.marigold];
    out += i % 6 === 3 ? rose(x, yy, size * 0.85) : marigold(x, yy, size, pal);
  }
  return out;
}

function frame(content: string, bg = C.bg): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="800" height="800"><rect width="200" height="200" fill="${bg}"/><circle cx="100" cy="104" r="78" fill="${C.bg2}" opacity="0.7"/>${content}</svg>`;
}

export function illustrationSvg(kind: IllustrationKind): string {
  switch (kind) {
    case "marigold":
      return frame(leaf(70, 140, 40, 150) + leaf(130, 142, 40, 30) + marigold(72, 98, 26) + marigold(128, 92, 30, [C.saffron, C.marigold, C.yellow]) + marigold(100, 132, 24));
    case "rose":
      return frame(leaf(64, 132, 42, 160) + leaf(136, 128, 42, 20) + leaf(100, 150, 36, 90, C.leafLight) + rose(78, 96, 26) + rose(124, 104, 30));
    case "jasmine": {
      let s = `<path d="M40 150 Q 100 120 160 150" stroke="${C.leaf}" stroke-width="2.5" fill="none"/>` + leaf(52, 140, 30, 200) + leaf(150, 142, 30, -20);
      const pts: [number, number, number][] = [
        [70, 92, 20],
        [104, 78, 22],
        [134, 100, 20],
        [92, 118, 18],
        [122, 128, 16],
        [60, 124, 14],
      ];
      pts.forEach(([x, y, r], i) => (s += fivePetal(x, y, r, C.white, "#E7DCC4", C.yellow, i * 13)));
      s += `<ellipse cx="146" cy="72" rx="5" ry="10" fill="${C.white}" stroke="#E7DCC4" transform="rotate(30 146 72)"/><ellipse cx="56" cy="70" rx="5" ry="10" fill="${C.white}" stroke="#E7DCC4" transform="rotate(-30 56 70)"/>`;
      return frame(s);
    }
    case "hibiscus":
      return frame(leaf(60, 150, 44, 160) + leaf(140, 152, 44, 20) + hibiscus(100, 104, 50));
    case "lotus":
      return frame(lotus(100, 150, 92));
    case "leaves":
      return frame(belLeaves(78, 104, 46) + belLeaves(126, 96, 40));
    case "garland":
      return frame(garlandArc(28, 172, 50, 92, 10) + garlandArc(52, 148, 66, 58, 8));
    case "bundle":
      return frame(
        `<path d="M86 150 L100 182 L114 150Z" fill="${C.stem}"/>` +
          leaf(68, 128, 40, 160) +
          leaf(132, 128, 40, 20) +
          marigold(76, 100, 22) +
          rose(122, 96, 22) +
          fivePetal(100, 74, 16, C.white, "#E7DCC4", C.yellow) +
          marigold(104, 124, 20, [C.saffron, C.marigold, C.yellow]),
      );
    case "daily":
      return frame(
        `<path d="M40 122 Q100 178 160 122Z" fill="${C.leaf}"/><path d="M40 122 Q100 160 160 122" fill="none" stroke="${C.leafDark}" stroke-width="2"/>` +
          marigold(76, 110, 16) +
          hibiscus(120, 106, 18, 20) +
          fivePetal(98, 98, 12, C.white, "#E7DCC4", C.yellow) +
          leaf(140, 116, 22, -30, C.leafLight) +
          marigold(100, 120, 12, [C.saffron, C.marigold, C.yellow]),
      );
    case "festival":
      return frame(garlandArc(24, 176, 40, 50, 8) + lotus(100, 158, 70) + marigold(52, 140, 14) + marigold(148, 140, 14, [C.saffron, C.marigold, C.yellow]));
    default:
      return frame(marigold(100, 100, 40));
  }
}

export function illustrationDataUri(kind: IllustrationKind): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(illustrationSvg(kind))}`;
}

/** Picks an illustration from a product or category name, for placeholders. */
export function illustrationFor(text: string): IllustrationKind {
  const t = text.toLowerCase();
  if (/garland|mala|haar/.test(t)) return "garland";
  if (/marigold|genda|gada/.test(t)) return "marigold";
  if (/rose|golap|gulab/.test(t)) return "rose";
  if (/jasmine|mogra|beli|bela|juhi|tuberose|rajanigandha/.test(t)) return "jasmine";
  if (/hibiscus|jaba|joba|java/.test(t)) return "hibiscus";
  if (/lotus|padma|kamal/.test(t)) return "lotus";
  if (/bel|bilva|leaf|leaves|patra|tulsi|durva|mango/.test(t)) return "leaves";
  if (/daily|pack|thali|plate/.test(t)) return "daily";
  if (/festival|special|occasion|puja kit|offering/.test(t)) return "festival";
  if (/mix|bundle|assorted/.test(t)) return "bundle";
  return "generic";
}

/** The Swastik mark: a stylised marigold with eight rounded petals. */
export function logoMarkSvg(size = 40): string {
  let petals = "";
  for (let k = 0; k < 8; k++) {
    petals += `<ellipse cx="20" cy="9.5" rx="5" ry="8" fill="${k % 2 ? C.marigold : C.saffron}" transform="rotate(${k * 45} 20 20)"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="${size}" height="${size}">${petals}<circle cx="20" cy="20" r="7" fill="${C.deep}"/><circle cx="20" cy="20" r="3" fill="${C.yellow}"/></svg>`;
}

export function heroArtSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 320" width="800" height="640"><circle cx="210" cy="190" r="128" fill="${C.bg2}" opacity="0.8"/>${garlandArc(10, 390, 20, 70, 11)}${lotus(210, 288, 120)}${marigold(92, 238, 30)}${marigold(330, 236, 28, [C.saffron, C.marigold, C.yellow])}${rose(130, 270, 18)}${fivePetal(296, 280, 14, C.white, "#E7DCC4", C.yellow)}${leaf(60, 280, 40, 170)}${leaf(352, 282, 40, 10)}</svg>`;
}
