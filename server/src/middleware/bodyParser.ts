import express, { NextFunction, Request, Response } from 'express';

// Large body parser for upload routes (configurable via env)
const maxUploadSize = process.env.MAX_UPLOAD_SIZE || '15mb';
export const largeBodyParser = express.json({ limit: maxUploadSize });

// Error handler for payload too large (413)
export function payloadTooLargeHandler(
  err: Error & { status?: number; limit?: number; length?: number },
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err.status === 413) {
    const maxSizeMB = (err.limit || 1048576) / (1024 * 1024);
    res.status(413).json({
      error: 'Payload Too Large',
      message: `Request body exceeds maximum size of ${maxSizeMB.toFixed(1)}MB`,
      maxSize: err.limit,
      receivedSize: err.length,
    });
    return;
  }
  next(err);
}
