import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GameMode, GAME_MODES, PLATFORM_FEE_RATE } from '@/lib/chess/types';
import { Clock, Zap, Timer } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface GameModeCardProps {
  mode: GameMode;
  onJoin: (mode: GameMode) => void;
}

function GameModeCard({ mode, onJoin }: GameModeCardProps) {
  const config = GAME_MODES[mode];
  const { user } = useAuth();
  
  const icons = {
    'bullet-1': <Zap className="h-8 w-8 text-destructive" />,
    'blitz-3': <Clock className="h-8 w-8 text-warning" />,
    'blitz-5': <Timer className="h-8 w-8 text-primary" />,
  };
  
  const titles = {
    'bullet-1': 'Bullet',
    'blitz-3': 'Blitz',
    'blitz-5': 'Blitz',
  };
  
  const descriptions = {
    'bullet-1': '1 minute per side',
    'blitz-3': '3 minutes per side',
    'blitz-5': '5 minutes per side',
  };
  
  const canAfford = user && user.walletBalance >= config.entryFee;
  
  const platformFee = config.entryFee * 2 * PLATFORM_FEE_RATE;
  const netWin = config.entryFee - platformFee;
  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-2">{icons[mode]}</div>
        <CardTitle className="text-xl">{titles[mode]}</CardTitle>
        <CardDescription>{descriptions[mode]}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center">
          <div className="text-3xl font-bold text-primary">${config.entryFee}</div>
          <div className="text-sm text-muted-foreground">Entry Fee</div>
        </div>
        <div className="text-center text-sm text-muted-foreground">
          <p>Win: +${netWin.toFixed(2)} net</p>
          <p>Draw: +$0.00</p>
        </div>
        <Button 
          className="w-full" 
          onClick={() => onJoin(mode)}
          disabled={!canAfford}
        >
          {canAfford ? 'Play Now' : `Need $${config.entryFee}`}
        </Button>
      </CardContent>
    </Card>
  );
}

export function GameLobby() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  useEffect(() => {
    if (user) refreshUser();
  }, [user?.id, refreshUser]);

  const handleJoin = (mode: GameMode) => {
    if (!user) {
      toast.error('Please login to play');
      navigate('/login');
      return;
    }
    
    if (user.isFrozen) {
      toast.error('Your account is frozen. Contact support.');
      return;
    }
    
    const config = GAME_MODES[mode];
    if (user.walletBalance < config.entryFee) {
      toast.error(`Insufficient balance. You need $${config.entryFee} to play.`);
      navigate('/wallet');
      return;
    }
    
    // Navigate to game with mode
    navigate(`/game/${mode}`);
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Play Chess</h1>
        <p className="text-muted-foreground">Choose your game mode and compete for real money</p>
      </div>
      
      <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        <GameModeCard mode="bullet-1" onJoin={handleJoin} />
        <GameModeCard mode="blitz-3" onJoin={handleJoin} />
        <GameModeCard mode="blitz-5" onJoin={handleJoin} />
      </div>
      
      {!user && (
        <div className="text-center mt-8">
          <p className="text-muted-foreground mb-4">
            Create an account to start playing and winning
          </p>
          <Button onClick={() => navigate('/register')}>
            Sign Up Now
          </Button>
        </div>
      )}
    </div>
  );
}
