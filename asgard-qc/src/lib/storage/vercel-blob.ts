import { BlobNotFoundError, del, get, head, put } from "@vercel/blob";
import { assertSafeKey, type FileStorage } from "./index";

/**
 * Vercel Blob with private access: files have no public URL and are only
 * reachable through the app's authenticated routes. Uses the store's
 * BLOB_READ_WRITE_TOKEN, which Vercel adds when a Blob store is connected.
 */
export class VercelBlobStorage implements FileStorage {
  readonly driver = "vercel-blob";

  async put(key: string, data: Buffer, contentType: string) {
    assertSafeKey(key);
    await put(key, data, { access: "private", contentType, addRandomSuffix: false, allowOverwrite: true });
  }

  async get(key: string) {
    assertSafeKey(key);
    const res = await get(key, { access: "private", useCache: false });
    if (!res || res.statusCode !== 200) throw new Error(`Stored file not found: ${key}`);
    return Buffer.from(await new Response(res.stream).arrayBuffer());
  }

  async exists(key: string) {
    assertSafeKey(key);
    try {
      await head(key);
      return true;
    } catch (err) {
      if (err instanceof BlobNotFoundError) return false;
      throw err;
    }
  }

  async remove(key: string) {
    assertSafeKey(key);
    await del(key);
  }
}
