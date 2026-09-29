// Crea una versione a file singolo di ogni sito (foto incluse) in da-mostrare/,
// così basta copiare un solo file sul telefono.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const siti = ["trattoria-marradi", "trattoria-vegia-terralba"];
mkdirSync(join(root, "da-mostrare"), { recursive: true });

for (const sito of siti) {
  const html = readFileSync(join(root, sito, "index.html"), "utf8").replace(
    /src="\.\.\/foto\/([^"]+)"/g,
    (_, file) => `src="data:image/jpeg;base64,${readFileSync(join(root, "foto", file)).toString("base64")}"`
  );
  writeFileSync(join(root, "da-mostrare", `${sito}.html`), html);
  console.log(`${sito}.html  ${(html.length / 1024).toFixed(0)} KB`);
}
