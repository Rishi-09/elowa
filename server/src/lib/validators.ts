import { z } from 'zod';

/**
 * A URL that is safe to store and later hand to an image loader or a link.
 *
 * `z.string().url()` accepts any scheme, including `javascript:` and `data:`,
 * so anything that ends up in an avatar or media field must go through this
 * instead.
 */
export const httpUrl = z
  .string()
  .url()
  .max(2048)
  .refine((value) => {
    try {
      const { protocol } = new URL(value);
      return protocol === 'http:' || protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Only http(s) URLs are allowed');
