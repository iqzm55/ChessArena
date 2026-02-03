import { useState, useEffect, useCallback } from 'react';
import { ChessBoard } from './ChessBoard';
import { PlayerInfo } from './PlayerInfo';
import { MoveHistory } from './MoveHistory';
import { GameEndDialog } from './GameEndDialog';
import { GameState, Move, Player, GameMode, GAME_MODES, PLATFORM_FEE_RATE } from '@/lib/chess/types';
import { createInitialGameState } from '@/lib/chess/engine';
import { chessSounds } from '@/lib/chess/sounds';

interface GameRoomProps {
  mode: GameMode;
  whitePlayer: Player;
  blackPlayer: Player;
  playerColor: 'white' | 'black';
  onPlayAgain: () => void;
  onReturnToLobby: () => void;
  /** When true, state is driven by server (WebSocket); no local timer */
  serverMode?: boolean;
  serverGameState?: GameState;
  serverWhiteTime?: number;
  serverBlackTime?: number;
  serverGameEnded?: boolean;
  serverGameResult?: { result: 'win' | 'loss' | 'draw'; reason: string; money: number } | null;
  onServerMove?: (move: Move) => void;
}

export function GameRoom({
  mode,
  whitePlayer,
  blackPlayer,
  playerColor,
  onPlayAgain,
  onReturnToLobby,
  serverMode = false,
  serverGameState,
  serverWhiteTime = 0,
  serverBlackTime = 0,
  serverGameEnded = false,
  serverGameResult = null,
  onServerMove,
}: GameRoomProps) {
  const config = GAME_MODES[mode];
  const platformFee = config.entryFee * 2 * PLATFORM_FEE_RATE;
  const netWin = config.entryFee - platformFee;
  const [localGameState, setLocalGameState] = useState<GameState>(createInitialGameState);
  const [localWhiteTime, setLocalWhiteTime] = useState(config.timeControl);
  const [localBlackTime, setLocalBlackTime] = useState(config.timeControl);
  const [localGameStarted, setLocalGameStarted] = useState(false);
  const [localGameEnded, setLocalGameEnded] = useState(false);
  const [localGameResult, setLocalGameResult] = useState<{ result: 'win' | 'loss' | 'draw'; reason: string; money: number } | null>(null);

  const gameState = serverMode && serverGameState != null ? serverGameState : localGameState;
  const whiteTime = serverMode ? serverWhiteTime : localWhiteTime;
  const blackTime = serverMode ? serverBlackTime : localBlackTime;
  const gameStarted = serverMode ? true : localGameStarted;
  const gameEnded = serverMode ? serverGameEnded : localGameEnded;
  const gameResult = serverMode ? serverGameResult : localGameResult;

  // Start game on mount (local mode only)
  useEffect(() => {
    if (serverMode) return;
    const timer = setTimeout(() => {
      chessSounds.gameStart();
      setLocalGameStarted(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, [serverMode]);

  // Timer logic (local mode only)
  useEffect(() => {
    if (serverMode || !localGameStarted || localGameEnded) return;
    const interval = setInterval(() => {
      if (localGameState.turn === 'white') {
        setLocalWhiteTime((t) => {
          if (t <= 1) {
            handleTimeout('white');
            return 0;
          }
          if (t === 10) chessSounds.lowTime();
          return t - 1;
        });
      } else {
        setLocalBlackTime((t) => {
          if (t <= 1) {
            handleTimeout('black');
            return 0;
          }
          if (t === 10) chessSounds.lowTime();
          return t - 1;
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [serverMode, localGameStarted, localGameEnded, localGameState.turn]);
  
  const handleTimeout = useCallback(
    (loser: 'white' | 'black') => {
      setLocalGameEnded(true);
      const isPlayerWin = loser !== playerColor;
      if (isPlayerWin) {
        setLocalGameResult({
          result: 'win',
          reason: 'Opponent ran out of time',
          money: netWin,
        });
      } else {
        setLocalGameResult({
          result: 'loss',
          reason: 'You ran out of time',
          money: -config.entryFee,
        });
      }
    },
    [playerColor, config.entryFee, netWin]
  );

  const handleMove = useCallback(
    (newState: GameState, move: Move) => {
      if (serverMode && onServerMove) {
        onServerMove(move);
        return;
      }
      setLocalGameState(newState);
      if (newState.isCheckmate) {
        setLocalGameEnded(true);
        const winner = move.piece.color;
        const isPlayerWin = winner === playerColor;
        if (isPlayerWin) {
          setLocalGameResult({ result: 'win', reason: 'Checkmate!', money: netWin });
        } else {
          setLocalGameResult({ result: 'loss', reason: 'Checkmate - You lost', money: -config.entryFee });
        }
      } else if (newState.isStalemate) {
        setLocalGameEnded(true);
        setLocalGameResult({
          result: 'draw',
          reason: 'Stalemate',
          money: 0,
        });
      } else if (newState.isDraw) {
        setLocalGameEnded(true);
        setLocalGameResult({
          result: 'draw',
          reason: '50-move rule',
          money: 0,
        });
      }
    },
    [playerColor, config.entryFee, netWin, serverMode, onServerMove]
  );
  
  const handlePlayAgain = () => {
    if (gameResult) {
      onPlayAgain();
    }
  };

  const handleReturnToLobby = () => {
    if (gameResult) {
      onReturnToLobby();
    }
  };
  
  const topPlayer = playerColor === 'white' ? blackPlayer : whitePlayer;
  const bottomPlayer = playerColor === 'white' ? whitePlayer : blackPlayer;
  const topTime = playerColor === 'white' ? blackTime : whiteTime;
  const bottomTime = playerColor === 'white' ? whiteTime : blackTime;
  const topColor = playerColor === 'white' ? 'black' : 'white';
  const bottomColor = playerColor;
  
  return (
    <div className="flex flex-col lg:flex-row gap-6 p-4 max-w-6xl mx-auto">
      {/* Main game area */}
      <div className="flex-1 flex flex-col gap-3">
        <PlayerInfo 
          player={topPlayer} 
          time={topTime} 
          isActive={gameStarted && !gameEnded && gameState.turn === topColor}
          color={topColor as 'white' | 'black'}
          position="top"
        />
        
        <div className="flex justify-center">
          <div className="w-full max-w-[500px]">
            <ChessBoard
              gameState={gameState}
              onMove={handleMove}
              playerColor={playerColor}
              isPlayerTurn={gameStarted && !gameEnded && gameState.turn === playerColor}
              disabled={!gameStarted || gameEnded}
            />
          </div>
        </div>
        
        <PlayerInfo 
          player={bottomPlayer} 
          time={bottomTime} 
          isActive={gameStarted && !gameEnded && gameState.turn === bottomColor}
          color={bottomColor as 'white' | 'black'}
          position="bottom"
        />
      </div>
      
      {/* Sidebar */}
      <div className="w-full lg:w-64 space-y-4">
        <div className="bg-card rounded-lg border border-border p-3">
          <div className="text-sm text-muted-foreground mb-1">Game Mode</div>
          <div className="font-semibold text-foreground">
            {mode === 'bullet-1' ? 'Bullet' : 'Blitz'} • {config.timeControl / 60} min
          </div>
          <div className="text-primary font-bold">${config.entryFee} entry</div>
        </div>
        
        <MoveHistory moves={gameState.moveHistory} />
      </div>
      
      {/* Game end dialog */}
      {gameResult && (
        <GameEndDialog
          open={!!gameResult}
          onPlayAgain={handlePlayAgain}
          onReturnToLobby={handleReturnToLobby}
          result={gameResult.result}
          reason={gameResult.reason}
          moneyChange={gameResult.money}
        />
      )}
    </div>
  );
}
