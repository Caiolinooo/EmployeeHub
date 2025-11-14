// Generate PWA icons from existing brand image using node-canvas
// (Sempre verificar o sistema antes para ter certeza do que está fazendo para não gerar erros)

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function generateIcon(srcPath, outPath, size, bg = '#FFFFFF') {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  const img = await loadImage(srcPath);

  // Fit the image preserving aspect ratio with padding
  const padding = Math.round(size * 0.12); // 12% padding
  const targetW = size - padding * 2;
  const targetH = size - padding * 2;
  const imgRatio = img.width / img.height;
  const boxRatio = targetW / targetH;

  let drawW, drawH;
  if (imgRatio > boxRatio) {
    drawW = targetW;
    drawH = Math.round(targetW / imgRatio);
  } else {
    drawH = targetH;
    drawW = Math.round(targetH * imgRatio);
  }

  const dx = Math.round((size - drawW) / 2);
  const dy = Math.round((size - drawH) / 2);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, dx, dy, drawW, drawH);

  const buffer = canvas.toBuffer('image/png');
  await fs.promises.writeFile(outPath, buffer);
  console.log(`✅ Generated ${path.basename(outPath)} (${size}x${size})`);
}

async function main() {
  try {
    const root = process.cwd();
    const brandSrc = path.join(root, 'public', 'images', 'LC1_Azul.png');
    const outDir = path.join(root, 'public', 'icons');
    await ensureDir(outDir);

    // Verify brand source exists
    await fs.promises.access(brandSrc, fs.constants.R_OK);

    const variants = [
      { name: 'icon-192.png', size: 192 },
      { name: 'icon-512.png', size: 512 },
      { name: 'badge-72.png', size: 72 },
    ];

    for (const v of variants) {
      const outPath = path.join(outDir, v.name);
      await generateIcon(brandSrc, outPath, v.size, '#FFFFFF');
    }

    console.log('🎉 All PWA icons generated in /public/icons');
  } catch (e) {
    console.error('❌ Failed to generate PWA icons:', e.message || e);
    process.exit(1);
  }
}

main();

