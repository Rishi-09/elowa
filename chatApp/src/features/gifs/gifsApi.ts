import { api } from '@/services/api';

export type Gif = {
  id: string;
  url: string;
  previewUrl: string;
  width: number;
  height: number;
  mime: 'image/gif' | 'video/mp4';
};

export const gifsApi = {
  search: (q: string, limit = 24) =>
    api.get<Gif[]>(`/gifs/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  trending: (limit = 24) => api.get<Gif[]>(`/gifs/trending?limit=${limit}`),
};
