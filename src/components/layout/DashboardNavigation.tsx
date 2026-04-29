import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { 
  Home,
  Package,
  Bot,
  MessageSquare,
  PenLine,
  History,
  Briefcase,
  TrendingUp,
  Settings,
  LogOut,
} from 'lucide-react';
import { ACTIVE_THEME, NAV_STYLES } from '../portal/portal-theme';
import { useCommunications } from '../client/communication/hooks/useCommunications';
import { deriveInboxStats } from '../client/communication/utils';
import { Button } from '../ui/button';
import { useAuth } from '../auth/AuthContext';
import { toast } from 'sonner@2.0.3';

export function DashboardNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const styles = NAV_STYLES[ACTIVE_THEME];
  const { logout } = useAuth();
  const { data: communications = [] } = useCommunications();
  const unreadCount = deriveInboxStats(communications).unread;
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  
  const navItems = [
    { 
      path: '/dashboard', 
      label: 'Home', 
      icon: Home 
    },
    { 
      path: '/products-services-dashboard', 
      label: 'Products & Services', 
      icon: Package 
    },
    { 
      path: '/ai-advisor', 
      label: 'Ask Vasco', 
      icon: Bot 
    },
    { 
      path: '/communication', 
      label: 'Communication', 
      icon: MessageSquare 
    },
    { 
      path: '/e-signatures', 
      label: 'E‑Signatures', 
      icon: PenLine 
    },
    { 
      path: '/history', 
      label: 'History', 
      icon: History 
    },
    { 
      path: '/profile', 
      label: 'Settings', 
      icon: Settings 
    },
  ];

  const isActive = (path: string) => {
    // Settings group: highlight for /profile, /security
    if (path === '/profile') {
      return ['/profile', '/security'].includes(location.pathname);
    }
    return location.pathname === path;
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;

    try {
      setIsLoggingOut(true);
      await logout();
      toast.success('You have been successfully logged out');
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Dashboard logout error:', error);
      toast.error('Failed to log out. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const mobileLogoutButtonClass =
    ACTIVE_THEME === 'branded'
      ? 'border-white/10 text-white/70 hover:text-white hover:bg-white/10'
      : 'border-gray-200 text-gray-600 hover:text-red-600 hover:bg-red-50';

  return (
    <nav className={styles.wrapper} aria-label="Dashboard navigation">
      <div className={styles.container}>
        <div className="flex items-center gap-2">
          <div className="flex flex-1 space-x-1 md:space-x-2 overflow-x-auto scrollbar-hide">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`${styles.linkBase} ${
                  isActive(item.path)
                    ? styles.linkActive
                    : styles.linkInactive
                }`}
                aria-current={isActive(item.path) ? 'page' : undefined}
              >
                <item.icon className={styles.iconClass} />
                <span className={styles.labelClass}>{item.label}</span>
                {item.path === '/communication' && unreadCount > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[10px] font-bold rounded-full bg-purple-600 text-white leading-none">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className={`md:hidden shrink-0 ${mobileLogoutButtonClass}`}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
            <span className="ml-2">Logout</span>
          </Button>
        </div>
      </div>
    </nav>
  );
}
