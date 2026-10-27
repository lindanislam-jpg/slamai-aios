import { getStore } from "@netlify/blobs";
import { assertSafeKey, type FileStorage } from "./index";

/**
 * Netlify Blobs: private site-wide store. Blobs have no public URL; files are
 * only reachable through the app's authenticated routes. Strong consistency
 * so a photo is readable immediately after upload.
 */
export class NetlifyBlobsStorage implements FileStorage {
  readonly driver = "netlify-blobs";
  private store() {
    return getStore({ name: process.env.BLOBS_STORE ?? "asgard-qc-files", consistency: "strong" });
  }

  async put(key: string, data: Buffer, contentType: string) {
    assertSafeKey(key);
    const bytes = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    await this.store().set(key, bytes, { metadata: { contentType } });
  }

  async get(key: string) {
    assertSafeKey(key);
    const v = await this.store().get(key, { type: "arrayBuffer" });
    if (v === null) throw new Error(`Stored file not found: ${key}`);
    return Buffer.from(v);
  }

  async exists(key: string) {
    assertSafeKey(key);
    return (await this.store().getMetadata(key)) !== null;
  }

  async remove(key: string) {
    assertSafeKey(key);
    await this.store().delete(key);
  }
}
