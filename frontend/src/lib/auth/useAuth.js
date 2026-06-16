'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';


/**
 * Client-side hook for auth actions.
 * All fetch calls go to Next.js /api/auth/* (the BFF layer).
 * Tokens are NEVER handled client-side — cookies are set server-side by Next.js.
 */
export function useAuth() {
  const router = useRouter();
  const [state, setState] = useState({ loading: false, error: null });

  const setLoading = (loading) => setState((s) => ({ ...s, loading }));
  const setError = (error) => setState((s) => ({ ...s, error }));

  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        return false;
      }

      // On success, Next.js middleware has set the HttpOnly cookies.
      // Redirect to the protected area.
      router.push('/dashboard');
      router.refresh(); // force server component re-render to pick up new session
      return true;
    } catch {
      setError('Network error. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [router]);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      // Always redirect to login, even if the backend call fails
      router.push('/login');
      router.refresh();
      setLoading(false);
    }
  }, [router]);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/auth/refresh', { method: 'POST' });
    return res.ok;
  }, []);

  return {
    login,
    logout,
    refresh,
    loading: state.loading,
    error: state.error,
  };
}
