import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

export function markResetOnNextBoot(): void {
  try {
    const root = path.resolve(config.whatsappSessionPath);
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(path.join(root, ".RESET"), "1");
  } catch {}
}
