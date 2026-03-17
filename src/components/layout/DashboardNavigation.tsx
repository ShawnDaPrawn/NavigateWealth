import React from 'react';
import { Link, useLocation } from 'react-router';
import { 
  Home,
  Package,
  Bot,
  MessageSquare,
  History,
  Briefcase,
  TrendingUp,
  Settings,
} from 'lucide-react';
import { ACTIVE_THEME, NAV_STYLES } from '../portal/portal-theme';
import { useCommunications } from '../client/communication/hooks/useCommunications';
import { deriveInboxStats } from '../client/communication/utils';

export function DashboardNavigation() {
  const location = useLocation();
  const styles = NAV_STYLES[ACTIVE_THEME];
  const { data: communications = [] } = useCommunications();
  const unreadCount = deriveInboxStats(communications).unread;
  
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

  return (
    <nav className={styles.wrapper} aria-label="Dashboard navigation">
      <div className={styles.container}>
        <div className="flex space-x-1 md:space-x-2 overflow-x-auto scrollbar-hide">
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
      </div>
    </nav>
  );
}