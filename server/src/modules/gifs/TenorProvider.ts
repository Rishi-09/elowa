import { env } from '../../config/env';
import { Errors } from '../../lib/errors';
import type { Gif, GifProvider } from './GifProvider';

type TenorMediaFormat = { url: string; dims: [number, number] };
type TenorResult = {
  id: string;
  media_formats: Record<string, TenorMediaFormat>;
};
type TenorResponse = { results: TenorResult[] };

function assertConfigured(): void {
  if (!env.TENOR_API_KEY) {
    throw Errors.badRequest('gifs_not_configured', 'GIF provider is not configured');
  }
}

async function callTenor(path: string, params: Record<string, string>): Promise<TenorResponse> {
  const q = new URLSearchParams({
    key: env.TENOR_API_KEY!,
    client_key: env.TENOR_CLIENT_KEY,
    media_filter: 'gif,tinygif,mp4',
    ...params,
  });
  const res = await fetch(`https://tenor.googleapis.com/v2/${path}?${q.toString()}`);
  if (!res.ok) throw Errors.badRequest('gifs_upstream', `Tenor returned ${res.status}`);
  return (await res.json()) as TenorResponse;
}

function toGif(r: TenorResult): Gif | null {
  const full = r.media_formats.gif ?? r.media_formats.mp4;
  const preview = r.media_formats.tinygif ?? full;
  if (!full || !preview) return null;
  return {
    id: r.id,
    url: full.url,
    previewUrl: preview.url,
    width: full.dims[0],
    height: full.dims[1],
    mime: full === r.media_formats.mp4 ? 'video/mp4' : 'image/gif',
  };
}

export const tenorProvider: GifProvider = {
  name: 'tenor',

  async search(query, limit) {
    assertConfigured();
    const data = await callTenor('search', { q: query, limit: String(Math.min(limit, 50)) });
    return data.results.map(toGif).filter((g): g is Gif => !!g);
  },

  async trending(limit) {
    assertConfigured();
    const data = await callTenor('featured', { limit: String(Math.min(limit, 50)) });
    return data.results.map(toGif).filter((g): g is Gif => !!g);
  },
};
