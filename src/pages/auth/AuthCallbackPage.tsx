import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

/**
 * Handles the OAuth callback redirect from Supabase/Google.
 */
export function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error en callback de autenticación:', error);
          navigate('/login?error=auth_callback_failed');
          return;
        }
        navigate('/dashboard');
      } catch {
        navigate('/login?error=auth_callback_failed');
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
        <p className="text-sm text-surface-500">Completando inicio de sesión...</p>
      </div>
    </div>
  );
}
