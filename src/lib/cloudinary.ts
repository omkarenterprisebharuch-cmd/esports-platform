import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface UploadResult {
  url: string;
  publicId: string;
  width: number;
  height: number;
}

/**
 * Upload image to Cloudinary
 */
export async function uploadImage(
  file: File,
  folder: string = "esports"
): Promise<UploadResult> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder,
          resource_type: "image",
          transformation: [
            { quality: "auto:good" },
            { fetch_format: "auto" },
          ],
        },
        (error, result) => {
          if (error || !result) {
            reject(error || new Error("Upload failed"));
            return;
          }

          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
          });
        }
      )
      .end(buffer);
  });
}

/**
 * Delete image from Cloudinary
 */
export async function deleteImage(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId);
}

/**
 * Upload tournament poster with specific dimensions
 */
export async function uploadTournamentPoster(file: File): Promise<UploadResult> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: "esports/tournaments",
          resource_type: "image",
          transformation: [
            { width: 1200, height: 630, crop: "fill" },
            { quality: "auto:good" },
            { fetch_format: "auto" },
          ],
        },
        (error, result) => {
          if (error || !result) {
            reject(error || new Error("Upload failed"));
            return;
          }

          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
          });
        }
      )
      .end(buffer);
  });
}

/**
 * Upload user avatar
 */
export async function uploadAvatar(file: File): Promise<UploadResult> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: "esports/avatars",
          resource_type: "image",
          transformation: [
            { width: 200, height: 200, crop: "fill", gravity: "face" },
            { quality: "auto:good" },
            { fetch_format: "auto" },
          ],
        },
        (error, result) => {
          if (error || !result) {
            reject(error || new Error("Upload failed"));
            return;
          }

          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
          });
        }
      )
      .end(buffer);
  });
}

export default cloudinary;
