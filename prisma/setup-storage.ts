// Creates the private photo bucket in Supabase Storage if it does not exist yet.
//   npm run db:storage
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { UPLOADS_BUCKET } from "../src/lib/storage";

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set.");
  const storage = createClient(url, key, { auth: { persistSession: false } }).storage;

  const { data: buckets, error } = await storage.listBuckets();
  if (error) throw new Error(error.message);
  const existing = buckets.find((b) => b.name === UPLOADS_BUCKET);
  if (existing) {
    console.log(`bucket "${UPLOADS_BUCKET}" already exists (${existing.public ? "PUBLIC — should be private!" : "private"})`);
    return;
  }
  const { error: createError } = await storage.createBucket(UPLOADS_BUCKET, { public: false, fileSizeLimit: 9 * 1024 * 1024 });
  if (createError) throw new Error(createError.message);
  console.log(`bucket "${UPLOADS_BUCKET}" created (private)`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
