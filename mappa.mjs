// Disegna la mappa della zona (mappa.svg) per ogni sito, con i dati di OpenStreetMap.
// È un'immagine fissa: funziona anche senza Internet e non usa i cookie di Google Maps.
// Per un nuovo locale basta aggiungere una riga in "siti" e lanciare: node mappa.mjs
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

const siti = [
  {
    cartella: "trattoria-marradi", lat: 44.406521, lon: 8.95966,
    colori: { fondo: "#f1e9dc", edifici: "#e2d5bf", verde: "#dcdcc2", strade: "#fbf8f2", mercato: "#e9c9bd", ferrovia: "#cdbfa8", testo: "#7a6d60" },
  },
  {
    cartella: "trattoria-vegia-terralba", lat: 44.407005, lon: 8.961286,
    colori: { fondo: "#f2e6cb", edifici: "#e6d2a8", verde: "#d2d9b8", strade: "#fffaf0", mercato: "#ecc7a4", ferrovia: "#cdb88f", testo: "#5d5a4c" },
  },
];

// Nomi delle vie da scrivere sulla mappa: [nome in OSM, testo]
const vie = [
  ["Piazza Terralba", "Piazza Terralba"], ["Via Terralba", "Via Terralba"], ["Via Giovanni Torti", "Via Torti"],
  ["Via San Fruttuoso", "Via San Fruttuoso"], ["Via Marina di Robilant", "Via Marina di Robilant"],
  ["Via Imperiale", "Via Imperiale"], ["Corso Aldo Gastaldi", "Corso Gastaldi"],
];

const W = 900, H = 600, K = 2; // unità SVG per metro: la mappa copre circa 450 × 300 m
const server = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

async function datiOsm(lat, lon) {
  const bb = [lat - 0.0025, lon - 0.0045, lat + 0.0025, lon + 0.0045].map(n => n.toFixed(5)).join(",");
  const q = `[out:json][timeout:60];(way[highway](${bb});way[building](${bb});way[railway=rail](${bb});` +
    `way[leisure~"park|garden|pitch|playground"](${bb});way[landuse~"grass|recreation_ground"](${bb}););out geom tags;`;
  for (const url of server) {
    try {
      const r = await fetch(url, {
        method: "POST", body: "data=" + encodeURIComponent(q),
        headers: { "User-Agent": "siti-clienti/1.0", "Content-Type": "application/x-www-form-urlencoded" },
      });
      if (r.ok) return (await r.json()).elements;
    } catch {}
    console.log(`  ${url} non risponde, provo il prossimo`);
  }
  throw new Error("Nessun server Overpass disponibile, riprova più tardi");
}

function disegna(elementi, { lat, lon, colori: c }) {
  const P = (la, lo) => [Math.round((lo - lon) * 79550 * K + W / 2), Math.round(-(la - lat) * 111132 * K + H / 2)];
  const visibile = pts => pts.some(([x, y]) => x > -150 && x < W + 150 && y > -150 && y < H + 150);
  const gruppi = {}, segmenti = {};
  let mercato = null;

  for (const e of elementi) {
    if (!e.geometry) continue;
    const pts = e.geometry.map(g => P(g.lat, g.lon));
    if (!visibile(pts)) continue;
    const t = e.tags;
    const chiuso = pts.length > 2 && pts[0].join() === pts.at(-1).join();
    const d = "M" + pts.map(p => p.join(" ")).join("L") + (chiuso ? "Z" : "");
    let cls = null;
    if (t.amenity === "marketplace") { cls = "mercato"; mercato = pts; }
    else if (t.building) cls = "edificio";
    else if (t.leisure || t.landuse) cls = "verde";
    else if (t.railway) cls = "ferrovia";
    else if (t.highway) {
      const h = t.highway;
      if (h === "primary" || h === "secondary") cls = "s1";
      else if (["tertiary", "unclassified", "residential"].includes(h)) cls = "s2";
      else if (h === "pedestrian") cls = t.area === "yes" ? "piazza" : "s3";
      else if (h === "service") cls = "s4";
      if (cls && t.name) for (let i = 1; i < pts.length; i++) (segmenti[t.name] ??= []).push([pts[i - 1], pts[i]]);
    }
    if (cls) (gruppi[cls] ??= []).push(d);
  }

  const stile = `.fondo{fill:${c.fondo}}.verde{fill:${c.verde}}.edificio{fill:${c.edifici}}.mercato{fill:${c.mercato}}.piazza{fill:${c.strade}}` +
    `.s1,.s2,.s3,.s4,.ferrovia{fill:none;stroke-linecap:round;stroke-linejoin:round}.s1,.s2,.s3,.s4{stroke:${c.strade}}` +
    `.s1{stroke-width:22}.s2{stroke-width:14}.s3{stroke-width:10}.s4{stroke-width:6}` +
    `.ferrovia{stroke:${c.ferrovia};stroke-width:2;stroke-dasharray:8 7}` +
    `text{font:600 14px system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;fill:${c.testo};letter-spacing:.02em}` +
    `.alone{stroke:${c.strade};stroke-width:5;stroke-linejoin:round}`;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><style>${stile}</style>`;
  svg += `<rect class="fondo" width="${W}" height="${H}"/>`;
  for (const cls of ["verde", "piazza", "s4", "s3", "s2", "s1", "ferrovia", "edificio", "mercato"])
    if (gruppi[cls]) svg += `<path class="${cls}" d="${gruppi[cls].join("")}"/>`;

  // Ogni nome va sul tratto più lungo della via, preferendo quelli vicini al centro
  const etichetta = (x, y, ang, testo) =>
    `<g transform="translate(${x} ${y}) rotate(${ang})"><text class="alone" text-anchor="middle" dy="5">${testo}</text><text text-anchor="middle" dy="5">${testo}</text></g>`;
  for (const [nome, testo] of vie) {
    let meglio = null;
    for (const [a, b] of segmenti[nome] ?? []) {
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      if (mx < 90 || mx > W - 90 || my < 40 || my > H - 40) continue;
      const punti = Math.hypot(b[0] - a[0], b[1] - a[1]) - Math.hypot(mx - W / 2, my - H / 2) * 0.2;
      if (!meglio || punti > meglio.punti) meglio = { a, b, mx, my, punti };
    }
    if (!meglio) continue;
    let ang = Math.atan2(meglio.b[1] - meglio.a[1], meglio.b[0] - meglio.a[0]) * 180 / Math.PI;
    if (ang > 90) ang -= 180;
    if (ang < -90) ang += 180;
    svg += etichetta(Math.round(meglio.mx), Math.round(meglio.my), Math.round(ang), testo);
  }
  if (mercato) {
    const cx = Math.round(mercato.reduce((s, p) => s + p[0], 0) / mercato.length);
    const cy = Math.round(mercato.reduce((s, p) => s + p[1], 0) / mercato.length);
    svg += etichetta(cx, cy, -70, "Mercato");
  }
  return svg + `</svg>`;
}

for (const sito of siti) {
  const svg = disegna(await datiOsm(sito.lat, sito.lon), sito);
  writeFileSync(join(root, sito.cartella, "mappa.svg"), svg);
  console.log(`${sito.cartella}/mappa.svg  ${(svg.length / 1024).toFixed(0)} KB`);
}
