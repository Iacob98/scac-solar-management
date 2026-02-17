import { useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Lock, Mail } from 'lucide-react';

export default function WorkerLogin() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { setSession } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');

  const loginMutation = useMutation({
    mutationFn: async (data: { email: string; pin: string }) => {
      const response = await fetch('/api/worker-auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }

      return response.json();
    },
    onSuccess: async (data) => {
      // Store the session with both tokens
      if (data.accessToken && data.refreshToken && setSession) {
        await setSession(data.accessToken, data.refreshToken);

        // Clear all queries to ensure fresh data with new token
        queryClient.clear();
      }

      toast({
        title: 'Success',
        description: 'Successfully logged in',
      });

      // Small delay to ensure session is fully set before navigation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Redirect to worker dashboard
      navigate('/worker');
    },
    onError: (error: Error) => {
      toast({
        title: 'Login failed',
        description: error.message || 'Invalid email or PIN',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !pin) {
      toast({
        title: 'Error',
        description: 'Please enter both email and PIN',
        variant: 'destructive',
      });
      return;
    }

    if (pin.length !== 6 || !/^\d+$/.test(pin)) {
      toast({
        title: 'Error',
        description: 'PIN must be exactly 6 digits',
        variant: 'destructive',
      });
      return;
    }

    loginMutation.mutate({ email, pin });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-4">
            <span className="text-white font-bold text-2xl">W</span>
          </div>
          <CardTitle className="text-2xl font-bold">Worker Portal</CardTitle>
          <CardDescription>
            Enter your email and PIN to access your projects
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  disabled={loginMutation.isPending}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pin">PIN Code</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="pin"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="Enter 6-digit PIN"
                  value={pin}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    if (value.length <= 6) {
                      setPin(value);
                    }
                  }}
                  className="pl-10 tracking-widest text-center font-mono text-lg"
                  disabled={loginMutation.isPending}
                />
              </div>
              <p className="text-xs text-gray-500">
                Your PIN was provided by your team leader
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loginMutation.isPending || !email || pin.length !== 6}
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t text-center">
            <p className="text-sm text-gray-500">
              Need a PIN? Contact your team leader.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
