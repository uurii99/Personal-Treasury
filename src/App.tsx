import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { ToastContainer } from '@/components/ui';
import { ProtectedRoute, PublicOnlyRoute } from '@/components/auth/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';

// Auth pages
import { LoginPage } from '@/pages/auth/LoginPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { AuthCallbackPage } from '@/pages/auth/AuthCallbackPage';
import { OnboardingPage } from '@/pages/onboarding/OnboardingPage';

// App pages
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { TreasuryPage } from '@/pages/treasury/TreasuryPage';
import { SectionDetailPage } from '@/pages/treasury/SectionDetailPage';
import { AnnualViewPage } from '@/pages/annual/AnnualViewPage';
import { HistoryPage } from '@/pages/history/HistoryPage';
import { CategoriesPage } from '@/pages/categories/CategoriesPage';
import { RecurringExpensesPage } from '@/pages/recurring/RecurringExpensesPage';
import { SavingsPage } from '@/pages/savings/SavingsPage';
import { StatisticsPage } from '@/pages/statistics/StatisticsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { ProfilePage } from '@/pages/profile/ProfilePage';

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
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
            <ToastContainer />
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
