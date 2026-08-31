import sharp from 'sharp';
import { randomUUID } from 'node:crypto';

export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeKB?: number;
  format?: 'webp' | 'jpeg' | 'png';
}

const DEFAULT_OPTIONS: ImageOptimizationOptions = {
  maxWidth: 800,
  maxHeight: 800,
  quality: 80,
  maxSizeKB: 150,
  format: 'webp',
};

/**
 * Optimize image for upload - resize, convert to WebP, limit size
 * Returns optimized buffer and metadata
 */
export async function optimizeImage(
  buffer: Buffer,
  options: ImageOptimizationOptions = {}
): Promise<{ buffer: Buffer; metadata: { width: number; height: number; size: number; format: string } }> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  let image = sharp(buffer);
  const metadata = await image.metadata();
  
  // Resize if larger than max dimensions
  if (metadata.width && metadata.height) {
    if (metadata.width > opts.maxWidth! || metadata.height > opts.maxHeight!) {
      image = image.resize(opts.maxWidth, opts.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }
  }
  
  // Convert to WebP with quality adjustment to meet size limit
  let quality = opts.quality!;
  let outputBuffer: Buffer;
  
  // Try to meet size constraint by reducing quality
  do {
    outputBuffer = await image
      .webp({ quality, effort: 4, smartSubsample: true })
      .toBuffer();
    
    const sizeKB = outputBuffer.length / 1024;
    
    if (sizeKB <= opts.maxSizeKB!) {
      break;
    }
    
    quality -= 10;
    if (quality < 30) {
      // If quality too low, reduce dimensions further
      const currentMeta = await sharp(outputBuffer).metadata();
      image = sharp(buffer).resize(
        Math.floor((currentMeta.width || opts.maxWidth!) * 0.7),
        Math.floor((currentMeta.height || opts.maxHeight!) * 0.7),
        { fit: 'inside' }
      );
      quality = opts.quality!;
    }
  } while (quality >= 30);
  
  const finalMetadata = await sharp(outputBuffer).metadata();
  
  return {
    buffer: outputBuffer,
    metadata: {
      width: finalMetadata.width || 0,
      height: finalMetadata.height || 0,
      size: outputBuffer.length,
      format: 'webp',
    },
  };
}

/**
 * Validate file before processing
 * Blocks videos, large PDFs, large images, and active content (SVG/HTML)
 */
export function validateFileUpload(
  file: { name: string; type: string; size: number }
): { valid: boolean; error?: string } {
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB absolute max
  const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB for images before optimization
  const MAX_PDF_SIZE = 1 * 1024 * 1024; // 1MB for PDFs

  // Block video files
  const blockedTypes = [
    'video/',
    'audio/',
    'application/x-msvideo',
    'application/x-shockwave-flash',
    // Active content: SVG can carry <script>/onload handlers -> stored XSS
    'image/svg+xml',
    'text/html',
    'application/xhtml+xml',
    'application/xml',
    'text/xml',
  ];

  if (blockedTypes.some(type => file.type.startsWith(type))) {
    return { valid: false, error: 'Video, audio, and SVG/HTML files are not allowed. Please upload images only.' };
  }

  // Check file extension for additional security
  const blockedExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.mp3', '.wav', '.flac', '.svg', '.svgz', '.htm', '.html', '.xml', '.xhtml'];
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  if (blockedExtensions.includes(ext)) {
    return { valid: false, error: 'This file type is not allowed.' };
  }
  
  // Size checks by type
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File too large. Maximum size is 5MB.' };
  }
  
  if (file.type.startsWith('image/') && file.size > MAX_IMAGE_SIZE) {
    return { valid: false, error: 'Image too large. Maximum size is 2MB. Please resize before uploading.' };
  }
  
  if (file.type === 'application/pdf' && file.size > MAX_PDF_SIZE) {
    return { valid: false, error: 'PDF too large. Maximum size is 1MB. Please compress before uploading.' };
  }
  
  // Only allow specific file types
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  
  if (!allowedTypes.includes(file.type) && !file.type.startsWith('image/')) {
    return { valid: false, error: 'Invalid file type. Only images, PDFs, and Word documents are allowed.' };
  }

  return { valid: true };
}

