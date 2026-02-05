import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trophy, Skull, HandshakeIcon } from 'lucide-react';

interface GameEndDialogProps {
  open: boolean;
  onPlayAgain: () => void;
  onReturnToLobby: () => void;
  result: 'win' | 'loss' | 'draw';
  reason: string;
  moneyChange: number;
}

export function GameEndDialog({ open, onPlayAgain, onReturnToLobby, result, reason, moneyChange }: GameEndDialogProps) {
  const icons = {
    win: <Trophy className="h-16 w-16 text-primary" />,
    loss: <Skull className="h-16 w-16 text-destructive" />,
    draw: <HandshakeIcon className="h-16 w-16 text-muted-foreground" />,
  };
  
  const titles = {
    win: 'Victory!',
    loss: 'Defeat',
    draw: 'Draw',
  };
  
  const moneyText = moneyChange >= 0 
    ? `+$${moneyChange.toFixed(2)}` 
    : `-$${Math.abs(moneyChange).toFixed(2)}`;
  
  return (
    <Dialog open={open} onOpenChange={onReturnToLobby}>
      <DialogContent className="sm:max-w-md text-center">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            {icons[result]}
          </div>
          <DialogTitle className="text-3xl">{titles[result]}</DialogTitle>
          <DialogDescription className="text-base">{reason}</DialogDescription>
        </DialogHeader>
        
        <div className={`text-3xl font-bold py-4 ${moneyChange >= 0 ? 'text-primary' : 'text-destructive'}`}>
          {moneyText}
        </div>
        
        <div className="flex gap-3 justify-center mt-4">
          <Button variant="secondary" onClick={onReturnToLobby}>
            Return to Lobby
          </Button>
          <Button onClick={onPlayAgain}>
            Play Again
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
