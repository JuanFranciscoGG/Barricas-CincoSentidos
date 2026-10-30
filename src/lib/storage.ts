import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

/**
 * Where uploaded image bytes live. The database only stores the `/uploads/<name>` URL; every
 * read goes through the /uploads/[name] route, which decides who may see the file.
 *  - Production / shared dev: a PRIVATE Supabase Storage bucket, reached with the server-side
 *    secret key (never sent to the browser).
 *  - Without SUPABASE_URL + SUPABASE_SECRET_KEY (and in tests): a folder on local disk.
 */
export interface FileStore {
  put(name: string, bytes: Uint8Array, contentType: string): Promise<void>;
  get(name: string): Promise<Uint8Array | null>;
  remove(name: string): Promise<void>;
}

export const UPLOADS_BUCKET = "uploads";

export function diskStore(dir: string): FileStore {
  return {
    async put(name, bytes) {
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, name), bytes);
    },
    async get(name) {
      try {
        return new Uint8Array(await readFile(path.join(dir, name)));
      } catch {
        return null;
      }
    },
    async remove(name) {
      await unlink(path.join(dir, name)).catch(() => {});
    },
  };
}

export function supabaseStore(url: string, secretKey: string, bucket = UPLOADS_BUCKET): FileStore {
  const files = () => createClient(url, secretKey, { auth: { persistSession: false } }).storage.from(bucket);
  return {
    async put(name, bytes, contentType) {
      const { error } = await files().upload(name, bytes, { contentType, upsert: false });
      if (error) throw new Error(`Storage upload failed: ${error.message}`);
    },
    async get(name) {
      const { data, error } = await files().download(name);
      if (error || !data) return null;
      return new Uint8Array(await data.arrayBuffer());
    },
    async remove(name) {
      await files().remove([name]);
    },
  };
}

let cached: FileStore | undefined;

export function getStore(): FileStore {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  cached = url && key ? supabaseStore(url, key) : diskStore(path.join(process.cwd(), "private-uploads"));
  return cached;
}
