#!/usr/bin/env node
// Ruling 1714 (handoff 60-MEDIA-2 Work 5): every image a member uploads renders through Strand's image
// parts. Outside src/components/strand/, a raw <img> or a url( expression (a background, a mask, a
// string that becomes one) passes only when docs/media-sites.md lists it: in its Assets table, or in
// its Held table, which names the Strand item the site waits for. Anything else is a defect, named
// by file and line. `bun run lint` runs this after eslint; `bun run lint:media` runs it alone.
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const TABLE = path.join(ROOT, "docs", "media-sites.md");
const SCAN = ["src", "admin/src"];
const SKIP_DIR = /(^|\/)(node_modules|dist|\.output|\.wrangler)(\/|$)/;
const EXEMPT = "src/components/strand/";
const EXT = /\.(tsx|ts|jsx|js|css)$/;

/** The rows of one `## <name>` section's table: file and source, each read from its backticks. */
function rows(md, name) {
  const at = md.search(new RegExp("^## " + name + "\\s*$", "m"));
  if (at < 0) throw new Error(`docs/media-sites.md has no "## ${name}" section`);
  const rest = md.slice(at).split("\n").slice(1);
  const end = rest.findIndex((l) => /^## /.test(l));
  const out = [];
  for (const line of end < 0 ? rest : rest.slice(0, end)) {
    if (!/^\|/.test(line) || /^\|\s*-/.test(line)) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    const file = /^`([^`]+)`$/.exec(cells[0] || "");
    const source = /^`(.+)`$/.exec(cells[2] || "");
    if (file && source) out.push({ file: file[1], source: source[1] });
  }
  return out;
}

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    const rel = path.relative(ROOT, p).split(path.sep).join("/");
    if (SKIP_DIR.test(rel)) continue;
    if (e.isDirectory()) walk(p, out);
    else if (EXT.test(e.name) && !rel.startsWith(EXEMPT)) out.push(rel);
  }
  return out;
}

const comment = (line) => /^\s*(\/\/|\*|\/\*|\{\s*\/\*)/.test(line);

/** The text of an <img>'s src attribute, read across lines until the tag closes. */
function imgSource(lines, i, col) {
  const tag = [];
  for (let j = i; j < lines.length && j < i + 40; j++) {
    const t = j === i ? lines[j].slice(col) : lines[j];
    tag.push(t);
    if (/\/?>/.test(t.replace(/=>/g, ""))) break;
  }
  const text = tag.join("\n");
  const m = /\bsrc\s*=\s*(\{|"|')/.exec(text);
  if (!m) return "";
  const from = m.index + m[0].length;
  if (m[1] !== "{") return text.slice(from, text.indexOf(m[1], from));
  let depth = 1;
  for (let k = from; k < text.length; k++) {
    if (text[k] === "{") depth++;
    else if (text[k] === "}" && --depth === 0) return text.slice(from, k);
  }
  return text.slice(from);
}

function main() {
  const md = fs.readFileSync(TABLE, "utf8");
  const allowed = [...rows(md, "Assets"), ...rows(md, "Held")];
  const files = SCAN.filter((d) => fs.existsSync(path.join(ROOT, d))).flatMap((d) =>
    walk(path.join(ROOT, d), []),
  );
  const defects = [];
  let sites = 0;
  for (const rel of files) {
    const lines = fs.readFileSync(path.join(ROOT, rel), "utf8").split("\n");
    const mine = allowed.filter((a) => a.file === rel);
    lines.forEach((line, i) => {
      if (comment(line)) return;
      const hits = [];
      for (const m of line.matchAll(/<img\b/g)) hits.push(["<img>", imgSource(lines, i, m.index)]);
      // A url( in a stylesheet is read only where it paints a background; a font's src is not an image.
      const css = rel.endsWith(".css");
      for (const m of line.matchAll(/\burl\(/g))
        if (!css || /background/.test(line)) hits.push(["url(", line.slice(m.index).trim()]);
      for (const [kind, src] of hits) {
        sites++;
        const norm = src.replace(/\s+/g, " ").trim();
        const ok = mine.some((a) => norm.includes(a.source.replace(/\s+/g, " ").trim()));
        if (!ok)
          defects.push(
            `${rel}:${i + 1}: a raw ${kind} of ${JSON.stringify(norm.slice(0, 80))} outside Strand's image parts`,
          );
      }
    });
  }
  if (defects.length) {
    console.error(
      `lint-media-sites (ruling 1714): ${defects.length} image site(s) not listed as an asset or a held site in docs/media-sites.md.\n` +
        "Member media renders through Strand's MediaBlock, Avatar and ImageViewer; an asset is added to the Assets table.\n" +
        defects.map((d) => "  " + d).join("\n"),
    );
    process.exit(1);
  }
  console.log(
    `lint-media-sites (ruling 1714): ${sites} raw image site(s) in ${files.length} files, every one listed in docs/media-sites.md.`,
  );
}

main();
