import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const fixedRouteDirectories = [
  "home",
  "kyutomatte",
  "cargo",
  "open-works",
  "splatify-webapp",
  "splatify-webapp-export",
  "feedback"
];

export const openWorkRouteAliases = {
  "touch-designer": "interactive-visuals"
};

export function collectRouteDirectories(openWorksCsv) {
  const slugs = [...String(openWorksCsv).matchAll(/,\/([^,\r\n]+)(?=\s*(?:\r?\n|$))/g)]
    .map((match) => match[1].trim().replace(/^\/+|\/+$/g, ""))
    .filter(Boolean);

  return [...new Set([...fixedRouteDirectories, ...slugs, ...Object.keys(openWorkRouteAliases)])];
}

export async function writeRouteEntries({
  distDirectory = resolve("dist"),
  openWorksCsv = resolve("public/data/open-works.csv")
} = {}) {
  const [html, csv] = await Promise.all([readFile(resolve(distDirectory, "index.html")), readFile(openWorksCsv, "utf8")]);
  const routeDirectories = collectRouteDirectories(csv);

  await Promise.all(
    routeDirectories.map(async (route) => {
      const routeDirectory = resolve(distDirectory, route);
      await mkdir(routeDirectory, { recursive: true });
      await writeFile(resolve(routeDirectory, "index.html"), html);
    })
  );

  return routeDirectories;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const routes = await writeRouteEntries();
  console.log(`Created ${routes.length} GitHub Pages route entries.`);
}
