export type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
export type PieceColor = 'white' | 'black';

export interface Piece {
  type: PieceType;
  color: PieceColor;
}

export type Square = string; // e.g., 'e4', 'a1'

export interface Move {
  from: Square;
  to: Square;
  piece: Piece;
  captured?: Piece;
  promotion?: PieceType;
  isCheck?: boolean;
  isCheckmate?: boolean;
  isCastling?: 'kingside' | 'queenside';
  isEnPassant?: boolean;
}

export interface GameState {
  board: (Piece | null)[][];
  turn: PieceColor;
  castlingRights: {
    white: { kingside: boolean; queenside: boolean };
    black: { kingside: boolean; queenside: boolean };
  };
  enPassantSquare: Square | null;
  halfMoveClock: number;
  fullMoveNumber: number;
  moveHistory: Move[];
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
}

export type GameMode = 'bullet-1' | 'blitz-3' | 'blitz-5';

export interface GameConfig {
  mode: GameMode;
  timeControl: number; // in seconds
  entryFee: number; // in USD
}

export const GAME_MODES: Record<GameMode, GameConfig> = {
  'bullet-1': { mode: 'bullet-1', timeControl: 60, entryFee: 10 },
  'blitz-3': { mode: 'blitz-3', timeControl: 180, entryFee: 5 },
  'blitz-5': { mode: 'blitz-5', timeControl: 300, entryFee: 3 },
};

export const PLATFORM_FEE_RATE = 0.1;

export interface Player {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  walletBalance: number;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  gamesDraw: number;
  totalEarnings?: number;
  isBanned: boolean;
  isFrozen: boolean;
  createdAt: Date;
}

export interface GameRoom {
  id: string;
  mode: GameMode;
  whitePlayer: Player | null;
  blackPlayer: Player | null;
  gameState: GameState;
  whiteTime: number;
  blackTime: number;
  status: 'waiting' | 'playing' | 'finished';
  result?: 'white' | 'black' | 'draw';
  startedAt?: Date;
  endedAt?: Date;
}

export type CryptoType = 'btc' | 'eth' | 'usdt';

export interface Transaction {
  id: string;
  playerId: string;
  type: 'deposit' | 'withdrawal' | 'game_entry' | 'game_win' | 'game_loss' | 'game_draw' | 'cheat_forfeit';
  amount: number;
  cryptoType?: CryptoType;
  cryptoAddress?: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  createdAt: Date;
  processedAt?: Date;
}
