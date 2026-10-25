import fs from 'fs';
import path from 'path';

try {
  const p = path.join(__dirname, '.mongo-uri');
  if (fs.existsSync(p)) {
    process.env.MONGO_URI = fs.readFileSync(p, 'utf-8').trim();
  }
} catch {}

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-16-chars';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-16-chars';
process.env.ACCESS_TTL_SECONDS = '600';
process.env.REFRESH_TTL_DAYS = '30';
process.env.CORS_ORIGIN = '*';
process.env.LOG_LEVEL = 'silent';
process.env.PUBLIC_BASE_URL = 'http://127.0.0.1:4000';
process.env.MEDIA_PROVIDER = 'local';
process.env.MEDIA_LOCAL_DIR = './var/test-media';
/* Small caps keep the oversize-upload test fast. */
process.env.MEDIA_MAX_IMAGE_BYTES = '4096';
process.env.MEDIA_MAX_VIDEO_BYTES = '8192';
/* Suites create many accounts; the shipped auth limit would throttle them.
   Limiter behaviour itself is covered by rateLimit.test.ts. */
process.env.RATE_LIMIT_AUTH_MAX = '5000';
process.env.RATE_LIMIT_GENERAL_MAX = '5000';
process.env.RATE_LIMIT_MEDIA_MAX = '5000';
process.env.RATE_LIMIT_UPLOAD_MAX = '5000';
