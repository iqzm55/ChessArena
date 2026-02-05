import type { Piece, PieceColor, PieceType, Square, Move, GameState } from './types.js';

export function squareToIndices(square: Square): [number, number] {
  const file = square.charCodeAt(0) - 97;
  const rank = parseInt(square[1]) - 1;
  return [7 - rank, file];
}

export function indicesToSquare(row: number, col: number): Square {
  const file = String.fromCharCode(97 + col);
  const rank = 8 - row;
  return `${file}${rank}`;
}

export function getPieceAt(board: (Piece | null)[][], square: Square): Piece | null {
  const [row, col] = squareToIndices(square);
  return board[row]?.[col] ?? null;
}

function createInitialBoard(): (Piece | null)[][] {
  const board: (Piece | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
  for (let i = 0; i < 8; i++) {
    board[1][i] = { type: 'pawn', color: 'black' };
    board[6][i] = { type: 'pawn', color: 'white' };
  }
  const backRank: PieceType[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
  for (let i = 0; i < 8; i++) {
    board[0][i] = { type: backRank[i], color: 'black' };
    board[7][i] = { type: backRank[i], color: 'white' };
  }
  return board;
}

export function createInitialGameState(): GameState {
  return {
    board: createInitialBoard(),
    turn: 'white',
    castlingRights: {
      white: { kingside: true, queenside: true },
      black: { kingside: true, queenside: true },
    },
    enPassantSquare: null,
    halfMoveClock: 0,
    fullMoveNumber: 1,
    moveHistory: [],
    isCheck: false,
    isCheckmate: false,
    isStalemate: false,
    isDraw: false,
  };
}

export function findKing(board: (Piece | null)[][], color: PieceColor): Square | null {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece?.type === 'king' && piece.color === color) return indicesToSquare(row, col);
    }
  }
  return null;
}

function getRawMoves(board: (Piece | null)[][], from: Square, piece: Piece, attacksOnly = false): Move[] {
  const moves: Move[] = [];
  const [fromRow, fromCol] = squareToIndices(from);
  const addMove = (toRow: number, toCol: number, special?: Partial<Move>) => {
    if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) return false;
    const targetPiece = board[toRow][toCol];
    if (targetPiece?.color === piece.color) return false;
    const to = indicesToSquare(toRow, toCol);
    moves.push({ from, to, piece, captured: targetPiece ?? undefined, ...special });
    return !targetPiece;
  };
  switch (piece.type) {
    case 'pawn': {
      const direction = piece.color === 'white' ? -1 : 1;
      const startRank = piece.color === 'white' ? 6 : 1;
      const promotionRank = piece.color === 'white' ? 0 : 7;
      if (!attacksOnly) {
        const oneStep = fromRow + direction;
        if (oneStep >= 0 && oneStep <= 7 && !board[oneStep][fromCol]) {
          if (oneStep === promotionRank) addMove(oneStep, fromCol, { promotion: 'queen' });
          else addMove(oneStep, fromCol);
          if (fromRow === startRank && !board[fromRow + 2 * direction][fromCol]) addMove(fromRow + 2 * direction, fromCol);
        }
      }
      for (const dc of [-1, 1]) {
        const captureRow = fromRow + direction;
        const captureCol = fromCol + dc;
        if (captureCol >= 0 && captureCol <= 7 && captureRow >= 0 && captureRow <= 7) {
          const target = board[captureRow][captureCol];
          if (target && target.color !== piece.color) {
            if (captureRow === promotionRank) addMove(captureRow, captureCol, { promotion: 'queen' });
            else addMove(captureRow, captureCol);
          } else if (attacksOnly) moves.push({ from, to: indicesToSquare(captureRow, captureCol), piece });
        }
      }
      break;
    }
    case 'knight':
      for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
        addMove(fromRow + dr, fromCol + dc);
      }
      break;
    case 'bishop':
      for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        for (let i = 1; i < 8; i++) {
          if (!addMove(fromRow + dr * i, fromCol + dc * i)) break;
        }
      }
      break;
    case 'rook':
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        for (let i = 1; i < 8; i++) {
          if (!addMove(fromRow + dr * i, fromCol + dc * i)) break;
        }
      }
      break;
    case 'queen':
      for (const [dr, dc] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
        for (let i = 1; i < 8; i++) {
          if (!addMove(fromRow + dr * i, fromCol + dc * i)) break;
        }
      }
      break;
    case 'king':
      for (const [dr, dc] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
        addMove(fromRow + dr, fromCol + dc);
      }
      break;
  }
  return moves;
}

