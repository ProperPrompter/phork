import { createHmac } from 'crypto';
import { config } from '../config';

/**
 * Generate a mint receipt signature for an asset.
 * This proves the asset was created on-platform by a generation job.
 */
export function signMintReceipt(assetId: string, jobId: string): string {
  const hmac = createHmac('sha256', config.mintReceiptSecret);
  hmac.update(`${assetId}:${jobId}`);
  return hmac.digest('hex');
}

/**
 * Validate that a mint receipt is authentic.
 */
export function validateMintReceipt(assetId: string, jobId: string, signature: string): boolean {
  const expected = signMintReceipt(assetId, jobId);
  return expected === signature;
}
