import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** Big enough for the largest avatar on a sharp screen. */
const PHOTO_WIDTH = 400;

/**
 * A picked or taken photo (a file on this device) as a small JPEG in base64, ready to upload.
 * Phone cameras take photos of several megabytes; this is usually under 50 KB.
 */
export async function shrinkPhoto(uri: string) {
  const image = await ImageManipulator.manipulate(uri).resize({ width: PHOTO_WIDTH }).renderAsync();
  const { base64 } = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!base64) throw new Error('The photo could not be read.');
  return base64;
}
