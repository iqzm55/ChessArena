import { Navigate, useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { GameRoom } from '@/components/chess/GameRoom';
import { GameMode, GAME_MODES, Player, GameState } from '@/lib/chess/types';
import { useAuth } from '@/hooks/useAuth';
import { getWsUrl } from '@/lib/api';
import { chessSounds } from '@/lib/chess/sounds';
import { toast } from 'sonner';

function apiPlayerToPlayer(p: { id: string; username: string; displayName?: string; avatar?: string | null }): Player {
  return {
    id: p.id,
    username: p.username,
    displayName: p.displayName ?? p.username,
    avatar: p.avatar ?? undefined,
    walletBalance: 0,
    gamesPlayed: 0,
    gamesWon: 0,
    gamesLost: 0,
    gamesDraw: 0,
    totalEarnings: 0,
    isBanned: false,
    isFrozen: false,
    createdAt: new Date(),
  };
}

export default function Game() {
  const { mode } = useParams<{ mode: string }>();
  const navigate = useNavigate();
  const { user, token, refreshUser } = useAuth();
  const [status, setStatus] = useState<'connecting' | 'matchmaking' | 'no_opponent' | 'playing' | 'ended' | 'error'>('connecting');
  const [matchmakingMessage, setMatchmakingMessage] = useState('Waiting for opponent...');
  const [whitePlayer, setWhitePlayer] = useState<Player | null>(null);
  const [blackPlayer, setBlackPlayer] = useState<Player | null>(null);
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [whiteTime, setWhiteTime] = useState(0);
  const [blackTime, setBlackTime] = useState(0);
  const [gameEnded, setGameEnded] = useState(false);
  const [gameResult, setGameResult] = useState<{
    result: 'win' | 'loss' | 'draw';
    reason: string;
    money: number;
  } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [sessionKey, setSessionKey] = useState(0);

  const isValidMode = !!mode && !!GAME_MODES[mode as GameMode];
  if (!user || !token) {
    return <Navigate to="/login" replace />;
  }
  if (!isValidMode) {
    return <Navigate to="/lobby" replace />;
  }

  useEffect(() => {
    const config = GAME_MODES[mode as GameMode];
    if (user.walletBalance < config.entryFee) {
      toast.error('Insufficient balance');
      navigate('/wallet');
      return;
    }

    const url = `${getWsUrl()}?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('matchmaking');
      setMatchmakingMessage('Waiting for opponent...');
      ws.send(JSON.stringify({ type: 'join_game', mode }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          type: string;
          playerColor?: string;
          whitePlayer?: { id: string; username: string; displayName?: string; avatar?: string | null };
          blackPlayer?: { id: string; username: string; displayName?: string; avatar?: string | null };
          gameState?: GameState;
          whiteTime?: number;
          blackTime?: number;
          move?: unknown;
          result?: string;
          reason?: string;
          moneyChange?: number;
          status?: string;
          message?: string;
          gameState?: GameState;
        };
        if (msg.type === 'error') {
          toast.error(msg.message ?? 'Error');
          setStatus('error');
          return;
        }
        if (msg.type === 'matchmaking') {
          if (msg.status === 'no_opponent') {
            setMatchmakingMessage(msg.message ?? 'No opponent available');
            setStatus('no_opponent');
          } else if (msg.status === 'cancelled') {
            setMatchmakingMessage(msg.message ?? 'Matchmaking cancelled');
            setStatus('no_opponent');
          } else {
            setMatchmakingMessage(msg.message ?? 'Waiting for opponent...');
            setStatus('matchmaking');
          }
          return;
        }
        if (msg.type === 'game_start' || msg.type === 'game_resume') {
          chessSounds.gameStart();
          setWhitePlayer(apiPlayerToPlayer(msg.whitePlayer!));
          setBlackPlayer(apiPlayerToPlayer(msg.blackPlayer!));
          setPlayerColor((msg.playerColor as 'white' | 'black') ?? 'white');
          setGameState(msg.gameState ?? null);
          setWhiteTime(msg.whiteTime ?? config.timeControl);
          setBlackTime(msg.blackTime ?? config.timeControl);
          setGameEnded(false);
          setGameResult(null);
          setStatus('playing');
          return;
        }
        if (msg.type === 'timer') {
          setWhiteTime(msg.whiteTime ?? 0);
          setBlackTime(msg.blackTime ?? 0);
          return;
        }
        if (msg.type === 'move' && msg.gameState) {
          setGameState(msg.gameState as GameState);
          return;
        }
        if (msg.type === 'game_end') {
          if (msg.gameState) {
            setGameState(msg.gameState);
          }
          setGameEnded(true);
          setGameResult({
            result: (msg.result as 'win' | 'loss' | 'draw') ?? 'draw',
            reason: msg.reason ?? 'Game over',
            money: msg.moneyChange ?? 0,
          });
          setStatus('ended');
          refreshUser();
          return;
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
      if (status === 'connecting' || status === 'matchmaking') {
        setStatus('error');
      }
    };

    ws.onerror = () => setStatus('error');

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [user?.id, token, mode, navigate, refreshUser, sessionKey]);

  const handleServerMove = useCallback(
    (move: unknown) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'move', move }));
      }
    },
    []
  );

  const handlePlayAgain = useCallback(() => {
    if (wsRef.current) wsRef.current.close();
    wsRef.current = null;
    setStatus('connecting');
    setGameEnded(false);
    setGameResult(null);
    setSessionKey((k) => k + 1);
  }, []);

  const handleReturnToLobby = useCallback(() => {
    if (wsRef.current) wsRef.current.close();
    wsRef.current = null;
    navigate('/lobby');
  }, [navigate]);

  const handleCancelSearch = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'cancel_matchmaking' }));
    }
    setStatus('no_opponent');
    setMatchmakingMessage('Matchmaking cancelled');
  };

  const config = GAME_MODES[mode as GameMode];

  if (status === 'connecting' || status === 'matchmaking') {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground">
            {status === 'connecting' ? 'Connecting...' : matchmakingMessage}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Entry fee: ${config.entryFee} • {config.timeControl / 60} min
          </p>
          {status === 'matchmaking' && (
            <button
              type="button"
              className="mt-6 text-primary hover:underline"
              onClick={handleCancelSearch}
            >
              Cancel Search
            </button>
          )}
        </div>
      </div>
    );
  }

  if (status === 'no_opponent') {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground">{matchmakingMessage}</p>
          <div className="mt-6 flex items-center justify-center gap-4">
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={handlePlayAgain}
            >
              Search Again
            </button>
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={handleReturnToLobby}
            >
              Return to Lobby
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-16 text-center">
          <p className="text-destructive">Connection failed. Check your balance and try again.</p>
          <button
            type="button"
            className="mt-4 text-primary hover:underline"
            onClick={() => navigate('/lobby')}
          >
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  if ((status === 'playing' || status === 'ended') && whitePlayer && blackPlayer && gameState) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <GameRoom
          mode={mode as GameMode}
          whitePlayer={whitePlayer}
          blackPlayer={blackPlayer}
          playerColor={playerColor}
          onPlayAgain={handlePlayAgain}
          onReturnToLobby={handleReturnToLobby}
          serverMode
          serverGameState={gameState}
          serverWhiteTime={whiteTime}
          serverBlackTime={blackTime}
          serverGameEnded={gameEnded}
          serverGameResult={gameResult}
          onServerMove={handleServerMove}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">
        Loading...
      </div>
    </div>
  );
}
