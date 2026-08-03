import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brandDir = path.join(root, "public", "brand");

const ARROW = { r: 0xbd, g: 0x1f, b: 0x52 };
const Y_MIN_RATIO = 0.28;
const Y_MAX_RATIO = 0.72;

function isNearWhite(r, g, b) {
  return r > 228 && g > 228 && b > 228;
}

async function fixArrowColor(fileName) {
  const filePath = path.join(brandDir, fileName);
  const image = sharp(filePath);
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const yMin = Math.floor(info.height * Y_MIN_RATIO);
  const yMax = Math.ceil(info.height * Y_MAX_RATIO);
  let replaced = 0;

  for (let y = 0; y < info.height; y += 1) {
    if (y < yMin || y > yMax) continue;
    for (let x = 0; x < info.width; x += 1) {
      const index = (y * info.width + x) * 4;
      if (data[index + 3] < 200) continue;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      if (!isNearWhite(r, g, b)) continue;
      data[index] = ARROW.r;
      data[index + 1] = ARROW.g;
      data[index + 2] = ARROW.b;
      replaced += 1;
    }
  }

  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toFile(filePath);

  console.log(`${fileName}: ${replaced} pixels recolored to #BD1F52`);
}

for (const fileName of ["logo-claro-v2.png", "logo-claro.png"]) {
  await fixArrowColor(fileName);
}
