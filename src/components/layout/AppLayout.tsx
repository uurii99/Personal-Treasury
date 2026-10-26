import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Settings,
  Tag,
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
  PanelLeft,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button, Logo, LanguageToggle } from '@/components/ui';
import { AddMovementModal } from '@/components/modals/AddMovementModal';

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
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400 shadow-sm font-semibold'
                  : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900 dark:text-surface-400 dark:hover:bg-surface-800 dark:hover:text-surface-200'
              }`
            }
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function HeaderThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center bg-surface-100 dark:bg-surface-800 rounded-lg p-0.5 border border-surface-200/80 dark:border-surface-700/80">
      <button
        onClick={() => setTheme('light')}
        className={`p-1.5 rounded-md text-xs transition-all ${
          theme === 'light'
            ? 'bg-white dark:bg-surface-700 text-amber-600 shadow-sm'
            : 'text-surface-500 hover:text-surface-800 dark:hover:text-surface-200'
        }`}
        title="Modo Claro"
        aria-label="Modo Claro"
      >
        <Sun className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={`p-1.5 rounded-md text-xs transition-all ${
          theme === 'dark'
            ? 'bg-white dark:bg-surface-700 text-brand-400 shadow-sm'
            : 'text-surface-500 hover:text-surface-800 dark:hover:text-surface-200'
        }`}
        title="Modo Oscuro"
        aria-label="Modo Oscuro"
      >
        <Moon className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setTheme('system')}
        className={`p-1.5 rounded-md text-xs transition-all hidden sm:block ${
          theme === 'system'
            ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 shadow-sm'
            : 'text-surface-500 hover:text-surface-800 dark:hover:text-surface-200'
        }`}
        title="Tema del Sistema"
        aria-label="Tema del Sistema"
      >
        <Monitor className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function AppLayout() {
  const { profile, signOut } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Desktop sidebar collapse state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Mobile drawer open state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  // Profile dropdown open state
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showAddMovementModal, setShowAddMovementModal] = useState(false);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  useEffect(() => {
    const handleOpen = () => setShowAddMovementModal(true);
    window.addEventListener('open-add-movement', handleOpen);
    return () => window.removeEventListener('open-add-movement', handleOpen);
  }, []);

  // Clean navigation: removed Historial, Mes actual, /annual, /recurring, /savings as requested
  const mainNavItems: NavItem[] = [
    { to: '/dashboard', label: t.nav.excel, icon: <FileSpreadsheet className="h-4 w-4 text-[#107c41]" /> },
    { to: '/banks', label: t.nav.banks, icon: <Landmark className="h-4 w-4 text-brand-600 dark:text-brand-400" /> },
    { to: '/goals', label: t.nav.goals, icon: <Target className="h-4 w-4 text-amber-500" /> },
  ];

  const managementNavItems: NavItem[] = [
    { to: '/statistics', label: t.nav.stats, icon: <BarChart3 className="h-4 w-4" /> },
    { to: '/categories', label: t.nav.categories, icon: <Tag className="h-4 w-4" /> },
    { to: '/settings', label: t.nav.settings, icon: <Settings className="h-4 w-4" /> },
  ];

  const handleAddMovement = () => {
    setShowAddMovementModal(true);
  };

  const closeMobileSidebar = () => setMobileSidebarOpen(false);

  return (
    <div className="min-h-screen flex bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-100 antialiased">
      {/* Mobile drawer overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={closeMobileSidebar}
          aria-hidden
        />
      )}

      {/* Full-height Sidebar: occupies top to bottom */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 h-screen
          bg-white dark:bg-surface-900
          border-r border-surface-200 dark:border-surface-800
          flex flex-col shadow-sm transition-all duration-200 ease-in-out
          lg:static lg:h-screen lg:shrink-0
          ${
            mobileSidebarOpen
              ? 'translate-x-0 w-64'
              : '-translate-x-full lg:translate-x-0'
          }
          ${
            sidebarCollapsed
              ? 'lg:w-0 lg:overflow-hidden lg:border-r-0'
              : 'lg:w-64'
          }
        `}
      >
        {/* Sidebar Header with Logo and Mobile Close */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-surface-200 dark:border-surface-800 shrink-0">
          <Logo size="md" showText />
          <button
            onClick={closeMobileSidebar}
            className="lg:hidden p-1.5 rounded-lg text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800"
            aria-label="Cerrar menú"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Quick action button */}
        <div className="px-3 py-3">
          <Button
            size="md"
            className="w-full shadow-sm text-xs font-semibold"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              handleAddMovement();
              closeMobileSidebar();
            }}
          >
            {t.nav.addMovement}
          </Button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-5">
          <NavSection items={mainNavItems} onNavigate={closeMobileSidebar} />
          <NavSection title={t.nav.management} items={managementNavItems} onNavigate={closeMobileSidebar} />
        </div>

        {/* Sidebar Footer info */}
        <div className="border-t border-surface-200 dark:border-surface-800 p-3 shrink-0 text-center">
          <p className="text-[11px] text-surface-400 font-mono">Personal Treasury · 2026</p>
        </div>
      </aside>

      {/* Main Workspace (Top Header + Content) */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-14 bg-white/90 dark:bg-surface-900/90 backdrop-blur-md border-b border-surface-200 dark:border-surface-800 px-2.5 sm:px-5 flex items-center justify-between shrink-0">
          {/* Top-left: ONLY Sidebar Toggle button and logo when collapsed */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (window.innerWidth < 1024) {
                  setMobileSidebarOpen(true);
                } else {
                  setSidebarCollapsed(!sidebarCollapsed);
                }
              }}
              className="p-2 rounded-lg text-surface-600 hover:text-surface-900 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800 transition-colors"
              title={sidebarCollapsed ? 'Mostrar barra lateral' : 'Ocultar barra lateral'}
              aria-label="Alternar menú lateral"
            >
              {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <Menu className="h-4 w-4 lg:hidden" />}
              {!sidebarCollapsed && <PanelLeft className="h-4 w-4 hidden lg:block" />}
            </button>

            {sidebarCollapsed && (
              <div className="hidden lg:block ml-1">
                <Logo size="sm" showText={false} />
              </div>
            )}
          </div>

          {/* Top-right: EXACTLY Idioma, Tema, Perfil in order from left to right */}
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5">
            {/* 1. Idioma */}
            <LanguageToggle />

            {/* 2. Tema */}
            <HeaderThemeToggle />

            {/* 3. Perfil */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-700 dark:text-surface-300 transition-colors group"
                title="Mi Perfil"
              >
                <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/50 flex items-center justify-center text-brand-700 dark:text-brand-300 font-bold text-xs shadow-xs">
                  {profile?.display_name ? profile.display_name.charAt(0).toUpperCase() : <User className="h-3.5 w-3.5" />}
                </div>
                <span className="text-xs font-semibold text-surface-900 dark:text-surface-100 hidden sm:inline max-w-[120px] truncate">
                  {profile?.display_name ?? 'Mi tesorería'}
                </span>
                <ChevronDown className={`h-3 w-3 text-surface-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen && (
                <div className="absolute top-full right-0 mt-1.5 w-52 bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl shadow-xl p-1.5 z-50 animate-[slide-down_200ms_cubic-bezier(0.16,1,0.3,1)]">
                  <div className="px-3 py-2 border-b border-surface-100 dark:border-surface-800 mb-1">
                    <p className="text-xs font-bold text-surface-900 dark:text-surface-100 truncate">
                      {profile?.display_name ?? 'Usuario'}
                    </p>
                    <p className="text-[10px] text-surface-400 truncate">{profile?.email}</p>
                  </div>
                  <NavLink
                    to="/profile"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
                  >
                    <User className="h-3.5 w-3.5 text-brand-600" />
                    {t.nav.profile}
                  </NavLink>
                  <button
                    onClick={() => {
                      signOut();
                      setUserMenuOpen(false);
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg w-full text-left transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    {t.nav.logout}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content: spacious and responsive */}
        <main className="flex-1 overflow-y-auto min-w-0">
          <div className="w-full max-w-[1800px] mx-auto px-2 sm:px-5 lg:px-6 py-4">
            <Outlet />
          </div>
        </main>
      </div>

      {showAddMovementModal && (
        <AddMovementModal
          open={showAddMovementModal}
          onOpenChange={setShowAddMovementModal}
          month={currentMonth}
          year={currentYear}
          onSaved={() => {
            window.dispatchEvent(new CustomEvent('excel-data-updated'));
            window.dispatchEvent(new CustomEvent('bank-accounts-updated'));
          }}
        />
      )}
    </div>
  );
}
