import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brandDir = path.join(root, "public", "brand");

async function removeBackground(input, output, isDarkBackground) {
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
  console.log(`${path.basename(output)}: ${meta.width}x${meta.height}`);
}

await removeBackground(
  path.join(brandDir, "logo-escuro.png"),
  path.join(brandDir, "logo-escuro.png"),
  true,
);

await removeBackground(
  path.join(brandDir, "logo-claro.png"),
  path.join(brandDir, "logo-claro.png"),
  false,
);
