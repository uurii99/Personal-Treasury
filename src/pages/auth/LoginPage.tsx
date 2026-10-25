import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Wallet, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input } from '@/components/ui';

const loginSchema = z.object({
  email: z.string().email('Introduce un correo electrónico válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

const registerSchema = z.object({
  email: z.string().email('Introduce un correo electrónico válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const callbackError = searchParams.get('error');

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const handleLogin = async (data: LoginFormData) => {
    setError(null);
    setLoading(true);
    try {
      const { error } = await signInWithEmail(data.email, data.password);
      if (error) {
        setError(translateAuthError(error.message));
      } else {
        navigate('/dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (data: RegisterFormData) => {
    setError(null);
    setLoading(true);
    try {
      const { error } = await signUpWithEmail(data.email, data.password);
      if (error) {
        console.error('Registration error:', error);
        setError(translateAuthError(error.message));
      } else {
        // Email confirmation disabled - user is auto-logged in
        navigate('/onboarding');
      }
    } catch (e) {
      console.error('Unexpected registration error:', e);
      setError('Ha ocurrido un error inesperado. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };


  const handleGoogleLogin = async () => {
    setError(null);
    const { error } = await signInWithGoogle();
    if (error) {
      setError('Error al iniciar sesión con Google. Inténtalo de nuevo.');
    }
  };

  const switchMode = () => {
    setMode((prev) => (prev === 'login' ? 'register' : 'login'));
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-50 via-brand-50/30 to-surface-100 dark:from-surface-950 dark:via-brand-950/20 dark:to-surface-950 p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-500/25 mb-4">
            <Wallet className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
            Personal Treasury
          </h1>
          <p className="text-sm text-surface-500 mt-1">
            Tu tesorería personal
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl shadow-card p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-1">
            {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </h2>
          <p className="text-sm text-surface-500 mb-6">
            {mode === 'login'
              ? 'Accede a tu tesorería personal'
              : 'Regístrate para empezar a gestionar tu dinero'}
          </p>

          {/* Errors */}
          {(error || callbackError) && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800/50 mb-4" role="alert">
              <AlertCircle className="h-4 w-4 text-danger-500 shrink-0 mt-0.5" />
              <p className="text-sm text-danger-700 dark:text-danger-400">
                {error || 'Error en la autenticación. Inténtalo de nuevo.'}
              </p>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="p-3 rounded-lg bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800/50 mb-4">
              <p className="text-sm text-success-700 dark:text-success-400">{success}</p>
            </div>
          )}




          {/* Login Form */}
          {mode === 'login' && (
            <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
              <Input
                label="Correo electrónico"
                type="email"
                placeholder="tu@email.com"
                icon={<Mail className="h-4 w-4" />}
                error={loginForm.formState.errors.email?.message}
                {...loginForm.register('email')}
              />
              <div>
                <Input
                  label="Contraseña"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  icon={<Lock className="h-4 w-4" />}
                  suffix={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                  error={loginForm.formState.errors.password?.message}
                  {...loginForm.register('password')}
                />
                <div className="flex justify-end mt-1.5">
                  <Link
                    to="/forgot-password"
                    className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
              </div>
              <Button type="submit" size="lg" className="w-full" loading={loading}>
                Iniciar sesión
              </Button>
            </form>
          )}

          {/* Register Form */}
          {mode === 'register' && (
            <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
              <Input
                label="Correo electrónico"
                type="email"
                placeholder="tu@email.com"
                icon={<Mail className="h-4 w-4" />}
                error={registerForm.formState.errors.email?.message}
                {...registerForm.register('email')}
              />
              <Input
                label="Contraseña"
                type={showPassword ? 'text' : 'password'}
                placeholder="Mínimo 6 caracteres"
                icon={<Lock className="h-4 w-4" />}
                suffix={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-surface-400 hover:text-surface-600"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
                error={registerForm.formState.errors.password?.message}
                {...registerForm.register('password')}
              />
              <Input
                label="Confirmar contraseña"
                type={showPassword ? 'text' : 'password'}
                placeholder="Repite tu contraseña"
                icon={<Lock className="h-4 w-4" />}
                error={registerForm.formState.errors.confirmPassword?.message}
                {...registerForm.register('confirmPassword')}
              />
              <Button type="submit" size="lg" className="w-full" loading={loading}>
                Crear cuenta
              </Button>
            </form>
          )}

          {/* Switch mode */}
          <p className="text-sm text-center text-surface-500 mt-6">
            {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
            <button
              onClick={switchMode}
              className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-medium"
            >
              {mode === 'login' ? 'Regístrate' : 'Inicia sesión'}
            </button>
          </p>
        </div>

        <p className="text-center text-xs text-surface-400 mt-6">
          Tus datos financieros están protegidos y son privados.
        </p>
      </div>
    </div>
  );
}

function translateAuthError(message: string): string {
  if (message.includes('Invalid login credentials')) {
    return 'Credenciales incorrectas. Revisa tu correo y contraseña.';
  }
  if (message.includes('Email not confirmed')) {
    return 'Correo no confirmado. Revisa tu bandeja de entrada.';
  }
  if (message.includes('User already registered')) {
    return 'Este correo ya está registrado. Inicia sesión o recupera tu contraseña.';
  }
  if (message.includes('Password should be')) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }
  return 'Ha ocurrido un error. Inténtalo de nuevo.';
}
