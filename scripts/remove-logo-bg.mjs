import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const input = process.argv[2];
const output = process.argv[3] ?? path.join(root, "public", "brand", "logo-escuro.png");
const isDarkBackground = process.argv[4] !== "light";

if (!input) {
  console.error("Usage: node scripts/remove-logo-bg.mjs <input> [output] [light]");
  process.exit(1);
}

fs.mkdirSync(path.dirname(output), { recursive: true });

const image = sharp(input);
const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

for (let i = 0; i < data.length; i += 4) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  const transparent = isDarkBackground
    ? r <= 42 && g <= 42 && b <= 42
    : r >= 228 && g >= 218 && b >= 198;

  if (transparent) data[i + 3] = 0;
}

const trimmed = await sharp(data, {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .trim({ threshold: 1 })
  .png()
  .toBuffer();

await sharp(trimmed).png().toFile(output);
const meta = await sharp(output).metadata();
console.log(`Saved ${output}: ${meta.width}x${meta.height}`);
