import { Header } from '@/components/layout/Header';
import { GameLobby } from '@/components/lobby/GameLobby';

export default function Lobby() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <GameLobby />
    </div>
  );
}
