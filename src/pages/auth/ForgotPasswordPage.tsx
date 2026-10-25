import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Wallet, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Input } from '@/components/ui';

const schema = z.object({
  email: z.string().email('Introduce un correo electrónico válido'),
});

type FormData = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { resetPassword } = useAuth();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const handleSubmit = async (data: FormData) => {
    setError(null);
    setLoading(true);
    try {
      const { error } = await resetPassword(data.email);
      if (error) {
        setError('Error al enviar el correo. Inténtalo de nuevo.');
      } else {
        setSent(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-50 via-brand-50/30 to-surface-100 dark:from-surface-950 dark:via-brand-950/20 dark:to-surface-950 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-500/25 mb-4">
            <Wallet className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
            Recuperar contraseña
          </h1>
        </div>

        <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl shadow-card p-6 sm:p-8">
          {sent ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-success-50 dark:bg-success-900/30 mb-4">
                <CheckCircle className="h-6 w-6 text-success-500" />
              </div>
              <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-2">
                Correo enviado
              </h2>
              <p className="text-sm text-surface-500 mb-6">
                Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña.
              </p>
              <Link to="/login">
                <Button variant="outline" icon={<ArrowLeft className="h-4 w-4" />}>
                  Volver al inicio de sesión
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-surface-500 mb-6">
                Introduce tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
              </p>

              {error && (
                <div className="p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800/50 mb-4">
                  <p className="text-sm text-danger-700 dark:text-danger-400">{error}</p>
                </div>
              )}

              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <Input
                  label="Correo electrónico"
                  type="email"
                  placeholder="tu@email.com"
                  icon={<Mail className="h-4 w-4" />}
                  error={form.formState.errors.email?.message}
                  {...form.register('email')}
                />
                <Button type="submit" size="lg" className="w-full" loading={loading}>
                  Enviar enlace de recuperación
                </Button>
              </form>

              <div className="text-center mt-4">
                <Link
                  to="/login"
                  className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400 inline-flex items-center gap-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Volver al inicio de sesión
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
