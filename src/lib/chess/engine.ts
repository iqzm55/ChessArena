import { Piece, PieceColor, PieceType, Square, Move, GameState } from './types';

// Convert algebraic notation to array indices
export function squareToIndices(square: Square): [number, number] {
  const file = square.charCodeAt(0) - 97; // 'a' = 0
  const rank = parseInt(square[1]) - 1;
  return [7 - rank, file]; // Board is stored with rank 8 at index 0
}

// Convert array indices to algebraic notation
export function indicesToSquare(row: number, col: number): Square {
  const file = String.fromCharCode(97 + col);
  const rank = 8 - row;
  return `${file}${rank}`;
}

// Get piece at square
export function getPieceAt(board: (Piece | null)[][], square: Square): Piece | null {
  const [row, col] = squareToIndices(square);
  return board[row]?.[col] ?? null;
}

// Set piece at square
export function setPieceAt(board: (Piece | null)[][], square: Square, piece: Piece | null): void {
  const [row, col] = squareToIndices(square);
  board[row][col] = piece;
}

// Create initial board position
export function createInitialBoard(): (Piece | null)[][] {
  const board: (Piece | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
  
  // Set up pawns
  for (let i = 0; i < 8; i++) {
    board[1][i] = { type: 'pawn', color: 'black' };
    board[6][i] = { type: 'pawn', color: 'white' };
  }
  
  // Set up other pieces
  const backRank: PieceType[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
  for (let i = 0; i < 8; i++) {
    board[0][i] = { type: backRank[i], color: 'black' };
    board[7][i] = { type: backRank[i], color: 'white' };
  }
  
  return board;
}

// Create initial game state
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

// Find king position
export function findKing(board: (Piece | null)[][], color: PieceColor): Square | null {
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece?.type === 'king' && piece.color === color) {
        return indicesToSquare(row, col);
      }
    }
  }
  return null;
}

// Check if a square is attacked by opponent
export function isSquareAttacked(board: (Piece | null)[][], square: Square, byColor: PieceColor): boolean {
  const [targetRow, targetCol] = squareToIndices(square);
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece || piece.color !== byColor) continue;
      
      const attacks = getRawMoves(board, indicesToSquare(row, col), piece, true);
      if (attacks.some(move => move.to === square)) {
        return true;
      }
    }
  }
  
  return false;
}

// Get raw moves for a piece (without checking if king is in check)
function getRawMoves(board: (Piece | null)[][], from: Square, piece: Piece, attacksOnly: boolean = false): Move[] {
  const moves: Move[] = [];
  const [fromRow, fromCol] = squareToIndices(from);
  
  const addMove = (toRow: number, toCol: number, special?: Partial<Move>) => {
    if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) return false;
    
    const targetPiece = board[toRow][toCol];
    if (targetPiece?.color === piece.color) return false;
    
    const to = indicesToSquare(toRow, toCol);
    moves.push({
      from,
      to,
      piece,
      captured: targetPiece ?? undefined,
      ...special,
    });
    
    return !targetPiece; // Return true if square was empty (can continue sliding)
  };
  
  switch (piece.type) {
    case 'pawn': {
      const direction = piece.color === 'white' ? -1 : 1;
      const startRank = piece.color === 'white' ? 6 : 1;
      const promotionRank = piece.color === 'white' ? 0 : 7;
      
      // Forward moves (not attacks)
      if (!attacksOnly) {
        const oneStep = fromRow + direction;
        if (oneStep >= 0 && oneStep <= 7 && !board[oneStep][fromCol]) {
          if (oneStep === promotionRank) {
            addMove(oneStep, fromCol, { promotion: 'queen' });
          } else {
            addMove(oneStep, fromCol);
          }
          
          // Two-step from starting position
          if (fromRow === startRank) {
            const twoStep = fromRow + 2 * direction;
            if (!board[twoStep][fromCol]) {
              addMove(twoStep, fromCol);
            }
          }
        }
      }
      
      // Captures (diagonal)
      for (const dc of [-1, 1]) {
        const captureRow = fromRow + direction;
        const captureCol = fromCol + dc;
        if (captureCol >= 0 && captureCol <= 7 && captureRow >= 0 && captureRow <= 7) {
          const target = board[captureRow][captureCol];
          if (target && target.color !== piece.color) {
            if (captureRow === promotionRank) {
              addMove(captureRow, captureCol, { promotion: 'queen' });
            } else {
              addMove(captureRow, captureCol);
            }
          } else if (attacksOnly) {
            // For attack detection, add diagonal squares even if empty
            moves.push({
              from,
              to: indicesToSquare(captureRow, captureCol),
              piece,
            });
          }
        }
      }
      break;
    }
    
    case 'knight': {
      const knightMoves = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1],
      ];
      for (const [dr, dc] of knightMoves) {
        addMove(fromRow + dr, fromCol + dc);
      }
      break;
    }
    
    case 'bishop': {
      for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        for (let i = 1; i < 8; i++) {
          if (!addMove(fromRow + dr * i, fromCol + dc * i)) break;
        }
      }
      break;
    }
    
    case 'rook': {
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        for (let i = 1; i < 8; i++) {
          if (!addMove(fromRow + dr * i, fromCol + dc * i)) break;
        }
      }
      break;
    }
    
    case 'queen': {
      for (const [dr, dc] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
        for (let i = 1; i < 8; i++) {
          if (!addMove(fromRow + dr * i, fromCol + dc * i)) break;
        }
      }
      break;
    }
    
    case 'king': {
      for (const [dr, dc] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
        addMove(fromRow + dr, fromCol + dc);
      }
      break;
    }
  }
  
  return moves;
}

