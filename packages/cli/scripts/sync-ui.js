import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, '..', '..', '..');
const uiDir = path.resolve(rootDir, 'packages', 'cli-ui', 'dist');
const targetDir = path.resolve(rootDir, 'packages', 'cli', 'dist', 'web')

const main = () => {
  if (!fs.existsSync(uiDir)) {
    console.error('[sync:ui] UI directory not found');
    process.exit(1);
  }

  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });
  fs.cpSync(uiDir, targetDir, { recursive: true });
  console.log('[sync:ui] UI files copied');
}

main();