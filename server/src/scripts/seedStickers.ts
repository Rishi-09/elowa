/**
 * Sticker pack seeding.
 *
 *   npm run stickers:seed              -- install the built-in Twemoji packs
 *   npm run stickers:import <file>     -- install packs from a JSON manifest
 *   npm run stickers:list              -- show what is currently published
 *
 * Both writers are idempotent: packs are matched on slug and their stickers
 * replaced, so re-running updates in place instead of duplicating.
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import { env } from '../config/env';
import { Sticker, StickerPack } from '../models/StickerPack';

/* Pinned rather than @latest so a CDN-side release cannot silently change
   every sticker URL already sent in a message. */
const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72';

const twemojiUrl = (codepoint: string) => `${TWEMOJI_BASE}/${codepoint}.png`;

type ManifestSticker = {
  url: string;
  width?: number;
  height?: number;
  keywords?: string[];
};

type ManifestPack = {
  slug: string;
  name: string;
  coverUrl?: string;
  order?: number;
  stickers: ManifestSticker[];
};

const BUILT_IN: ManifestPack[] = [
  {
    slug: 'smileys',
    name: 'Smileys',
    order: 1,
    stickers: [
      '1f600', '1f603', '1f604', '1f601', '1f606', '1f605', '1f602', '1f923',
      '1f642', '1f609', '1f60a', '1f607', '1f970', '1f60d', '1f929', '1f618',
      '1f617', '1f61a', '1f60b', '1f61b', '1f61c', '1f92a', '1f610', '1f611',
      '1f636', '1f60f', '1f612', '1f644', '1f62a', '1f634', '1f637', '1f912',
      '1f915', '1f922', '1f92e', '1f927', '1f975', '1f976', '1f974', '1f635',
    ].map((c) => ({ url: twemojiUrl(c) })),
  },
  {
    slug: 'gestures',
    name: 'Gestures',
    order: 2,
    stickers: [
      '1f44d', '1f44e', '1f44c', '270c', '1f91e', '1f918', '1f919', '1f448',
      '1f449', '1f446', '1f447', '261d', '270b', '1f91a', '1f590', '1f596',
      '1f44b', '1f44f', '1f64c', '1f450', '1f932', '1f91d', '1f64f', '270d',
    ].map((c) => ({ url: twemojiUrl(c) })),
  },
  {
    slug: 'animals',
    name: 'Animals',
    order: 3,
    stickers: [
      '1f436', '1f431', '1f42d', '1f439', '1f430', '1f98a', '1f43b', '1f43c',
      '1f428', '1f42f', '1f981', '1f42e', '1f437', '1f438', '1f435', '1f648',
      '1f649', '1f64a', '1f412', '1f414', '1f427', '1f426', '1f424', '1f986',
      '1f989', '1f987', '1f43a', '1f417', '1f434', '1f984', '1f41d', '1f41b',
    ].map((c) => ({ url: twemojiUrl(c) })),
  },
  {
    slug: 'hearts',
    name: 'Hearts',
    order: 4,
    stickers: [
      '2764', '1f49b', '1f49a', '1f499', '1f49c', '1f5a4', '1f90d', '1f90e',
      '1f494', '2763', '1f495', '1f49e', '1f493', '1f497', '1f496', '2728',
    ].map((c) => ({ url: twemojiUrl(c) })),
  },
];

/* Twemoji assets are square; manifests may say otherwise per sticker. */
const DEFAULT_SIZE = 512;

function assertValid(packs: ManifestPack[]): void {
  for (const p of packs) {
    if (!p.slug || !p.name) throw new Error(`Pack is missing slug or name: ${JSON.stringify(p)}`);
    if (!Array.isArray(p.stickers) || p.stickers.length === 0) {
      throw new Error(`Pack "${p.slug}" has no stickers.`);
    }
    for (const s of p.stickers) {
      if (!/^https:\/\//.test(s.url)) {
        throw new Error(`Pack "${p.slug}" has a non-https sticker url: ${s.url}`);
      }
    }
  }
}

async function writePacks(packs: ManifestPack[]): Promise<void> {
  assertValid(packs);

  for (const p of packs) {
    const coverUrl = p.coverUrl ?? p.stickers[0]!.url;
    const pack = await StickerPack.findOneAndUpdate(
      { slug: p.slug },
      { slug: p.slug, name: p.name, coverUrl, order: p.order ?? 0, published: true },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    /* Replace wholesale: a pack's contents are defined by the manifest, and
       leaving orphans behind would show stickers the manifest dropped. */
    await Sticker.deleteMany({ packId: pack._id });
    await Sticker.insertMany(
      p.stickers.map((s, i) => ({
        packId: pack._id,
        url: s.url,
        width: s.width ?? DEFAULT_SIZE,
        height: s.height ?? DEFAULT_SIZE,
        keywords: s.keywords ?? [],
        order: i,
      })),
    );

    console.log(`  ${p.slug.padEnd(12)} ${String(p.stickers.length).padStart(3)} stickers`);
  }
}

async function list(): Promise<void> {
  const packs = await StickerPack.find().sort({ order: 1 });
  if (packs.length === 0) {
    console.log('No sticker packs published.');
    return;
  }
  for (const p of packs) {
    const count = await Sticker.countDocuments({ packId: p._id });
    const state = p.published ? 'published' : 'hidden';
    console.log(`  ${p.slug.padEnd(12)} ${String(count).padStart(3)} stickers  (${state})`);
  }
}

async function main(): Promise<void> {
  const [command, arg] = process.argv.slice(2);

  await mongoose.connect(env.MONGO_URI);
  console.log(`Connected to ${env.MONGO_URI.replace(/:[^:@/]+@/, ':***@')}`);

  try {
    if (command === 'import') {
      if (!arg) throw new Error('Usage: npm run stickers:import -- <manifest.json>');
      const raw = await readFile(arg, 'utf8');
      const parsed = JSON.parse(raw) as ManifestPack[] | { packs: ManifestPack[] };
      const packs = Array.isArray(parsed) ? parsed : parsed.packs;
      console.log(`Importing ${packs.length} pack(s) from ${arg}:`);
      await writePacks(packs);
    } else if (command === 'list') {
      await list();
    } else {
      console.log(`Seeding ${BUILT_IN.length} built-in Twemoji packs:`);
      await writePacks(BUILT_IN);
    }
    console.log('Done.');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
