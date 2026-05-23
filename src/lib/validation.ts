import { getRandomId } from './random';
import type { FilesWithId, FileWithId, ImagesPreview } from './types/file';

const IMAGE_EXTENSIONS = [
  'apng',
  'avif',
  'gif',
  'jpg',
  'jpeg',
  'jfif',
  'pjpeg',
  'pjp',
  'png',
  'svg',
  'webp'
] as const;

type ImageExtensions = typeof IMAGE_EXTENSIONS[number];

const MEDIA_EXTENSIONS = [
  ...IMAGE_EXTENSIONS,
  'mp4',
  'mov',
  'avi',
  'mkv',
  'webm'
] as const;

type MediaExtensions = typeof MEDIA_EXTENSIONS[number];

const BLUESKY_POST_IMAGE_EXTENSIONS = [
  'jpg',
  'jpeg',
  'jfif',
  'pjpeg',
  'pjp',
  'png',
  'webp'
] as const;

type BlueskyPostImageExtensions =
  typeof BLUESKY_POST_IMAGE_EXTENSIONS[number];

const BLUESKY_POST_VIDEO_EXTENSIONS = ['mp4'] as const;

type BlueskyPostVideoExtensions =
  typeof BLUESKY_POST_VIDEO_EXTENSIONS[number];

const BLUESKY_POST_IMAGE_MAX_BYTES = 20 * Math.pow(1024, 2);
const BLUESKY_POST_VIDEO_MAX_BYTES = 100_000_000;

function isValidImageExtension(
  extension: string
): extension is ImageExtensions {
  return IMAGE_EXTENSIONS.includes(
    extension.split('.').pop()?.toLowerCase() as ImageExtensions
  );
}

function isValidMediaExtension(
  extension: string
): extension is MediaExtensions {
  return MEDIA_EXTENSIONS.includes(
    extension.split('.').pop()?.toLowerCase() as MediaExtensions
  );
}

function isValidBlueskyPostImageExtension(
  extension: string
): extension is BlueskyPostImageExtensions {
  return BLUESKY_POST_IMAGE_EXTENSIONS.includes(
    extension.split('.').pop()?.toLowerCase() as BlueskyPostImageExtensions
  );
}

function isValidBlueskyPostVideoExtension(
  extension: string
): extension is BlueskyPostVideoExtensions {
  return BLUESKY_POST_VIDEO_EXTENSIONS.includes(
    extension.split('.').pop()?.toLowerCase() as BlueskyPostVideoExtensions
  );
}

export function isValidImage(name: string, bytes: number): boolean {
  return isValidImageExtension(name) && bytes < 20 * Math.pow(1024, 2);
}

export function isValidMedia(name: string, size: number): boolean {
  return isValidMediaExtension(name) && size < 50 * Math.pow(1024, 2);
}

function isValidBlueskyPostMedia(name: string, size: number): boolean {
  if (isValidBlueskyPostImageExtension(name))
    return size <= BLUESKY_POST_IMAGE_MAX_BYTES;

  if (isValidBlueskyPostVideoExtension(name))
    return size <= BLUESKY_POST_VIDEO_MAX_BYTES;

  return false;
}

export function isValidUsername(
  username: string,
  value: string
): string | null {
  if (value.length < 4)
    return 'Your username must be longer than 4 characters.';
  if (value.length > 15)
    return 'Your username must be shorter than 15 characters.';
  if (!/^\w+$/i.test(value))
    return "Your username can only contain letters, numbers and '_'.";
  if (!/[a-z]/i.test(value)) return 'Include a non-number character.';
  if (value === username) return 'This is your current username.';

  return null;
}

type ImagesData = {
  imagesPreviewData: ImagesPreview;
  selectedImagesData: FilesWithId;
};

type ImagesDataOptions = {
  currentFiles?: number;
  allowUploadingVideos?: boolean;
};

export function getImagesData(
  files: FileList | null,
  { currentFiles, allowUploadingVideos }: ImagesDataOptions = {}
): ImagesData | null {
  if (!files || !files.length) return null;

  const singleEditingMode = currentFiles === undefined;

  const rawImages =
    singleEditingMode ||
    !(currentFiles === 4 || files.length > 4 - currentFiles)
      ? Array.from(files).filter(({ name, size }) =>
          allowUploadingVideos
            ? isValidBlueskyPostMedia(name, size)
            : isValidImage(name, size)
        )
      : null;

  if (!rawImages || !rawImages.length) return null;

  const postMediaVideos = allowUploadingVideos
    ? rawImages.filter(({ name }) => isValidBlueskyPostVideoExtension(name))
    : [];

  if (
    postMediaVideos.length > 1 ||
    (postMediaVideos.length === 1 && rawImages.length > 1)
  )
    return null;

  const imagesId = rawImages.map(({ name }) => {
    const randomId = getRandomId();
    return {
      id: randomId,
      name: name === 'image.png' ? `${randomId}.png` : null
    };
  });

  const imagesPreviewData = rawImages.map((image, index) => ({
    id: imagesId[index].id,
    src: URL.createObjectURL(image),
    alt: imagesId[index].name ?? image.name,
    type: image.type
  }));

  const selectedImagesData = rawImages.map((image, index) =>
    renameFile(image, imagesId[index].id, imagesId[index].name)
  );

  return { imagesPreviewData, selectedImagesData };
}

function renameFile(
  file: File,
  newId: string,
  newName: string | null
): FileWithId {
  return Object.assign(
    newName
      ? new File([file], newName, {
          type: file.type,
          lastModified: file.lastModified
        })
      : file,
    { id: newId }
  );
}
