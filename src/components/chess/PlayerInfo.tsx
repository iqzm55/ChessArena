import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Player } from '@/lib/chess/types';
import { GameTimer } from './GameTimer';
import { PieceColor } from '@/lib/chess/types';

interface PlayerInfoProps {
  player: Player | null;
  time: number;
  isActive: boolean;
  color: PieceColor;
  position: 'top' | 'bottom';
}

export function PlayerInfo({ player, time, isActive, color, position }: PlayerInfoProps) {
  return (
    <div className={`flex items-center gap-3 ${position === 'top' ? 'flex-row' : 'flex-row-reverse'}`}>
      <div className="flex items-center gap-3 flex-1">
        <Avatar className="h-10 w-10 border-2 border-border">
          <AvatarImage src={player?.avatar} />
          <AvatarFallback className="bg-secondary text-secondary-foreground font-bold">
            {(player?.displayName || player?.username)?.[0]?.toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="font-semibold text-foreground">
            {player?.displayName || player?.username || 'Waiting...'}
          </p>
          {player && (
            <p className="text-sm text-muted-foreground">
              {player.gamesWon}W / {player.gamesLost}L
            </p>
          )}
        </div>
      </div>
      <GameTimer time={time} isActive={isActive} color={color} />
    </div>
  );
}
