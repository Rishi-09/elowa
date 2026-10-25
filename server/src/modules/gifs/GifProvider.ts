export type Gif = {
  id: string;
  url: string;
  previewUrl: string;
  width: number;
  height: number;
  mime: 'image/gif' | 'video/mp4';
};

export interface GifProvider {
  readonly name: string;
  search(query: string, limit: number): Promise<Gif[]>;
  trending(limit: number): Promise<Gif[]>;
}
