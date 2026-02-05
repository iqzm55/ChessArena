import React, { useState, useCallback, useMemo } from 'react';
import { Piece, Square, Move, GameState } from '@/lib/chess/types';
import { getLegalMoves, indicesToSquare, squareToIndices, makeMove } from '@/lib/chess/engine';
import { getPieceSvg } from '@/lib/chess/pieces';
import { chessSounds } from '@/lib/chess/sounds';
import { cn } from '@/lib/utils';

interface ChessBoardProps {
  gameState: GameState;
  onMove: (newState: GameState, move: Move) => void;
  playerColor: 'white' | 'black';
  isPlayerTurn: boolean;
  disabled?: boolean;
}

export function ChessBoard({ 
  gameState, 
  onMove, 
  playerColor, 
  isPlayerTurn,
  disabled = false 
}: ChessBoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Move[]>([]);
  const [premove, setPremove] = useState<{ from: Square; to: Square } | null>(null);
  
  const lastMove = gameState.moveHistory[gameState.moveHistory.length - 1];
  
  const isFlipped = playerColor === 'black';
  
  const handleSquareClick = useCallback((row: number, col: number) => {
    if (disabled) return;
    
    const actualRow = isFlipped ? 7 - row : row;
    const actualCol = isFlipped ? 7 - col : col;
    const square = indicesToSquare(actualRow, actualCol);
    const piece = gameState.board[actualRow][actualCol];
    
    // Handle premoves when not player's turn
    if (!isPlayerTurn) {
      if (selectedSquare) {
        const fromPiece = gameState.board[squareToIndices(selectedSquare)[0]][squareToIndices(selectedSquare)[1]];
        if (fromPiece?.color === playerColor) {
          setPremove({ from: selectedSquare, to: square });
          setSelectedSquare(null);
          setLegalMoves([]);
          return;
        }
      }
      
      if (piece?.color === playerColor) {
        setSelectedSquare(square);
        return;
      }
      return;
    }
    
    // If clicking on own piece, select it
    if (piece && piece.color === gameState.turn) {
      setSelectedSquare(square);
      setLegalMoves(getLegalMoves(gameState, square));
      return;
    }
    
    // If a piece is selected and clicking on a valid move target
    if (selectedSquare) {
      const move = legalMoves.find(m => m.to === square);
      if (move) {
        const newState = makeMove(gameState, move);
        
        // Play appropriate sound
        if (move.isCheckmate) {
          chessSounds.checkmate();
        } else if (move.isCheck) {
          chessSounds.check();
        } else if (move.captured) {
          chessSounds.capture();
        } else {
          chessSounds.move();
        }
        
        onMove(newState, move);
        setSelectedSquare(null);
        setLegalMoves([]);
        setPremove(null);
      } else {
        // Invalid move - deselect
        chessSounds.illegal();
        setSelectedSquare(null);
        setLegalMoves([]);
      }
    }
  }, [gameState, selectedSquare, legalMoves, isPlayerTurn, playerColor, isFlipped, onMove, disabled]);
  
  const legalMoveSquares = useMemo(() => {
    return new Set(legalMoves.map(m => m.to));
  }, [legalMoves]);
  
  const captureSquares = useMemo(() => {
    return new Set(legalMoves.filter(m => m.captured).map(m => m.to));
  }, [legalMoves]);
  
  const renderSquare = (row: number, col: number) => {
    const actualRow = isFlipped ? 7 - row : row;
    const actualCol = isFlipped ? 7 - col : col;
    const square = indicesToSquare(actualRow, actualCol);
    const piece = gameState.board[actualRow][actualCol];
    const isLight = (actualRow + actualCol) % 2 === 1;
    
    const isSelected = selectedSquare === square;
    const isLegalMove = legalMoveSquares.has(square);
    const isCapture = captureSquares.has(square);
    const isLastMoveSquare = lastMove && (lastMove.from === square || lastMove.to === square);
    const isPremoveSquare = premove && (premove.from === square || premove.to === square);
    const isKingInCheck = gameState.isCheck && piece?.type === 'king' && piece.color === gameState.turn;
    
    return (
      <div
        key={square}
        onClick={() => handleSquareClick(row, col)}
        className={cn(
          'relative flex items-center justify-center cursor-pointer transition-all duration-100',
          'aspect-square',
          isLight ? 'chess-square-light' : 'chess-square-dark',
          isSelected && 'chess-square-highlight',
          isLastMoveSquare && !isSelected && 'chess-square-last-move',
          isPremoveSquare && 'bg-warning/40',
          isKingInCheck && 'animate-check bg-destructive/50',
          isLegalMove && !isCapture && 'chess-square-legal',
          isLegalMove && isCapture && 'chess-square-legal chess-square-capture'
        )}
      >
        {piece && (
          <div 
            className={cn(
              'w-[85%] h-[85%] transition-transform',
              isSelected && 'scale-110'
            )}
            dangerouslySetInnerHTML={{ __html: getPieceSvg(piece.type, piece.color) }}
          />
        )}
        
        {/* Coordinate labels */}
        {col === 0 && (
          <span className={cn(
            'absolute top-0.5 left-1 text-[10px] font-semibold',
            isLight ? 'text-chess-dark' : 'text-chess-light'
          )}>
            {isFlipped ? row + 1 : 8 - row}
          </span>
        )}
        {row === 7 && (
          <span className={cn(
            'absolute bottom-0.5 right-1 text-[10px] font-semibold',
            isLight ? 'text-chess-dark' : 'text-chess-light'
          )}>
            {String.fromCharCode(97 + (isFlipped ? 7 - col : col))}
          </span>
        )}
      </div>
    );
  };
  
  return (
    <div className="relative">
      <div className="grid grid-cols-8 border-2 border-border rounded-md overflow-hidden shadow-xl">
        {Array.from({ length: 8 }, (_, row) =>
          Array.from({ length: 8 }, (_, col) => renderSquare(row, col))
        )}
      </div>
      
      {premove && (
        <div className="absolute -bottom-6 left-0 right-0 text-center text-sm text-warning">
          Premove: {premove.from} → {premove.to}
        </div>
      )}
    </div>
  );
}
