import type { MongoMemoryServer } from 'mongodb-memory-server';
import fs from 'fs';
import path from 'path';

export default async function globalTeardown(): Promise<void> {
  const mongod = (globalThis as unknown as { __MONGOD__?: MongoMemoryServer }).__MONGOD__;
  if (mongod) await mongod.stop();
  try {
    fs.unlinkSync(path.join(__dirname, '.mongo-uri'));
  } catch {}
}
