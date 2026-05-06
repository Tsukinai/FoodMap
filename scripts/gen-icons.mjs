import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(root, 'public/icons/icon.svg'));

await sharp(svg).resize(192, 192).png().toFile(join(root, 'public/icons/icon-192.png'));
await sharp(svg).resize(512, 512).png().toFile(join(root, 'public/icons/icon-512.png'));
console.log('Icons generated.');
