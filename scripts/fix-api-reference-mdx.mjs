/**
 * Post-processes API Documenter Markdown so Docusaurus can build the docs site.
 *
 * Generated API reference pages include TypeScript types (e.g. `#${string}`) in
 * HTML tables. Docusaurus compiles `.md` as MDX, which treats `${…}` and `{name}`
 * as JavaScript expressions and fails static generation. This script escapes those
 * patterns in prose/table content (not inside fenced code blocks).
 *
 * Invoked from the root `docs:api-reference` npm script after api-documenter runs.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiReferenceDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../doc-site/docs/api-reference",
);

function escapeMdxTemplateExpressions(markdown) {
  const segments = markdown.split(/(```[\s\S]*?```)/g);
  return segments
    .map((segment, index) => {
      if (index % 2 === 1) {
        return segment;
      }
      let prose = segment.replace(/\$\{([^}]+)\}/g, "&#36;{$1}");
      // API Documenter table cells use \`...\`; MDX still treats {id} as expressions inside.
      prose = prose.replace(/\\`([^`]+)\\`/g, (_, inner) => {
        const safe = inner.replace(
          /\{([A-Za-z][A-Za-z0-9_.]*)\}/g,
          "\\{$1\\}",
        );
        return "`" + safe + "`";
      });
      return prose;
    })
    .join("");
}

if (!fs.existsSync(apiReferenceDir)) {
  console.warn(
    `Skipping API reference MDX fix: directory not found at ${apiReferenceDir}`,
  );
  process.exit(0);
}

for (const entry of fs.readdirSync(apiReferenceDir, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".md")) {
    continue;
  }
  const filePath = path.join(apiReferenceDir, entry.name);
  const content = fs.readFileSync(filePath, "utf8");
  const fixed = escapeMdxTemplateExpressions(content);
  if (fixed !== content) {
    fs.writeFileSync(filePath, fixed);
  }
}
