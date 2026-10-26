import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  Receipt,
  CalendarDays,
  PiggyBank,
  BarChart3,
  Settings,
  Tag,
  Repeat,
  History,
  Plus,
  LogOut,
  Moon,
  Sun,
  Monitor,
  Menu,
  X,
  ChevronDown,
  User,
  FileSpreadsheet,
  Landmark,
  Target,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button, Logo, LanguageToggle } from '@/components/ui';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

function NavSection({ title, items, onNavigate }: { title?: string; items: NavItem[]; onNavigate?: () => void }) {
  return (
    <div>
      {title && (
        <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-surface-400 dark:text-surface-500">
          {title}
        </p>
      )}
      <nav className="space-y-0.5">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 shadow-sm'
                  : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900 dark:text-surface-400 dark:hover:bg-surface-800 dark:hover:text-surface-200'
              }`
            }
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const options = [
    { value: 'light' as const, icon: <Sun className="h-3.5 w-3.5" />, label: 'Claro' },
    { value: 'dark' as const, icon: <Moon className="h-3.5 w-3.5" />, label: 'Oscuro' },
    { value: 'system' as const, icon: <Monitor className="h-3.5 w-3.5" />, label: 'Sistema' },
  ];

  return (
    <div className="flex items-center bg-surface-100 dark:bg-surface-800 rounded-lg p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
            theme === opt.value
              ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 shadow-sm'
              : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
          }`}
          title={opt.label}
          aria-label={`Tema ${opt.label}`}
        >
          {opt.icon}
          <span className="hidden lg:inline">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

export function AppLayout() {
  const { profile, signOut } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const mainNavItems: NavItem[] = [
    { to: '/dashboard', label: t.nav.excel, icon: <FileSpreadsheet className="h-4 w-4 text-[#107c41]" /> },
    { to: '/banks', label: t.nav.banks, icon: <Landmark className="h-4 w-4 text-brand-600 dark:text-brand-400" /> },
    { to: '/goals', label: t.nav.goals, icon: <Target className="h-4 w-4 text-amber-500" /> },
    { to: '/treasury', label: t.nav.currentMonth, icon: <Receipt className="h-4 w-4" /> },
    { to: '/annual', label: t.nav.annualView, icon: <CalendarDays className="h-4 w-4" /> },
    { to: '/history', label: t.nav.history, icon: <History className="h-4 w-4" /> },
  ];

  const managementNavItems: NavItem[] = [
    { to: '/statistics', label: t.nav.stats, icon: <BarChart3 className="h-4 w-4" /> },
    { to: '/categories', label: t.nav.categories, icon: <Tag className="h-4 w-4" /> },
    { to: '/recurring', label: t.nav.recurring, icon: <Repeat className="h-4 w-4" /> },
    { to: '/savings', label: t.nav.savings, icon: <PiggyBank className="h-4 w-4" /> },
  ];

  const settingsNavItems: NavItem[] = [
    { to: '/settings', label: t.nav.settings, icon: <Settings className="h-4 w-4" /> },
  ];

  const handleAddMovement = () => {
    navigate('/treasury?action=add');
  };

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen flex bg-surface-50 dark:bg-surface-950">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed z-50 top-0 left-0 h-full w-64
          bg-white dark:bg-surface-900
          border-r border-surface-200 dark:border-surface-800
          flex flex-col
          transition-transform duration-300 ease-out
          lg:translate-x-0 lg:static lg:z-auto
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-surface-200 dark:border-surface-800 shrink-0">
          <Logo size="md" showText />
          <button
            onClick={closeSidebar}
            className="p-1.5 rounded-lg text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Quick action */}
        <div className="px-3 py-3">
          <Button
            size="md"
            className="w-full shadow-sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={handleAddMovement}
          >
            {t.nav.addMovement}
          </Button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 space-y-5">
          <NavSection items={mainNavItems} onNavigate={closeSidebar} />
          <NavSection title={t.nav.management} items={managementNavItems} onNavigate={closeSidebar} />
          <NavSection items={settingsNavItems} onNavigate={closeSidebar} />
        </div>

        {/* Theme + Language + User */}
        <div className="border-t border-surface-200 dark:border-surface-800 px-3 py-3 space-y-2.5 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <ThemeToggle />
            <LanguageToggle />
          </div>

          {/* User */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-600 dark:text-brand-400 font-semibold text-xs">
                {profile?.display_name ? profile.display_name.charAt(0).toUpperCase() : <User className="h-3.5 w-3.5" />}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-xs font-semibold text-surface-900 dark:text-surface-100 truncate">
                  {profile?.display_name ?? 'Mi tesorería'}
                </p>
                <p className="text-[10px] text-surface-400 truncate">{profile?.email}</p>
              </div>
              <ChevronDown className={`h-3.5 w-3.5 text-surface-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {userMenuOpen && (
              <div className="absolute bottom-full left-0 w-full mb-1 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-lg shadow-dropdown p-1 animate-[slide-down_200ms_cubic-bezier(0.16,1,0.3,1)]">
                <NavLink
                  to="/profile"
                  onClick={() => { setUserMenuOpen(false); closeSidebar(); }}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-md"
                >
                  <User className="h-3.5 w-3.5" />
                  {t.nav.profile}
                </NavLink>
                <button
                  onClick={() => { signOut(); setUserMenuOpen(false); }}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-md w-full text-left"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {t.nav.logout}
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile) */}
        <header className="sticky top-0 z-30 flex items-center gap-2.5 h-14 px-4 bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl border-b border-surface-200 dark:border-surface-800 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-surface-600 hover:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-800"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Logo size="sm" showText />
          <div className="ml-auto flex items-center gap-1.5">
            <LanguageToggle />
            <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={handleAddMovement}>
              +
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6 py-5">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
