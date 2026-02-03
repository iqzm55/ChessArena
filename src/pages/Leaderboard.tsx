import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiJson } from '@/lib/api';

interface LeaderRow {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  wins: number;
  totalEarnings: number;
  gamesPlayed: number;
}

export default function Leaderboard() {
  const [rows, setRows] = useState<LeaderRow[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiJson<{ leaderboard: LeaderRow[] }>('/api/leaderboard');
        setRows(data.leaderboard || []);
      } catch {
        // ignore
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle>Leaderboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leaderboard data yet.</p>
            ) : (
              rows.map((player, index) => (
                <div key={player.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 text-center font-bold">{index + 1}</div>
                    <Avatar className="h-10 w-10 border-2 border-border">
                      <AvatarImage src={player.avatar ?? undefined} />
                      <AvatarFallback className="bg-secondary text-secondary-foreground">
                        {(player.displayName || player.username)[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{player.displayName || player.username}</div>
                      <div className="text-sm text-muted-foreground">{player.gamesPlayed} games</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{player.wins} wins</div>
                    <div className="text-sm text-muted-foreground">${player.totalEarnings.toFixed(2)} earned</div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
