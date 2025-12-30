import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// Configure S3 client for Digital Ocean Spaces
const s3Client = new S3Client({
  endpoint: process.env.DO_SPACES_ENDPOINT || 'https://fra1.digitaloceanspaces.com',
  region: process.env.DO_SPACES_REGION || 'fra1',
  credentials: {
    accessKeyId: process.env.DO_SPACES_KEY || '',
    secretAccessKey: process.env.DO_SPACES_SECRET || '',
  },
});

const BUCKET_NAME = process.env.DO_SPACES_BUCKET || 'petreunite';
const CDN_URL = process.env.DO_SPACES_CDN_URL || `https://${BUCKET_NAME}.fra1.cdn.digitaloceanspaces.com`;

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (_req, file, cb) => {
    // Allow only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Только изображения разрешены'));
    }
  },
});

// Process and upload image
async function processAndUpload(
  buffer: Buffer,
  originalName: string,
  userId: string
): Promise<{ url: string; key: string }> {
  // Generate unique filename
  const ext = originalName.split('.').pop()?.toLowerCase() || 'jpg';
  const filename = `${uuidv4()}.${ext === 'png' ? 'png' : 'jpg'}`;
  const key = `uploads/${userId}/${filename}`;

  // Process image with sharp - resize and optimize
  let processedBuffer: Buffer;

  if (ext === 'png') {
    processedBuffer = await sharp(buffer)
      .resize(1200, 1200, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png({ quality: 85, compressionLevel: 9 })
      .toBuffer();
  } else {
    processedBuffer = await sharp(buffer)
      .resize(1200, 1200, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();
  }

  // Upload to S3/Spaces
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: processedBuffer,
      ContentType: ext === 'png' ? 'image/png' : 'image/jpeg',
      ACL: 'public-read',
      CacheControl: 'public, max-age=31536000', // 1 year cache
    })
  );

  return {
    url: `${CDN_URL}/${key}`,
    key,
  };
}

// Generate thumbnail
async function generateThumbnail(
  buffer: Buffer,
  key: string
): Promise<string> {
  const thumbKey = key.replace('uploads/', 'thumbs/');

  const thumbnailBuffer = await sharp(buffer)
    .resize(300, 300, {
      fit: 'cover',
      position: 'center',
    })
    .jpeg({ quality: 80, progressive: true })
    .toBuffer();

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: thumbKey,
      Body: thumbnailBuffer,
      ContentType: 'image/jpeg',
      ACL: 'public-read',
      CacheControl: 'public, max-age=31536000',
    })
  );

  return `${CDN_URL}/${thumbKey}`;
}

// Upload single image
router.post(
  '/',
  requireAuth,
  upload.single('image'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const file = req.file;

      if (!file) {
        throw new AppError('Файл не загружен', 400);
      }

      // Check if Spaces is configured
      if (!process.env.DO_SPACES_KEY || !process.env.DO_SPACES_SECRET) {
        // Fallback to base64 if Spaces not configured
        const base64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
        res.json({
          url: base64,
          thumbnail: base64,
          isBase64: true,
        });
        return;
      }

      // Process and upload main image
      const { url, key } = await processAndUpload(file.buffer, file.originalname, userId);

      // Generate thumbnail
      const thumbnailUrl = await generateThumbnail(file.buffer, key);

      res.json({
        url,
        thumbnail: thumbnailUrl,
        key,
        isBase64: false,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete image (for cleanup)
router.delete('/:key(*)', requireAuth, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { key } = req.params;
    const userId = req.userId!;

    // Security check - only allow deleting own uploads
    if (!key.includes(`uploads/${userId}/`)) {
      throw new AppError('Нет прав на удаление этого файла', 403);
    }

    // Delete main image
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );

    // Delete thumbnail
    const thumbKey = key.replace('uploads/', 'thumbs/');
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: thumbKey,
      })
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
