import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button, Input, Logo, LanguageToggle } from '@/components/ui';

const loginSchema = z.object({
  email: z.string().email('Introduce un correo electrónico válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

const registerSchema = z
  .object({
    email: z.string().email('Introduce un correo electrónico válido'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const callbackError = searchParams.get('error');

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  // Preload remembered email if exists
  useEffect(() => {
    const saved = localStorage.getItem('remembered_email');
    if (saved) {
      loginForm.setValue('email', saved);
      setRememberMe(true);
    }
  }, [loginForm]);

  const handleLogin = async (data: LoginFormData) => {
    setError(null);
    setLoading(true);
    try {
      if (rememberMe) {
        localStorage.setItem('remembered_email', data.email);
      } else {
        localStorage.removeItem('remembered_email');
      }

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
        if (rememberMe) {
          localStorage.setItem('remembered_email', data.email);
        }
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-50 via-emerald-50/25 to-surface-100 dark:from-surface-950 dark:via-emerald-950/20 dark:to-surface-950 p-4 relative">
      {/* Language switcher top right */}
      <div className="absolute top-4 right-4 z-10">
        <LanguageToggle />
      </div>

      <div className="w-full max-w-md">
        {/* Header with custom Logo */}
        <div className="flex flex-col items-center justify-center text-center mb-6">
          <Logo size="xl" showText={false} className="mb-3" />
          <h1 className="text-2xl font-black text-surface-900 dark:text-surface-100 tracking-tight">
            Personal Treasury
          </h1>
          <p className="text-xs text-surface-500 mt-1 uppercase tracking-wider font-semibold">
            {language === 'ca' ? 'La teva tresoreria i excel anual' : 'Tu tesorería y excel anual'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl shadow-xl p-6 sm:p-8">
          <h2 className="text-lg font-bold text-surface-900 dark:text-surface-100 mb-1">
            {mode === 'login'
              ? language === 'ca'
                ? 'Iniciar sessió'
                : 'Iniciar sesión'
              : language === 'ca'
              ? 'Crear compte'
              : 'Crear cuenta'}
          </h2>
          <p className="text-xs text-surface-500 mb-6">
            {mode === 'login'
              ? language === 'ca'
                ? 'Accedeix al teu pressupost anual'
                : 'Accede a tu presupuesto y excel anual'
              : language === 'ca'
              ? "Registra't per començar a gestionar els teus diners"
              : 'Regístrate para empezar a gestionar tu dinero'}
          </p>

          {/* Errors */}
          {(error || callbackError) && (
            <div
              className="flex items-start gap-2 p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800/50 mb-4"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 text-danger-500 shrink-0 mt-0.5" />
              <p className="text-xs text-danger-700 dark:text-danger-400">
                {error || 'Error en la autenticación. Inténtalo de nuevo.'}
              </p>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="p-3 rounded-lg bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800/50 mb-4">
              <p className="text-xs text-success-700 dark:text-success-400">{success}</p>
            </div>
          )}

          {/* Google Sign-in */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-700 dark:text-surface-200 hover:bg-surface-50 dark:hover:bg-surface-700/80 transition-all font-medium text-xs shadow-sm"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{language === 'ca' ? 'Continuar amb Google' : 'Continuar con Google'}</span>
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-surface-200 dark:border-surface-800" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
              <span className="bg-white dark:bg-surface-900 px-3 text-surface-400 font-semibold">
                {language === 'ca' ? 'o amb correu' : 'o con correo electrónico'}
              </span>
            </div>
          </div>

          {/* Login Form */}
          {mode === 'login' && (
            <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-3.5">
              <Input
                label={language === 'ca' ? 'Correu electrònic' : 'Correo electrónico'}
                type="email"
                placeholder="tu@email.com"
                icon={<Mail className="h-4 w-4" />}
                error={loginForm.formState.errors.email?.message}
                {...loginForm.register('email')}
              />

              <div>
                <Input
                  label={language === 'ca' ? 'Contrasenya' : 'Contraseña'}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  icon={<Lock className="h-4 w-4" />}
                  suffix={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                  error={loginForm.formState.errors.password?.message}
                  {...loginForm.register('password')}
                />
              </div>

              {/* Recordar usuario checkbox & Forgot password */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-surface-700 dark:text-surface-300">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <span>
                    {language === 'ca'
                      ? 'Recordar usuari (sessió permanent)'
                      : 'Recordar usuario (no cerrar sesión)'}
                  </span>
                </label>

                <Link
                  to="/forgot-password"
                  className="text-emerald-700 hover:underline dark:text-emerald-400 font-medium"
                >
                  {language === 'ca' ? 'Has oblidat la contrasenya?' : '¿Olvidaste tu contraseña?'}
                </Link>
              </div>

              <Button type="submit" size="lg" className="w-full bg-[#107c41] hover:bg-[#0d6836] text-white mt-2" loading={loading}>
                {language === 'ca' ? 'Iniciar sessió' : 'Iniciar sesión'}
              </Button>
            </form>
          )}

          {/* Register Form */}
          {mode === 'register' && (
            <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-3.5">
              <Input
                label={language === 'ca' ? 'Correu electrònic' : 'Correo electrónico'}
                type="email"
                placeholder="tu@email.com"
                icon={<Mail className="h-4 w-4" />}
                error={registerForm.formState.errors.email?.message}
                {...registerForm.register('email')}
              />
              <Input
                label={language === 'ca' ? 'Contrasenya' : 'Contraseña'}
                type={showPassword ? 'text' : 'password'}
                placeholder="Mínimo 6 caracteres"
                icon={<Lock className="h-4 w-4" />}
                suffix={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-surface-400 hover:text-surface-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
                error={registerForm.formState.errors.password?.message}
                {...registerForm.register('password')}
              />
              <Input
                label={language === 'ca' ? 'Confirmar contrasenya' : 'Confirmar contraseña'}
                type={showPassword ? 'text' : 'password'}
                placeholder="Repite tu contraseña"
                icon={<Lock className="h-4 w-4" />}
                error={registerForm.formState.errors.confirmPassword?.message}
                {...registerForm.register('confirmPassword')}
              />

              <div className="flex items-center text-xs">
                <label className="flex items-center gap-2 cursor-pointer select-none text-surface-700 dark:text-surface-300">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <span>
                    {language === 'ca'
                      ? 'Recordar aquest usuari en aquest dispositiu'
                      : 'Recordar este usuario en este dispositivo'}
                  </span>
                </label>
              </div>

              <Button type="submit" size="lg" className="w-full bg-[#107c41] hover:bg-[#0d6836] text-white mt-2" loading={loading}>
                {language === 'ca' ? 'Crear compte' : 'Crear cuenta'}
              </Button>
            </form>
          )}

          {/* Switch mode */}
          <p className="text-xs text-center text-surface-500 mt-5">
            {mode === 'login'
              ? language === 'ca'
                ? 'No tens compte? '
                : '¿No tienes cuenta? '
              : language === 'ca'
              ? 'Ja tens compte? '
              : '¿Ya tienes cuenta? '}
            <button
              onClick={switchMode}
              className="text-emerald-700 hover:underline dark:text-emerald-400 font-bold"
            >
              {mode === 'login'
                ? language === 'ca'
                  ? "Registra't"
                  : 'Regístrate'
                : language === 'ca'
                ? 'Inicia sessió'
                : 'Inicia sesión'}
            </button>
          </p>
        </div>

        <p className="text-center text-[11px] text-surface-400 mt-5">
          🔒 Sesión persistente y protegida. Tus datos están seguros y privados.
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
