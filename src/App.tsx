import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { ToastContainer } from '@/components/ui';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ProtectedRoute, PublicOnlyRoute } from '@/components/auth/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';

// Auth pages (lazy loaded)
const LoginPage = lazy(() => import('@/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const AuthCallbackPage = lazy(() => import('@/pages/auth/AuthCallbackPage').then((m) => ({ default: m.AuthCallbackPage })));
const OnboardingPage = lazy(() => import('@/pages/onboarding/OnboardingPage').then((m) => ({ default: m.OnboardingPage })));

// App pages (lazy loaded)
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const BanksPage = lazy(() => import('@/pages/banks/BanksPage').then((m) => ({ default: m.BanksPage })));
const GoalsPage = lazy(() => import('@/pages/goals/GoalsPage').then((m) => ({ default: m.GoalsPage })));
const TreasuryPage = lazy(() => import('@/pages/treasury/TreasuryPage').then((m) => ({ default: m.TreasuryPage })));
const SectionDetailPage = lazy(() => import('@/pages/treasury/SectionDetailPage').then((m) => ({ default: m.SectionDetailPage })));
const AnnualViewPage = lazy(() => import('@/pages/annual/AnnualViewPage').then((m) => ({ default: m.AnnualViewPage })));
const HistoryPage = lazy(() => import('@/pages/history/HistoryPage').then((m) => ({ default: m.HistoryPage })));
const CategoriesPage = lazy(() => import('@/pages/categories/CategoriesPage').then((m) => ({ default: m.CategoriesPage })));
const RecurringExpensesPage = lazy(() => import('@/pages/recurring/RecurringExpensesPage').then((m) => ({ default: m.RecurringExpensesPage })));
const SavingsPage = lazy(() => import('@/pages/savings/SavingsPage').then((m) => ({ default: m.SavingsPage })));
const StatisticsPage = lazy(() => import('@/pages/statistics/StatisticsPage').then((m) => ({ default: m.StatisticsPage })));
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const ProfilePage = lazy(() => import('@/pages/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })));

function PageLoader() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <ToastProvider>
          <BrowserRouter>
            <AuthProvider>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Public routes */}
                  <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
                  <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPasswordPage /></PublicOnlyRoute>} />
                  <Route path="/auth/callback" element={<AuthCallbackPage />} />

                  {/* Onboarding */}
                  <Route path="/onboarding" element={<OnboardingPage />} />

                  {/* Protected app routes */}
                  <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/banks" element={<BanksPage />} />
                    <Route path="/goals" element={<GoalsPage />} />
                    <Route path="/treasury" element={<TreasuryPage />} />
                    <Route path="/treasury/section/:section" element={<SectionDetailPage />} />
                    <Route path="/annual" element={<AnnualViewPage />} />
                    <Route path="/history" element={<HistoryPage />} />
                    <Route path="/categories" element={<CategoriesPage />} />
                    <Route path="/recurring" element={<RecurringExpensesPage />} />
                    <Route path="/savings" element={<SavingsPage />} />
                    <Route path="/statistics" element={<StatisticsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                  </Route>

                  {/* Catch-all redirect */}
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Suspense>
              <ToastContainer />
            </AuthProvider>
          </BrowserRouter>
        </ToastProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
