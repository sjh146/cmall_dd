import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import WalletModal from '../components/WalletModal';
import { ShoppingBag, Wallet } from 'lucide-react';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // 로그인/회원가입 성공 후 지갑 연결 단계로 전환 (바로 이동하지 않음)
  const [loggedIn, setLoggedIn] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
        setLoggedIn(true);
      } else {
        if (password.length < 8) {
          setError('Password must be at least 8 characters');
          setIsLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setIsLoading(false);
          return;
        }
        if (!name.trim()) {
          setError('Name is required');
          setIsLoading(false);
          return;
        }
        await register(email, password, name);
        setRegisteredEmail(email);
        setLoggedIn(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setConfirmPassword('');
  };

  // 로그인 완료 → 지갑 연결 안내 (USDC 결제용)
  if (loggedIn) {
    const isDevMode = typeof window !== 'undefined' && !(window as any).ethereum;
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md mb-4">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">✅ 로그인 완료</CardTitle>
            <CardDescription className="text-center">
              {registeredEmail ? `${registeredEmail} 계정으로 가입되었습니다.` : '환영합니다!'}{' '}
              USDC 결제를 위해 지갑을 연결하세요.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              지갑 연결 (USDC 결제)
            </CardTitle>
            <CardDescription>
              MetaMask 지갑을 연결하면 분석 상품을 USDC(스마트컨트랙트)로 결제할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WalletModal devMode={isDevMode} />
          </CardContent>
          <CardFooter className="flex justify-center">
            <Link to="/">
              <Button>
                <ShoppingBag className="h-4 w-4 mr-2" />
                쇼핑몰 둘러보기
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </CardTitle>
          <CardDescription className="text-center">
            {isLogin 
              ? 'Sign in to your account to continue' 
              : 'Join our marketplace and start selling'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={!isLogin}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder={isLogin ? 'Enter your password' : 'At least 8 characters'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={isLogin ? 1 : 8}
              />
            </div>
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-destructive">Passwords do not match</p>
                )}
              </div>
            )}
            
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <div className="text-sm text-center text-muted-foreground">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={toggleMode}
              className="text-primary hover:underline font-medium"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </div>
          {isLogin && (
            <div className="text-sm text-center">
              <Link to="/" className="text-muted-foreground hover:text-primary">
                Continue as guest
              </Link>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
