export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://phork:phork@localhost:5432/phork',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  assetStoragePath: process.env.ASSET_STORAGE_PATH || './storage',
  mintReceiptSecret: process.env.MINT_RECEIPT_SECRET || 'dev-mint-secret',
};
