import { promises as fs } from 'fs';
import { createHmac } from 'crypto';
import path from 'path';
import { config } from '../config';

const STORAGE_ROOT = config.assetStoragePath;

export async function saveAsset(assetId: string, data: Buffer, extension: string): Promise<string> {
  const dir = path.join(STORAGE_ROOT, assetId.substring(0, 2));
  await fs.mkdir(dir, { recursive: true });
  const filename = `${assetId}.${extension}`;
  const filepath = path.join(dir, filename);
  await fs.writeFile(filepath, data);
  return filepath;
}

export async function getAssetPath(assetId: string, extension: string): Promise<string> {
  const dir = path.join(STORAGE_ROOT, assetId.substring(0, 2));
  return path.join(dir, `${assetId}.${extension}`);
}

export async function assetExists(filepath: string): Promise<boolean> {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

const SIGNED_URL_TTL_MS = 15 * 60 * 1000; // 15 minutes

export function generateSignedUrl(assetId: string, baseUrl: string): string {
  const expires = Date.now() + SIGNED_URL_TTL_MS;
  const signature = signAssetUrl(assetId, expires);
  return `${baseUrl}/assets/${assetId}/file?token=${signature}&expires=${expires}`;
}

export function validateSignedUrl(assetId: string, token: string, expires: string): boolean {
  const expiresNum = parseInt(expires, 10);
  if (isNaN(expiresNum) || Date.now() > expiresNum) {
    return false; // Expired
  }
  const expected = signAssetUrl(assetId, expiresNum);
  return expected === token;
}

function signAssetUrl(assetId: string, expires: number): string {
  const hmac = createHmac('sha256', config.mintReceiptSecret);
  hmac.update(`asset-url:${assetId}:${expires}`);
  return hmac.digest('hex');
}
