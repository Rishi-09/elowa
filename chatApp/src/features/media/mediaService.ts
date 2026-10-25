import * as ImagePicker from 'expo-image-picker';
import { mediaApi, type MediaKind, type MediaRef } from './mediaApi';

export type PickedAsset = {
  uri: string;
  mime: string;
  width?: number;
  height?: number;
  duration?: number;
  size?: number;
  kind: MediaKind;
  fileName?: string;
};

export type UploadProgress = (loaded: number, total: number) => void;

function kindFromMime(mime: string): MediaKind {
  return mime.startsWith('video/') ? 'video' : 'image';
}

function assetToPicked(a: ImagePicker.ImagePickerAsset): PickedAsset {
  const mime = a.mimeType ?? (a.type === 'video' ? 'video/mp4' : 'image/jpeg');
  return {
    uri: a.uri,
    mime,
    width: a.width,
    height: a.height,
    duration: a.duration ?? undefined,
    size: a.fileSize,
    kind: kindFromMime(mime),
    fileName: a.fileName ?? undefined,
  };
}

/** Thrown when the OS permission prompt was declined. */
export class PermissionError extends Error {
  constructor(public kind: 'photos' | 'camera') {
    super(
      kind === 'camera'
        ? 'Camera access is off. Enable it in Settings to take photos.'
        : 'Photo access is off. Enable it in Settings to share photos.',
    );
  }
}

export const mediaService = {
  /**
   * Returns `null` when the user cancels, and throws `PermissionError` when
   * access was refused - callers show different UI for each.
   */
  async pickFromLibrary(opts?: { allowVideos?: boolean }): Promise<PickedAsset | null> {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) throw new PermissionError('photos');
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: opts?.allowVideos ? ['images', 'videos'] : ['images'],
      quality: 0.85,
      allowsEditing: false,
      videoMaxDuration: 60,
    });
    if (res.canceled || !res.assets?.[0]) return null;
    return assetToPicked(res.assets[0]);
  },

  async captureFromCamera(opts?: { video?: boolean }): Promise<PickedAsset | null> {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new PermissionError('camera');
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: opts?.video ? ['videos'] : ['images'],
      quality: 0.85,
      videoMaxDuration: 60,
    });
    if (res.canceled || !res.assets?.[0]) return null;
    return assetToPicked(res.assets[0]);
  },

  /**
   * Upload bytes to whichever provider the server signed for, then have the
   * server confirm and mint the stored reference. The client never chooses the
   * object key, the size cap or the final URL.
   */
  async upload(asset: PickedAsset, onProgress?: UploadProgress): Promise<MediaRef> {
    const signed = await mediaApi.sign(asset.kind);
    if (asset.size != null && asset.size > signed.maxBytes) {
      throw new Error(
        `That file is ${formatBytes(asset.size)}. The limit is ${formatBytes(signed.maxBytes)}.`,
      );
    }

    let publicId: string;
    let result: { status: number; body: string };

    if (signed.transport === 'raw') {
      publicId = signed.publicIdPrefix;
      result = await uploadRaw(signed.uploadUrl, asset, onProgress);
    } else {
      const form = new FormData();
      for (const [k, v] of Object.entries(signed.params)) form.append(k, String(v));
      form.append('file', {
        uri: asset.uri,
        type: asset.mime,
        name: asset.fileName ?? `upload.${asset.kind === 'video' ? 'mp4' : 'jpg'}`,
      } as unknown as Blob);

      publicId = `${signed.params['folder']}/${signed.params['public_id']}`;
      result = await send('POST', signed.uploadUrl, form, undefined, onProgress);
    }

    if (result.status < 200 || result.status >= 300) {
      throw new Error(uploadErrorMessage(result));
    }

    return mediaApi.confirm({
      publicId,
      kind: asset.kind,
      mime: asset.mime,
      size: asset.size,
      width: asset.width,
      height: asset.height,
      duration: asset.duration,
    });
  },
};

const formatBytes = (bytes: number): string =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.ceil(bytes / 1024)} KB`;

/** Surface the server message when it gave one; never leak raw internals. */
function uploadErrorMessage(result: { status: number; body: string }): string {
  try {
    const parsed = JSON.parse(result.body) as { error?: { message?: string } };
    if (parsed?.error?.message) return parsed.error.message;
  } catch {
    /* body was not JSON */
  }
  return result.status === 413
    ? 'That file is too large to upload.'
    : 'Upload failed. Check your connection and try again.';
}

async function uploadRaw(
  url: string,
  asset: PickedAsset,
  onProgress?: UploadProgress,
): Promise<{ status: number; body: string }> {
  const file = await fetch(asset.uri);
  const blob = await file.blob();
  return send('PUT', url, blob, asset.mime, onProgress);
}

function send(
  method: 'POST' | 'PUT',
  url: string,
  body: FormData | Blob,
  contentType?: string,
  onProgress?: UploadProgress,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    if (contentType) xhr.setRequestHeader('Content-Type', contentType);
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded, e.total);
      };
    }
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.ontimeout = () => reject(new Error('Upload timed out'));
    xhr.onload = () => resolve({ status: xhr.status, body: String(xhr.responseText ?? '') });
    xhr.send(body as never);
  });
}
