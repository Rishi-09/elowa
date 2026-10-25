import { api } from '@/services/api';

export type StickerPack = {
  id: string;
  slug: string;
  name: string;
  coverUrl: string;
  order: number;
};

export type Sticker = {
  id: string;
  packId: string;
  url: string;
  width: number;
  height: number;
};

export const stickersApi = {
  listPacks: () => api.get<StickerPack[]>('/stickers/packs'),
  listPackStickers: (packId: string) =>
    api.get<Sticker[]>(`/stickers/packs/${packId}/stickers`),
};
