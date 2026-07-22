// One-off script: rasterizes the Logo favicon variant (see src/components/Logo.tsx)
// into the static icon assets referenced by src/app/layout.tsx metadata and
// public/manifest.webmanifest. Re-run this if the mark ever changes.
import sharp from "sharp";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";

const TILE_BG = "#27357E";
const PIN_COLOR = "#F08A00";
const STROKE_COLOR = "#FCFAF4";
const FAVICON_CURL_PATH =
  "M25 61 C24 50 40 42 52 48 C64 54 60 68 48 68 C38 68 36 58 46 54 C58 49 70 52 74 42";

function faviconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <rect width="96" height="96" rx="24" fill="${TILE_BG}"/>
  <path d="${FAVICON_CURL_PATH}" fill="none" stroke="${STROKE_COLOR}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="74" cy="30" r="11" fill="${PIN_COLOR}"/>
  <circle cx="74" cy="30" r="4" fill="${STROKE_COLOR}"/>
</svg>`;
}

// Minimal single-image "PNG-in-ICO" container — every modern browser and OS
// supports this, and it avoids pulling in a dedicated ICO-encoding dependency.
function buildIco(pngBuffer, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // image count

  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 = 256)
  entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
  entry.writeUInt8(0, 2); // color palette
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(pngBuffer.length, 8); // image data size
  entry.writeUInt32LE(header.length + entry.length, 12); // offset

  return Buffer.concat([header, entry, pngBuffer]);
}

async function main() {
  const projectRoot = path.resolve(import.meta.dirname, "..");
  const publicDir = path.join(projectRoot, "public");
  const appDir = path.join(projectRoot, "src", "app");
  mkdirSync(publicDir, { recursive: true });

  const svg = faviconSvg();
  writeFileSync(path.join(publicDir, "icon.svg"), svg);

  const svgBuffer = Buffer.from(svg);

  const png192 = await sharp(svgBuffer).resize(192, 192).png().toBuffer();
  writeFileSync(path.join(publicDir, "icon-192.png"), png192);

  const png512 = await sharp(svgBuffer).resize(512, 512).png().toBuffer();
  writeFileSync(path.join(publicDir, "icon-512.png"), png512);

  const appleTouch = await sharp(svgBuffer).resize(180, 180).png().toBuffer();
  writeFileSync(path.join(publicDir, "apple-touch-icon.png"), appleTouch);

  const png32 = await sharp(svgBuffer).resize(32, 32).png().toBuffer();
  const ico = buildIco(png32, 32);
  writeFileSync(path.join(appDir, "favicon.ico"), ico);

  console.log("Generated icon.svg, icon-192.png, icon-512.png, apple-touch-icon.png, favicon.ico");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
