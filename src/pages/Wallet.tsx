import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { CryptoType } from '@/lib/chess/types';
import { apiJson } from '@/lib/api';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Bitcoin,
  History,
  CheckCircle,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';

const CRYPTO_INFO = {
  btc: { name: 'Bitcoin', symbol: 'BTC', color: 'text-crypto-btc', icon: '₿' },
  eth: { name: 'Ethereum', symbol: 'ETH', color: 'text-crypto-eth', icon: 'Ξ' },
  usdt: { name: 'Tether', symbol: 'USDT', color: 'text-crypto-usdt', icon: '₮' },
};

interface TxRow {
  id: string;
  type: string;
  amount: number;
  status: string;
  createdAt: string;
  cryptoType?: string;
}

export default function Wallet() {
  const navigate = useNavigate();
  const { user, token, refreshUser } = useAuth();
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoType | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState('');
  const [withdrawCrypto, setWithdrawCrypto] = useState<CryptoType>('usdt');
  const [walletAddresses, setWalletAddresses] = useState<Record<CryptoType, string>>({
    btc: '',
    eth: '',
    usdt: '',
  });
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !token) return;
    refreshUser();
    const load = async () => {
      try {
        const [addrRes, txRes] = await Promise.all([
          apiJson<{ btc: string; eth: string; usdt: string }>('/api/wallet/deposit-addresses', { token }),
          apiJson<{ transactions: TxRow[] }>('/api/wallet/transactions', { token }),
        ]);
        setWalletAddresses({ btc: addrRes.btc || '', eth: addrRes.eth || '', usdt: addrRes.usdt || '' });
        setTransactions(txRes.transactions || []);
      } catch {
        // ignore
      }
    };
    load();
  }, [user?.id, token]);

  if (!user) {
    navigate('/login');
    return null;
  }

  const handleDeposit = (crypto: CryptoType) => {
    setSelectedCrypto(crypto);
  };

  const handleConfirmPayment = async () => {
    if (!selectedCrypto || !token) return;
    const amountUsd = parseFloat(depositAmount);
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setLoading(true);
    try {
      await apiJson('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cryptoType: selectedCrypto, amountUsd }),
        token,
      });
      setShowConfirmDialog(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Deposit request failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    setShowConfirmDialog(false);
    setSelectedCrypto(null);
    setDepositAmount('');
    refreshUser();
    toast.success('Deposit request submitted! Your balance will be updated once confirmed.');
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success('Address copied to clipboard');
  };

  const handleWithdraw = async () => {
    if (!token) return;
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    const amount = parseFloat(withdrawAmount);
    const fee = 1;
    if (amount + fee > user.walletBalance) {
      toast.error('Insufficient balance (including $1.00 fee)');
      return;
    }
    if (user.gamesPlayed < 1) {
      toast.error('You must play at least 1 game before withdrawing');
      return;
    }
    if (!withdrawAddress.trim()) {
      toast.error('Enter your wallet address');
      return;
    }
    setLoading(true);
    try {
      await apiJson('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, cryptoType: withdrawCrypto, address: withdrawAddress.trim() }),
        token,
      });
      toast.success('Withdrawal request submitted! It will be processed by admin.');
      setWithdrawAmount('');
      setWithdrawAddress('');
      refreshUser();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Withdrawal request failed');
    } finally {
      setLoading(false);
    }
  };

  const addressForCrypto = selectedCrypto ? walletAddresses[selectedCrypto] : '';

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card className="mb-8">
            <CardHeader className="text-center">
              <CardDescription>Your Balance</CardDescription>
              <CardTitle className="text-5xl font-bold text-primary">
                ${user.walletBalance.toFixed(2)}
              </CardTitle>
            </CardHeader>
          </Card>

          <Tabs defaultValue="deposit" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="deposit" className="gap-2">
                <ArrowDownToLine className="h-4 w-4" />
                Deposit
              </TabsTrigger>
              <TabsTrigger value="withdraw" className="gap-2">
                <ArrowUpFromLine className="h-4 w-4" />
                Withdraw
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-2">
                <History className="h-4 w-4" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="deposit" className="space-y-6">
              {!selectedCrypto ? (
                <div className="grid md:grid-cols-3 gap-4">
                  {(Object.keys(CRYPTO_INFO) as CryptoType[]).map((crypto) => (
                    <Card
                      key={crypto}
                      className="cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => handleDeposit(crypto)}
                    >
                      <CardContent className="pt-6 text-center">
                        <div className={`text-4xl mb-2 ${CRYPTO_INFO[crypto].color}`}>
                          {CRYPTO_INFO[crypto].icon}
                        </div>
                        <h3 className="font-semibold">{CRYPTO_INFO[crypto].name}</h3>
                        <p className="text-sm text-muted-foreground">{CRYPTO_INFO[crypto].symbol}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span className={CRYPTO_INFO[selectedCrypto].color}>
                        {CRYPTO_INFO[selectedCrypto].icon}
                      </span>
                      Deposit {CRYPTO_INFO[selectedCrypto].name}
                    </CardTitle>
                    <CardDescription>
                      Send the exact amount to the address below
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label>Amount (USD)</Label>
                      <Input
                        type="number"
                        placeholder="Enter amount in USD"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Send {CRYPTO_INFO[selectedCrypto].symbol} to this address:</Label>
                      <div className="flex gap-2">
                        <Input
                          value={addressForCrypto}
                          readOnly
                          className="font-mono text-sm"
                          placeholder="Admin has not set this address yet"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyAddress(addressForCrypto)}
                          disabled={!addressForCrypto}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <div className="w-48 h-48 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-border">
                        <div className="text-center text-muted-foreground">
                          <Bitcoin className="h-12 w-12 mx-auto mb-2" />
                          <p className="text-sm">QR Code</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-semibold mb-2">Instructions:</h4>
                      <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                        <li>Send the exact amount in {CRYPTO_INFO[selectedCrypto].symbol}</li>
                        <li>Wait for blockchain confirmation</li>
                        <li>Click &quot;I&apos;ve sent the payment&quot; below</li>
                        <li>Admin will verify and credit your balance</li>
                      </ol>
                    </div>

                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setSelectedCrypto(null)}>
                        Back
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={handleConfirmPayment}
                        disabled={!addressForCrypto || loading}
                      >
                        I&apos;ve sent the payment
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="withdraw">
              <Card>
                <CardHeader>
                  <CardTitle>Withdraw Funds</CardTitle>
                  <CardDescription>
                    Minimum 1 game played required. $1.00 withdrawal fee applies.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select Cryptocurrency</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {(Object.keys(CRYPTO_INFO) as CryptoType[]).map((crypto) => (
                        <Button
                          key={crypto}
                          variant={withdrawCrypto === crypto ? 'default' : 'outline'}
                          onClick={() => setWithdrawCrypto(crypto)}
                          className="gap-2"
                        >
                          <span className={CRYPTO_INFO[crypto].color}>
                            {CRYPTO_INFO[crypto].icon}
                          </span>
                          {CRYPTO_INFO[crypto].symbol}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Amount (USD)</Label>
                    <Input
                      type="number"
                      placeholder="Enter amount"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                    />
                    <p className="text-sm text-muted-foreground">
                      Available: ${user.walletBalance.toFixed(2)} (Fee: $1.00)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Your {CRYPTO_INFO[withdrawCrypto].symbol} Address</Label>
                    <Input
                      placeholder={`Enter your ${CRYPTO_INFO[withdrawCrypto].symbol} wallet address`}
                      value={withdrawAddress}
                      onChange={(e) => setWithdrawAddress(e.target.value)}
                    />
                  </div>

                  <Button
                    className="w-full"
                    onClick={handleWithdraw}
                    disabled={user.gamesPlayed < 1 || loading}
                  >
                    {user.gamesPlayed < 1
                      ? 'Play at least 1 game first'
                      : 'Request Withdrawal'}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle>Transaction History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {transactions.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No transactions yet.</p>
                    ) : (
                      transactions.map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                        >
                          <div>
                            <p className="font-medium capitalize">
                              {tx.type.replace('_', ' ')}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(tx.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p
                              className={
                                tx.amount >= 0
                                  ? 'text-primary font-semibold'
                                  : 'text-destructive font-semibold'
                              }
                            >
                              {tx.amount >= 0 ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
                            </p>
                            <p
                              className={`text-sm ${
                                tx.status === 'completed' ? 'text-primary' : 'text-warning'
                              }`}
                            >
                              {tx.status}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-16 w-16 text-primary" />
            </div>
            <DialogTitle className="text-center">Payment Processing</DialogTitle>
            <DialogDescription className="text-center">
              Your deposit is being processed. Your balance will be credited once the payment is
              confirmed by our admin team.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={handleDone} className="w-full">
            Done
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
