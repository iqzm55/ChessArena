import { Move } from '@/lib/chess/types';
import { getPieceSymbol } from '@/lib/chess/pieces';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MoveHistoryProps {
  moves: Move[];
}

function formatMove(move: Move): string {
  const pieceSymbol = move.piece.type === 'pawn' ? '' : getPieceSymbol(move.piece.type, move.piece.color);
  const capture = move.captured ? 'x' : '';
  const from = move.piece.type === 'pawn' && move.captured ? move.from[0] : '';
  const check = move.isCheckmate ? '#' : move.isCheck ? '+' : '';
  const promotion = move.promotion ? `=${getPieceSymbol(move.promotion, move.piece.color)}` : '';
  
  if (move.isCastling === 'kingside') return 'O-O';
  if (move.isCastling === 'queenside') return 'O-O-O';
  
  return `${pieceSymbol}${from}${capture}${move.to}${promotion}${check}`;
}

export function MoveHistory({ moves }: MoveHistoryProps) {
  const movePairs: [Move, Move?][] = [];
  
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push([moves[i], moves[i + 1]]);
  }
  
  return (
    <div className="bg-card rounded-lg border border-border">
      <div className="px-3 py-2 border-b border-border">
        <h3 className="font-semibold text-sm text-foreground">Moves</h3>
      </div>
      <ScrollArea className="h-[200px]">
        <div className="p-2 space-y-0.5">
          {movePairs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No moves yet
            </p>
          ) : (
            movePairs.map(([white, black], index) => (
              <div key={index} className="flex text-sm">
                <span className="w-8 text-muted-foreground">{index + 1}.</span>
                <span className="w-16 font-mono text-foreground">{formatMove(white)}</span>
                {black && (
                  <span className="w-16 font-mono text-foreground">{formatMove(black)}</span>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