/**
 * Magic-byte (file signature) sniffing.
 *
 * SECURITY: the client-controlled Content-Type is never trusted. A file
 * claiming to be image/jpeg must actually start with a JPEG signature,
 * otherwise a polyglot/HTML/SVG payload could be stored and later served
 * with a dangerous interpretation.
 */
const MAGIC_SIGNATURES: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF8
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF....WEBP (checked below)
];

function matchesSignature(buffer: Buffer, bytes: number[], offset = 0): boolean {
  if (buffer.length < offset + bytes.length) return false;
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

/** Returns the sniffed MIME type from magic bytes, or null if unrecognized. */
export function sniffContentType(buffer: Buffer): string | null {
  for (const sig of MAGIC_SIGNATURES) {
    if (sig.mime === 'image/webp') {
      // RIFF container: bytes 0-3 "RIFF", bytes 8-11 "WEBP"
      if (matchesSignature(buffer, sig.bytes, 0) && matchesSignature(buffer, [0x57, 0x45, 0x42, 0x50], 8)) {
        return 'image/webp';
      }
      continue;
    }
    if (matchesSignature(buffer, sig.bytes, sig.offset || 0)) {
      return sig.mime;
    }
  }
  // Legacy Office formats (OLE2 compound document)
  if (matchesSignature(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    return 'application/msword';
  }
  // ZIP container: modern Office (docx)
  if (matchesSignature(buffer, [0x50, 0x4b, 0x03, 0x04])) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  return null;
}

/**
 * Validate that a buffer's magic bytes match its claimed content type.
 * Rejects files whose signature does not support the declared type and any
 * buffer that sniffs as HTML/SVG/scriptable content.
 */
export function validateBufferMagicBytes(
  buffer: Buffer,
  claimedType: string,
): { valid: boolean; error?: string } {
  if (buffer.length === 0) {
    return { valid: false, error: 'Empty file.' };
  }

  const sniffed = sniffContentType(buffer);

  // Anything that parses as text/html or XML/SVG markup is rejected outright.
  const head = buffer.subarray(0, 256).toString('utf8').toLowerCase();
  if (/^\s*(<\?xml|<!doctype\s+html|<html|<svg)/.test(head)) {
    return { valid: false, error: 'HTML, XML, and SVG content is not allowed.' };
  }

  if (!sniffed) {
    return { valid: false, error: 'Unrecognized file contents.' };
  }

  const claimed = String(claimedType || '').split(';')[0].trim().toLowerCase();

  // Allow the sniffed type to be a family match for the claim
  // (e.g. claim image/jpg but signature is image/jpeg).
  const compatible = (claim: string, actual: string): boolean =>
    claim === actual ||
    (claim === 'image/jpg' && actual === 'image/jpeg') ||
    (claim.startsWith('image/') && actual.startsWith('image/')) ||
    (claim === 'application/octet-stream');

  if (!compatible(claimed, sniffed)) {
    return {
      valid: false,
      error: `File contents do not match the declared type (${claimed}).`,
    };
  }

  return { valid: true };
}

/**
 * Generate optimized filename with timestamp
 */
export function generateOptimizedFilename(originalName: string): string {
  const timestamp = Date.now();
  const uuid = randomUUID().slice(0, 8);
  return `${timestamp}-${uuid}.webp`;
}

/**
 * Create placeholder/blurhash for loading states
 */
export async function createPlaceholder(buffer: Buffer): Promise<string> {
  try {
    const placeholder = await sharp(buffer)
      .resize(10, 10, { fit: 'fill' })
      .blur()
      .webp({ quality: 20 })
      .toBuffer();
    
    return `data:image/webp;base64,${placeholder.toString('base64')}`;
  } catch {
    return '';
  }
}
