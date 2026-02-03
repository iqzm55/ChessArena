import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Crown, Zap, Shield, DollarSign, Clock, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export default function Index() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="flex justify-center mb-6">
              <Crown className="h-20 w-20 text-primary" />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6">
              Play Chess.<br />
              <span className="text-primary">Win Money.</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Compete against players worldwide. Pay entry fees with crypto. 
              Win real money with your chess skills.
            </p>
            <div className="flex gap-4 justify-center">
              <Button size="lg" onClick={() => navigate(user ? '/lobby' : '/register')}>
                {user ? 'Play Now' : 'Get Started'}
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/lobby')}>
                View Games
              </Button>
            </div>
          </div>
        </div>
      </section>
      
      {/* Game Modes Section */}
      <section className="py-16 bg-card">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Game Modes</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center p-6 rounded-lg bg-background border border-border">
              <Zap className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Bullet</h3>
              <p className="text-muted-foreground mb-2">1 minute</p>
              <p className="text-2xl font-bold text-primary">$10 entry</p>
            </div>
            <div className="text-center p-6 rounded-lg bg-background border border-border">
              <Clock className="h-12 w-12 text-warning mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Blitz</h3>
              <p className="text-muted-foreground mb-2">3 minutes</p>
              <p className="text-2xl font-bold text-primary">$5 entry</p>
            </div>
            <div className="text-center p-6 rounded-lg bg-background border border-border">
              <Clock className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Blitz</h3>
              <p className="text-muted-foreground mb-2">5 minutes</p>
              <p className="text-2xl font-bold text-primary">$3 entry</p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Features Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Why ChessArena?</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="flex flex-col items-center text-center">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Shield className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Anti-Cheat System</h3>
              <p className="text-muted-foreground">
                Advanced move analysis to ensure fair play. Cheaters are automatically banned.
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <DollarSign className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Crypto Payments</h3>
              <p className="text-muted-foreground">
                Deposit and withdraw using BTC, ETH, or USDT. Fast and secure transactions.
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Trophy className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Real Winnings</h3>
              <p className="text-muted-foreground">
                Win the full prize pool minus a small platform fee. Your skill pays off.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-20 bg-primary/10">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Play?</h2>
          <p className="text-muted-foreground mb-8">
            Create your account, deposit crypto, and start winning.
          </p>
          <Button size="lg" onClick={() => navigate(user ? '/lobby' : '/register')}>
            {user ? 'Enter Lobby' : 'Create Account'}
          </Button>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2024 ChessArena. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
