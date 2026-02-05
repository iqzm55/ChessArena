import { cn } from '@/lib/utils';
import { PieceColor } from '@/lib/chess/types';

interface GameTimerProps {
  time: number; // in seconds
  isActive: boolean;
  color: PieceColor;
}

export function GameTimer({ time, isActive, color }: GameTimerProps) {
  const minutes = Math.floor(time / 60);
  const seconds = time % 60;
  const isLowTime = time < 30;
  
  return (
    <div
      className={cn(
        'px-4 py-2 rounded-md font-mono text-2xl font-bold min-w-[100px] text-center transition-all',
        color === 'white' ? 'bg-foreground text-background' : 'bg-muted text-foreground',
        isActive && 'ring-2 ring-primary',
        isLowTime && isActive && 'animate-timer-warning text-white'
      )}
    >
      {minutes}:{seconds.toString().padStart(2, '0')}
    </div>
  );
}
