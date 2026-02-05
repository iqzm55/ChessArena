import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  jwtSecret: process.env.JWT_SECRET || 'chesscrypto-dev-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  withdrawalFee: 1,
  platformFeeRate: 0.1,
  databasePath: process.env.DATABASE_PATH,
};

export type GameMode = 'bullet-1' | 'blitz-3' | 'blitz-5';

export const GAME_MODES: Record<GameMode, { timeControl: number; entryFee: number }> = {
  'bullet-1': { timeControl: 60, entryFee: 10 },
  'blitz-3': { timeControl: 180, entryFee: 5 },
  'blitz-5': { timeControl: 300, entryFee: 3 },
};
