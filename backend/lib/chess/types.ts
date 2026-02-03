export type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
export type PieceColor = 'white' | 'black';

export interface Piece {
  type: PieceType;
  color: PieceColor;
}

export type Square = string;

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
