import { MongoMemoryServer } from 'mongodb-memory-server';
import fs from 'fs';
import path from 'path';

export default async function globalSetup(): Promise<void> {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGO_URI = uri;
  fs.writeFileSync(path.join(__dirname, '.mongo-uri'), uri, 'utf-8');
  (globalThis as unknown as { __MONGOD__: MongoMemoryServer }).__MONGOD__ = mongod;
}
