/**
 * Writes src/content/page.schema.json (JSON Schema generated from src/blocks/schema.ts).
 * Gives editors autocompletion/validation for page JSON files and gives agents a machine-readable contract.
 *   npm run schema:export
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { pageSchema } from "../src/blocks/schema.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "src", "content", "page.schema.json");
const schema = z.toJSONSchema(pageSchema, { target: "draft-7" });
writeFileSync(out, JSON.stringify(schema, null, 2) + "\n");
console.log(`wrote ${path.relative(root, out)}`);
