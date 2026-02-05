import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { apiJson } from '@/lib/api';
import {
  Users,
  Wallet,
  GamepadIcon,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Ban,
  DollarSign,
  Settings,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';

interface AdminUser {
  id: string;
  username: string;
  balance: number;
  gamesPlayed: number;
  status: string;
  flagged: boolean;
}

interface DepositRow {
  id: string;
  user: string;
  amount: number;
  crypto: string;
  date: string;
  status: string;
}

interface WithdrawalRow {
  id: string;
  user: string;
  amount: number;
  crypto: string;
  address: string;
  date: string;
  status: string;
}

interface GameRow {
  id: string;
  white: string;
  black: string;
  mode: string;
  status: string;
  flagged: boolean;
  reason?: string;
  result?: string;
}

export default function Admin() {
  const navigate = useNavigate();
  const { isAdmin, token } = useAuth();
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [walletAddresses, setWalletAddresses] = useState({ btc: '', eth: '', usdt: '' });
  const [stats, setStats] = useState({ appWalletBalance: 0, totalUsers: 0, pendingDeposits: 0, flaggedGames: 0 });
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [deposits, setDeposits] = useState<DepositRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [games, setGames] = useState<GameRow[]>([]);
  const [loading, setLoading] = useState(false);

  const loadAdminData = useCallback(async () => {
    if (!token) return;
    try {
      const [statsRes, usersRes, depositsRes, withdrawalsRes, gamesRes, settingsRes] = await Promise.all([
        apiJson<{ appWalletBalance: number; totalUsers: number; pendingDeposits: number; flaggedGames: number }>('/api/admin/stats', { token }),
        apiJson<{ users: AdminUser[] }>('/api/admin/users', { token }),
        apiJson<{ deposits: DepositRow[] }>('/api/admin/deposits', { token }),
        apiJson<{ withdrawals: WithdrawalRow[] }>('/api/admin/withdrawals', { token }),
        apiJson<{ games: GameRow[] }>('/api/admin/games', { token }),
        apiJson<{ walletAddresses: { btc: string; eth: string; usdt: string } }>('/api/admin/settings', { token }),
      ]);
      setStats(statsRes);
      setUsers(usersRes.users || []);
      setDeposits(depositsRes.deposits || []);
      setWithdrawals(withdrawalsRes.withdrawals || []);
      setGames(gamesRes.games || []);
      setWalletAddresses(settingsRes.walletAddresses || { btc: '', eth: '', usdt: '' });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load admin data');
    }
  }, [token]);

  useEffect(() => {
    if (isAdmin && token) loadAdminData();
  }, [isAdmin, token, loadAdminData]);

  if (!isAdmin) {
    navigate('/');
    return null;
  }

  const handleApproveDeposit = async (id: string) => {
    if (!token) return;
    setLoading(true);
    try {
      await apiJson(`/api/admin/deposits/${id}/approve`, { method: 'POST', token });
      toast.success('Deposit approved');
      loadAdminData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectDeposit = async (id: string) => {
    if (!token) return;
    setLoading(true);
    try {
      await apiJson(`/api/admin/deposits/${id}/reject`, { method: 'POST', token });
      toast.success('Deposit rejected');
      loadAdminData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveWithdrawal = async (id: string) => {
    if (!token) return;
    setLoading(true);
    try {
      await apiJson(`/api/admin/withdrawals/${id}/approve`, { method: 'POST', token });
      toast.success('Withdrawal approved');
      loadAdminData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectWithdrawal = async (id: string) => {
    if (!token) return;
    setLoading(true);
    try {
      await apiJson(`/api/admin/withdrawals/${id}/reject`, { method: 'POST', token });
      toast.success('Withdrawal rejected');
      loadAdminData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleBanUser = async (userId: string) => {
    if (!token) return;
    setLoading(true);
    try {
      await apiJson(`/api/admin/users/${userId}/ban`, { method: 'POST', token });
      toast.success('User banned');
      loadAdminData();
      setSelectedUser(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFreezeUser = async (userId: string) => {
    if (!token) return;
    setLoading(true);
    try {
      await apiJson(`/api/admin/users/${userId}/freeze`, { method: 'POST', token });
      toast.success('User frozen');
      loadAdminData();
      setSelectedUser(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleUnfreezeUser = async (userId: string) => {
    if (!token) return;
    setLoading(true);
    try {
      await apiJson(`/api/admin/users/${userId}/unfreeze`, { method: 'POST', token });
      toast.success('User unfrozen');
      loadAdminData();
      setSelectedUser(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!token) return;
    setLoading(true);
    try {
      await apiJson('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddresses }),
        token,
      });
      toast.success('Wallet addresses saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Wallet className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">App Wallet</p>
                  <p className="text-2xl font-bold">${stats.appWalletBalance.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold">{stats.totalUsers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Deposits</p>
                  <p className="text-2xl font-bold">{stats.pendingDeposits}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Flagged Games</p>
                  <p className="text-2xl font-bold">{stats.flaggedGames}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="deposits" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Deposits
            </TabsTrigger>
            <TabsTrigger value="withdrawals" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Withdrawals
            </TabsTrigger>
            <TabsTrigger value="games" className="gap-2">
              <GamepadIcon className="h-4 w-4" />
              Games
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>View and manage all users</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Balance</TableHead>
                      <TableHead>Games</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.username}
                          {user.flagged && (
                            <Badge variant="destructive" className="ml-2">Flagged</Badge>
                          )}
                        </TableCell>
                        <TableCell>${user.balance.toFixed(2)}</TableCell>
                        <TableCell>{user.gamesPlayed}</TableCell>
                        <TableCell>
                          <Badge variant={user.status === 'active' ? 'default' : 'destructive'}>
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => setSelectedUser(user)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {user.status === 'active' ? (
                              <Button size="sm" variant="outline" onClick={() => handleFreezeUser(user.id)} disabled={loading}>
                                Freeze
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" onClick={() => handleUnfreezeUser(user.id)} disabled={loading}>
                                Unfreeze
                              </Button>
                            )}
                            <Button size="sm" variant="destructive" onClick={() => handleBanUser(user.id)} disabled={loading}>
                              <Ban className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="deposits">
            <Card>
              <CardHeader>
                <CardTitle>Pending Deposits</CardTitle>
                <CardDescription>Verify and approve crypto deposits</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Crypto</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deposits.map((deposit) => (
                      <TableRow key={deposit.id}>
                        <TableCell className="font-medium">{deposit.user}</TableCell>
                        <TableCell>${deposit.amount}</TableCell>
                        <TableCell>{deposit.crypto}</TableCell>
                        <TableCell>{new Date(deposit.date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge variant={deposit.status === 'pending' ? 'secondary' : 'default'}>
                            {deposit.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {deposit.status === 'pending' && (
                            <div className="flex gap-2">
                              <Button size="sm" className="gap-1" onClick={() => handleApproveDeposit(deposit.id)} disabled={loading}>
                                <CheckCircle className="h-4 w-4" />
                                Approve
                              </Button>
                              <Button size="sm" variant="destructive" className="gap-1" onClick={() => handleRejectDeposit(deposit.id)} disabled={loading}>
                                <XCircle className="h-4 w-4" />
                                Reject
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="withdrawals">
            <Card>
              <CardHeader>
                <CardTitle>Pending Withdrawals</CardTitle>
                <CardDescription>Process withdrawal requests</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Crypto</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawals.map((withdrawal) => (
                      <TableRow key={withdrawal.id}>
                        <TableCell className="font-medium">{withdrawal.user}</TableCell>
                        <TableCell>${withdrawal.amount}</TableCell>
                        <TableCell>{withdrawal.crypto}</TableCell>
                        <TableCell className="font-mono text-sm">{withdrawal.address}</TableCell>
                        <TableCell>{new Date(withdrawal.date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" className="gap-1" onClick={() => handleApproveWithdrawal(withdrawal.id)} disabled={loading}>
                              <CheckCircle className="h-4 w-4" />
                              Approve
                            </Button>
                            <Button size="sm" variant="destructive" className="gap-1" onClick={() => handleRejectWithdrawal(withdrawal.id)} disabled={loading}>
                              <XCircle className="h-4 w-4" />
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="games">
            <Card>
              <CardHeader>
                <CardTitle>Games Overview</CardTitle>
                <CardDescription>Monitor active and flagged games</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>White</TableHead>
                      <TableHead>Black</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Flagged</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {games.map((game) => (
                      <TableRow key={game.id}>
                        <TableCell className="font-medium">{game.white}</TableCell>
                        <TableCell>{game.black}</TableCell>
                        <TableCell>{game.mode}</TableCell>
                        <TableCell>
                          <Badge variant={game.status === 'playing' ? 'default' : 'secondary'}>
                            {game.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {game.flagged ? (
                            <Badge variant="destructive">⚠️ {game.reason ?? 'Flagged'}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" className="gap-1">
                            <Eye className="h-4 w-4" />
                            {game.status === 'playing' ? 'Spectate' : 'Review'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Wallet Addresses</CardTitle>
                <CardDescription>Set your crypto wallet addresses for deposits</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Bitcoin (BTC) Address</Label>
                  <Input
                    value={walletAddresses.btc}
                    onChange={(e) => setWalletAddresses({ ...walletAddresses, btc: e.target.value })}
                    placeholder="Enter BTC address"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ethereum (ETH) Address</Label>
                  <Input
                    value={walletAddresses.eth}
                    onChange={(e) => setWalletAddresses({ ...walletAddresses, eth: e.target.value })}
                    placeholder="Enter ETH address"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tether (USDT) Address</Label>
                  <Input
                    value={walletAddresses.usdt}
                    onChange={(e) => setWalletAddresses({ ...walletAddresses, usdt: e.target.value })}
                    placeholder="Enter USDT address"
                  />
                </div>
                <Button onClick={handleSaveSettings} disabled={loading}>
                  Save Addresses
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>User Details: {selectedUser?.username}</DialogTitle>
            <DialogDescription>View and modify user account</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Balance</Label>
                  <p className="text-2xl font-bold">${selectedUser.balance.toFixed(2)}</p>
                </div>
                <div>
                  <Label>Games Played</Label>
                  <p className="text-2xl font-bold">{selectedUser.gamesPlayed}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedUser(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
