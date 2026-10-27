import { promises as fs } from "node:fs";
import path from "node:path";
import { assertSafeKey, type FileStorage } from "./index";

export class LocalStorage implements FileStorage {
  readonly driver = "local";
  private readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  private resolve(key: string) {
    assertSafeKey(key);
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error("Storage key escapes root");
    return full;
  }

  async put(key: string, data: Buffer) {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    // Write-then-rename so a crash never leaves a half-written evidence file.
    const tmp = `${full}.${process.pid}.tmp`;
    await fs.writeFile(tmp, data, { mode: 0o640 });
    await fs.rename(tmp, full);
  }

  async get(key: string) {
    return fs.readFile(this.resolve(key));
  }

  async exists(key: string) {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async remove(key: string) {
    await fs.rm(this.resolve(key), { force: true });
  }
}