function isSquareAttacked(board: (Piece | null)[][], square: Square, byColor: PieceColor): boolean {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece || piece.color !== byColor) continue;
      const attacks = getRawMoves(board, indicesToSquare(row, col), piece, true);
      if (attacks.some((m) => m.to === square)) return true;
    }
  }
  return false;
}

export function getLegalMoves(state: GameState, from: Square): Move[] {
  const piece = getPieceAt(state.board, from);
  if (!piece || piece.color !== state.turn) return [];
  const rawMoves = getRawMoves(state.board, from, piece);
  const legalMoves: Move[] = [];
  for (const move of rawMoves) {
    const newBoard = state.board.map((row) => [...row]);
    const [fromRow, fromCol] = squareToIndices(move.from);
    const [toRow, toCol] = squareToIndices(move.to);
    newBoard[toRow][toCol] = move.promotion ? { type: move.promotion, color: piece.color } : newBoard[fromRow][fromCol];
    newBoard[fromRow][fromCol] = null;
    const kingSquare = piece.type === 'king' ? move.to : findKing(newBoard, piece.color);
    if (kingSquare && !isSquareAttacked(newBoard, kingSquare, piece.color === 'white' ? 'black' : 'white')) legalMoves.push(move);
  }
  if (piece.type === 'king' && !state.isCheck) {
    const rights = state.castlingRights[piece.color];
    const rank = piece.color === 'white' ? 7 : 0;
    if (rights.kingside) {
      const rookSquare = indicesToSquare(rank, 7);
      const rook = getPieceAt(state.board, rookSquare);
      if (rook?.type === 'rook' && rook.color === piece.color && !state.board[rank][5] && !state.board[rank][6]) {
        if (!isSquareAttacked(state.board, indicesToSquare(rank, 5), piece.color === 'white' ? 'black' : 'white') && !isSquareAttacked(state.board, indicesToSquare(rank, 6), piece.color === 'white' ? 'black' : 'white')) {
          legalMoves.push({ from, to: indicesToSquare(rank, 6), piece, isCastling: 'kingside' });
        }
      }
    }
    if (rights.queenside) {
      const rookSquare = indicesToSquare(rank, 0);
      const rook = getPieceAt(state.board, rookSquare);
      if (rook?.type === 'rook' && rook.color === piece.color && !state.board[rank][1] && !state.board[rank][2] && !state.board[rank][3]) {
        if (!isSquareAttacked(state.board, indicesToSquare(rank, 2), piece.color === 'white' ? 'black' : 'white') && !isSquareAttacked(state.board, indicesToSquare(rank, 3), piece.color === 'white' ? 'black' : 'white')) {
          legalMoves.push({ from, to: indicesToSquare(rank, 2), piece, isCastling: 'queenside' });
        }
      }
    }
  }
  if (piece.type === 'pawn' && state.enPassantSquare) {
    const [fromRow, fromCol] = squareToIndices(from);
    const [epRow, epCol] = squareToIndices(state.enPassantSquare);
    const direction = piece.color === 'white' ? -1 : 1;
    if (fromRow + direction === epRow && Math.abs(fromCol - epCol) === 1) {
      const newBoard = state.board.map((row) => [...row]);
      newBoard[epRow][epCol] = piece;
      newBoard[fromRow][fromCol] = null;
      newBoard[fromRow][epCol] = null;
      const kingSquare = findKing(newBoard, piece.color);
      if (kingSquare && !isSquareAttacked(newBoard, kingSquare, piece.color === 'white' ? 'black' : 'white')) {
        legalMoves.push({
          from,
          to: state.enPassantSquare,
          piece,
          captured: { type: 'pawn', color: piece.color === 'white' ? 'black' : 'white' },
          isEnPassant: true,
        });
      }
    }
  }
  return legalMoves;
}

