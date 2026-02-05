import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { apiJson } from '@/lib/api';
import { toast } from 'sonner';

interface ProfileResponse {
  profile: {
    id: string;
    username: string;
    displayName: string;
    avatar: string | null;
    walletBalance: number;
    gamesPlayed: number;
    gamesWon: number;
    gamesLost: number;
    gamesDraw: number;
    totalEarnings: number;
    createdAt: string;
  };
}

interface HistoryRow {
  gameId: string;
  mode: string;
  outcome: 'win' | 'loss' | 'draw' | 'unknown';
  opponent: { id: string | null; username: string | null; displayName: string | null; avatar: string | null };
  entryFee: number;
  payout: number;
  moneyChange: number;
  endedAt: string | null;
  startedAt: string | null;
}

export default function Profile() {
  const { user, token, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        const [profileRes, historyRes] = await Promise.all([
          apiJson<ProfileResponse>('/api/profile', { token }),
          apiJson<{ history: HistoryRow[] }>('/api/profile/history', { token }),
        ]);
        setDisplayName(profileRes.profile.displayName ?? profileRes.profile.username);
        setAvatarPreview(profileRes.profile.avatar ?? null);
        setHistory(historyRes.history || []);
      } catch {
        // ignore
      }
    };
    load();
  }, [user?.id, token]);

  const handleFileChange = (file: File | null) => {
    if (!file) return;
    if (file.size > 200 * 1024) {
      toast.error('Image too large. Max 200KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarPreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!token) return;
    const name = displayName.trim();
    if (name.length < 2) {
      toast.error('Display name must be at least 2 characters');
      return;
    }
    setSaving(true);
    try {
      await apiJson<ProfileResponse>('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: name, avatarDataUrl: avatarPreview }),
        token,
      });
      await refreshUser();
      toast.success('Profile updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Profile update failed');
    } finally {
      setSaving(false);
    }
  };

  if (!user || !token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Manage your public profile details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-6 items-center">
                <Avatar className="h-24 w-24 border-2 border-border">
                  <AvatarImage src={avatarPreview ?? undefined} />
                  <AvatarFallback className="bg-secondary text-secondary-foreground text-2xl">
                    {(displayName || user.username)[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-3">
                  <div>
                    <label className="text-sm text-muted-foreground">Display name</label>
                    <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Profile picture</label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                    />
                  </div>
                  <Button onClick={handleSave} disabled={saving}>Save Changes</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stats</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-xl font-bold">{user.gamesWon}</div>
                <div className="text-sm text-muted-foreground">Wins</div>
              </div>
              <div>
                <div className="text-xl font-bold">{user.gamesLost}</div>
                <div className="text-sm text-muted-foreground">Losses</div>
              </div>
              <div>
                <div className="text-xl font-bold">{user.gamesDraw}</div>
                <div className="text-sm text-muted-foreground">Draws</div>
              </div>
              <div>
                <div className="text-xl font-bold">${(user.totalEarnings ?? 0).toFixed(2)}</div>
                <div className="text-sm text-muted-foreground">Total Earnings</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Game History</CardTitle>
              <CardDescription>Your latest 50 games</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No games played yet.</p>
              ) : (
                history.map((g) => (
                  <div key={g.gameId} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <div className="font-medium">
                        {g.outcome.toUpperCase()} vs {g.opponent.displayName || g.opponent.username || 'Unknown'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {g.mode}  {g.endedAt ? new Date(g.endedAt).toLocaleString() : 'In progress'}
                      </div>
                    </div>
                    <div className={g.moneyChange >= 0 ? 'text-primary font-semibold' : 'text-destructive font-semibold'}>
                      {g.moneyChange >= 0 ? '+' : '-'}${Math.abs(g.moneyChange).toFixed(2)}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
