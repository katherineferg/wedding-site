import sharp from "sharp";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";

const SOURCE_DIR = "../celebrant/static/uploads";
const OUTPUT_DIR = "./src/assets/images";
const MAX_DIMENSION = 2560;
const JPEG_QUALITY = 82;

const RENAME_MAP = {
  "img-7328.png": "kate-portrait.jpg",
  "87282206-4379-4446-8925-b8eda386c243.png": "kate-about-photo.jpg",
  "fullsizerender.jpeg": "ceremony-hannah-larsen.jpg",
  "fullsizerender-1.jpeg": "ceremony-hannah-larsen-2.jpg",
  "img-3065.jpeg": "ceremony-laura-ben-beach.jpg",
  "img-3100.jpeg": "ceremony-outdoor.jpg",
  "img-3858.jpeg": "ceremony-portrait.jpg",
  "img-5934.jpeg": "couple-katie-jack.jpg",
  "3480990e-983c-4148-9e97-a91e8e0ff31d.jpeg": "wedding-moment.jpg",
  "a62d505526331cea529a8573e13d9ecf.jpeg": "wedding-detail.jpg",
  "bill-stephan-9lkqymzflre-unsplash.jpg": "hero-background.jpg",
  "414-4140360-dog-paw-print-clipart-clipart-free-library-image.png": null,
};

const MAX_SIZE_KB = 500;

async function processImages() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const oversized = [];

  for (const [original, newName] of Object.entries(RENAME_MAP)) {
    if (!newName) {
      console.log(`Skipped: ${original} (not needed)`);
      continue;
    }

    const inputPath = path.join(SOURCE_DIR, original);
    const outputPath = path.join(OUTPUT_DIR, newName);

    await sharp(inputPath)
      .resize(MAX_DIMENSION, MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .modulate({ brightness: 1.02, saturation: 1.05 })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toFile(outputPath);

    const info = await stat(outputPath);
    const sizeKB = Math.round(info.size / 1024);
    console.log(`Processed: ${original} -> ${newName} (${sizeKB}KB)`);

    if (sizeKB > MAX_SIZE_KB) {
      oversized.push({ original, newName, outputPath, inputPath, sizeKB });
    }
  }

  if (oversized.length > 0) {
    console.log(
      `\nReprocessing ${oversized.length} oversized files at quality 75...`
    );
    for (const { original, newName, outputPath, inputPath, sizeKB } of oversized) {
      await sharp(inputPath)
        .resize(MAX_DIMENSION, MAX_DIMENSION, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .modulate({ brightness: 1.02, saturation: 1.05 })
        .jpeg({ quality: 75, mozjpeg: true })
        .toFile(outputPath);

      const info = await stat(outputPath);
      const newSizeKB = Math.round(info.size / 1024);
      console.log(
        `Reprocessed: ${newName} (${sizeKB}KB -> ${newSizeKB}KB)`
      );
    }
  }

  console.log("\nDone. All images processed.");
}

processImages().catch(console.error);