export function makeMove(state: GameState, move: Move): GameState {
  const newBoard = state.board.map((row) => [...row]);
  const [fromRow, fromCol] = squareToIndices(move.from);
  const [toRow, toCol] = squareToIndices(move.to);
  const piece = newBoard[fromRow][fromCol]!;
  if (move.promotion) newBoard[toRow][toCol] = { type: move.promotion, color: piece.color };
  else newBoard[toRow][toCol] = piece;
  newBoard[fromRow][fromCol] = null;
  if (move.isCastling) {
    const rank = piece.color === 'white' ? 7 : 0;
    if (move.isCastling === 'kingside') {
      newBoard[rank][5] = newBoard[rank][7];
      newBoard[rank][7] = null;
    } else {
      newBoard[rank][3] = newBoard[rank][0];
      newBoard[rank][0] = null;
    }
  }
  if (move.isEnPassant) newBoard[fromRow][toCol] = null;
  const newCastlingRights = { white: { ...state.castlingRights.white }, black: { ...state.castlingRights.black } };
  if (piece.type === 'king') newCastlingRights[piece.color] = { kingside: false, queenside: false };
  if (piece.type === 'rook') {
    if (move.from === 'a1') newCastlingRights.white.queenside = false;
    if (move.from === 'h1') newCastlingRights.white.kingside = false;
    if (move.from === 'a8') newCastlingRights.black.queenside = false;
    if (move.from === 'h8') newCastlingRights.black.kingside = false;
  }
  let newEnPassant: Square | null = null;
  if (piece.type === 'pawn' && Math.abs(fromRow - toRow) === 2) newEnPassant = indicesToSquare((fromRow + toRow) / 2, fromCol);
  const nextTurn: PieceColor = piece.color === 'white' ? 'black' : 'white';
  const opponentKing = findKing(newBoard, nextTurn);
  const isCheck = opponentKing ? isSquareAttacked(newBoard, opponentKing, piece.color) : false;
  const tempState: GameState = { ...state, board: newBoard, turn: nextTurn, castlingRights: newCastlingRights, enPassantSquare: newEnPassant, isCheck };
  let hasLegalMoves = false;
  outer: for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const p = newBoard[row][col];
      if (p?.color === nextTurn && getLegalMoves(tempState, indicesToSquare(row, col)).length > 0) {
        hasLegalMoves = true;
        break outer;
      }
    }
  }
  const isCheckmate = isCheck && !hasLegalMoves;
  const isStalemate = !isCheck && !hasLegalMoves;
  move.isCheck = isCheck;
  move.isCheckmate = isCheckmate;
  return {
    board: newBoard,
    turn: nextTurn,
    castlingRights: newCastlingRights,
    enPassantSquare: newEnPassant,
    halfMoveClock: piece.type === 'pawn' || move.captured ? 0 : state.halfMoveClock + 1,
    fullMoveNumber: piece.color === 'black' ? state.fullMoveNumber + 1 : state.fullMoveNumber,
    moveHistory: [...state.moveHistory, move],
    isCheck,
    isCheckmate,
    isStalemate,
    isDraw: isStalemate || state.halfMoveClock >= 100,
  };
}

export function getAllLegalMoves(state: GameState): Move[] {
  const moves: Move[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = state.board[row][col];
      if (piece?.color === state.turn) moves.push(...getLegalMoves(state, indicesToSquare(row, col)));
    }
  }
  return moves;
}
