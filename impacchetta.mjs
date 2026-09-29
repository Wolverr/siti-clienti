// Crea una versione a file singolo di ogni sito (foto, font e mappa inclusi) in da-mostrare/,
// così basta copiare un solo file sul telefono e funziona anche senza Internet.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const siti = ["trattoria-marradi", "trattoria-vegia-terralba"];
const tipi = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
mkdirSync(join(root, "da-mostrare"), { recursive: true });

for (const sito of siti) {
  const cartella = join(root, sito);
  // Sostituisce ogni src="..." e url("...") che punta a un file locale con il file stesso in base64
  const incorpora = (tutto, prima, percorso, dopo) => {
    const file = join(cartella, percorso);
    const tipo = tipi[extname(percorso).toLowerCase()];
    if (!tipo || !existsSync(file)) return tutto;
    return `${prima}data:${tipo};base64,${readFileSync(file).toString("base64")}${dopo}`;
  };
  const html = readFileSync(join(cartella, "index.html"), "utf8")
    .replace(/(src=")(?!data:|https?:|#)([^"]+)(")/g, incorpora)
    .replace(/(url\(")(?!data:|https?:|#)([^"]+)("\))/g, incorpora);
  writeFileSync(join(root, "da-mostrare", `${sito}.html`), html);
  console.log(`${sito}.html  ${(html.length / 1024).toFixed(0)} KB`);
}