// Get all legal moves for a piece
export function getLegalMoves(state: GameState, from: Square): Move[] {
  const piece = getPieceAt(state.board, from);
  if (!piece || piece.color !== state.turn) return [];
  
  const rawMoves = getRawMoves(state.board, from, piece);
  const legalMoves: Move[] = [];
  
  for (const move of rawMoves) {
    // Make the move on a copy of the board
    const newBoard = state.board.map(row => [...row]);
    const [fromRow, fromCol] = squareToIndices(move.from);
    const [toRow, toCol] = squareToIndices(move.to);
    
    newBoard[toRow][toCol] = move.promotion 
      ? { type: move.promotion, color: piece.color }
      : newBoard[fromRow][fromCol];
    newBoard[fromRow][fromCol] = null;
    
    // Check if our king is in check after the move
    const kingSquare = piece.type === 'king' 
      ? move.to 
      : findKing(newBoard, piece.color);
    
    if (kingSquare && !isSquareAttacked(newBoard, kingSquare, piece.color === 'white' ? 'black' : 'white')) {
      legalMoves.push(move);
    }
  }
  
  // Add castling moves
  if (piece.type === 'king' && !state.isCheck) {
    const rights = state.castlingRights[piece.color];
    const rank = piece.color === 'white' ? 7 : 0;
    const kingCol = 4;
    
    // Kingside castling
    if (rights.kingside) {
      const rookSquare = indicesToSquare(rank, 7);
      const rook = getPieceAt(state.board, rookSquare);
      if (rook?.type === 'rook' && rook.color === piece.color) {
        const pathClear = !state.board[rank][5] && !state.board[rank][6];
        const pathSafe = !isSquareAttacked(state.board, indicesToSquare(rank, 5), piece.color === 'white' ? 'black' : 'white') &&
                        !isSquareAttacked(state.board, indicesToSquare(rank, 6), piece.color === 'white' ? 'black' : 'white');
        if (pathClear && pathSafe) {
          legalMoves.push({
            from,
            to: indicesToSquare(rank, 6),
            piece,
            isCastling: 'kingside',
          });
        }
      }
    }
    
    // Queenside castling
    if (rights.queenside) {
      const rookSquare = indicesToSquare(rank, 0);
      const rook = getPieceAt(state.board, rookSquare);
      if (rook?.type === 'rook' && rook.color === piece.color) {
        const pathClear = !state.board[rank][1] && !state.board[rank][2] && !state.board[rank][3];
        const pathSafe = !isSquareAttacked(state.board, indicesToSquare(rank, 2), piece.color === 'white' ? 'black' : 'white') &&
                        !isSquareAttacked(state.board, indicesToSquare(rank, 3), piece.color === 'white' ? 'black' : 'white');
        if (pathClear && pathSafe) {
          legalMoves.push({
            from,
            to: indicesToSquare(rank, 2),
            piece,
            isCastling: 'queenside',
          });
        }
      }
    }
  }
  
  // Add en passant
  if (piece.type === 'pawn' && state.enPassantSquare) {
    const [fromRow, fromCol] = squareToIndices(from);
    const [epRow, epCol] = squareToIndices(state.enPassantSquare);
    const direction = piece.color === 'white' ? -1 : 1;
    
    if (fromRow + direction === epRow && Math.abs(fromCol - epCol) === 1) {
      // Check if the move is legal (doesn't leave king in check)
      const newBoard = state.board.map(row => [...row]);
      newBoard[epRow][epCol] = piece;
      newBoard[fromRow][fromCol] = null;
      newBoard[fromRow][epCol] = null; // Remove captured pawn
      
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

// Make a move and return new game state
export function makeMove(state: GameState, move: Move): GameState {
  const newBoard = state.board.map(row => [...row]);
  const [fromRow, fromCol] = squareToIndices(move.from);
  const [toRow, toCol] = squareToIndices(move.to);
  
  const piece = newBoard[fromRow][fromCol]!;
  
  // Handle promotion
  if (move.promotion) {
    newBoard[toRow][toCol] = { type: move.promotion, color: piece.color };
  } else {
    newBoard[toRow][toCol] = piece;
  }
  newBoard[fromRow][fromCol] = null;
  
  // Handle castling
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
  
  // Handle en passant capture
  if (move.isEnPassant) {
    newBoard[fromRow][toCol] = null;
  }
  
  // Update castling rights
  const newCastlingRights = {
    white: { ...state.castlingRights.white },
    black: { ...state.castlingRights.black },
  };
  
  if (piece.type === 'king') {
    newCastlingRights[piece.color] = { kingside: false, queenside: false };
  }
  if (piece.type === 'rook') {
    if (move.from === 'a1') newCastlingRights.white.queenside = false;
    if (move.from === 'h1') newCastlingRights.white.kingside = false;
    if (move.from === 'a8') newCastlingRights.black.queenside = false;
    if (move.from === 'h8') newCastlingRights.black.kingside = false;
  }
  
  // Update en passant square
  let newEnPassant: Square | null = null;
  if (piece.type === 'pawn' && Math.abs(fromRow - toRow) === 2) {
    newEnPassant = indicesToSquare((fromRow + toRow) / 2, fromCol);
  }
  
  // Check for check/checkmate/stalemate
  const nextTurn: PieceColor = piece.color === 'white' ? 'black' : 'white';
  const opponentKing = findKing(newBoard, nextTurn);
  const isCheck = opponentKing ? isSquareAttacked(newBoard, opponentKing, piece.color) : false;
  
  // Check if opponent has any legal moves
  let hasLegalMoves = false;
  const tempState: GameState = {
    ...state,
    board: newBoard,
    turn: nextTurn,
    castlingRights: newCastlingRights,
    enPassantSquare: newEnPassant,
    isCheck,
  };
  
  outerLoop:
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const p = newBoard[row][col];
      if (p?.color === nextTurn) {
        const moves = getLegalMoves(tempState, indicesToSquare(row, col));
        if (moves.length > 0) {
          hasLegalMoves = true;
          break outerLoop;
        }
      }
    }
  }
  
  const isCheckmate = isCheck && !hasLegalMoves;
  const isStalemate = !isCheck && !hasLegalMoves;
  
  // Update move with check info
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
    isDraw: isStalemate || state.halfMoveClock >= 100, // 50-move rule
  };
}

// Get all legal moves for current player
export function getAllLegalMoves(state: GameState): Move[] {
  const moves: Move[] = [];
  
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = state.board[row][col];
      if (piece?.color === state.turn) {
        moves.push(...getLegalMoves(state, indicesToSquare(row, col)));
      }
    }
  }
  
  return moves;
}
