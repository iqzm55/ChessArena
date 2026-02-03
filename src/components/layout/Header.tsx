import { Link, useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Wallet, LogOut, Crown, Settings } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';

export function Header() {
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();
  
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <Crown className="h-8 w-8 text-primary" />
          <span className="text-xl font-bold text-foreground">ChessArena</span>
        </Link>
        
        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <Link to="/lobby" className="text-muted-foreground hover:text-foreground transition-colors">
            Play
          </Link>
          <Link to="/leaderboard" className="text-muted-foreground hover:text-foreground transition-colors">
            Leaderboard
          </Link>
          {isAdmin && (
            <Link to="/admin" className="text-warning hover:text-warning/80 transition-colors font-semibold">
              Admin
            </Link>
          )}
        </nav>
        
        {/* User section */}
        {user ? (
          <div className="flex items-center gap-4">
            {/* Wallet Balance */}
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => navigate('/wallet')}
            >
              <Wallet className="h-4 w-4" />
              <span className="font-mono font-bold">${user.walletBalance.toFixed(2)}</span>
            </Button>
            
            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatar} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {(user.displayName || user.username)[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden md:inline font-medium">{user.displayName || user.username}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <Settings className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/wallet')}>
                  <Wallet className="mr-2 h-4 w-4" />
                  Wallet
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/login')}>
              Login
            </Button>
            <Button onClick={() => navigate('/register')}>
              Sign Up
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
