import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Button } from '../ui/button';
import {
  Menu,
  X,
  ChevronDown,
  LogIn,
  Grid3X3,
  Briefcase,
  Info,
  UserCheck,
  Compass,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { UserProfileDropdown } from '../auth/UserProfileDropdown';
import { Logo } from './Logo';
import { NavigationMenu, NavigationMenuList } from '../ui/navigation-menu';
import { NavMegaMenu } from './NavMegaMenu';
import {
  serviceItems,
  solutionItems,
  companyItems,
  servicesPanel,
  solutionsPanel,
  companyPanel,
} from './navigationData';

interface NavigationProps {
  /** When true, render the public website nav regardless of auth state */
  forcePublic?: boolean;
}

export function Navigation({ forcePublic = false }: NavigationProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isServicesExpanded, setIsServicesExpanded] = useState(false);
  const [isSolutionsExpanded, setIsSolutionsExpanded] = useState(false);
  const [isCompanyExpanded, setIsCompanyExpanded] = useState(false);
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();

  // When forcePublic is on, treat the user as unauthenticated for layout purposes
  const effectivelyAuthenticated = forcePublic ? false : isAuthenticated;
  const isAdminMode = !forcePublic && (user?.role === 'admin' || user?.role === 'super_admin');

  // Hide navigation items during application phase
  const isInApplicationPhase = effectivelyAuthenticated && user?.applicationStatus === 'incomplete';

  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/resources', label: 'Resources' },
    { path: '/contact', label: 'Contact' },
  ];

  const isActive = (path: string) => location.pathname === path;
  const isServicesActive =
    location.pathname === '/services' ||
    serviceItems.some((item) => item.path === location.pathname);
  const isSolutionsActive = location.pathname.startsWith('/solutions');
  const isCompanyActive = companyItems.some((item) => item.path === location.pathname);

  return (
    <nav className="border-b border-gray-300 bg-white relative" aria-label="Main navigation">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="relative flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <Link to="/" className="flex items-center">
              <Logo />
            </Link>
            {/* Admin Mode Indicator */}
            {isAdminMode && (
              <div className="hidden md:flex items-center space-x-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                <UserCheck className="h-4 w-4" />
                <span>Admin Mode</span>
              </div>
            )}
          </div>

          {/* Desktop Navigation - Centered - Only show public links for logged out users */}
          {!isInApplicationPhase && !effectivelyAuthenticated && (
            <div className="hidden lg:flex items-center space-x-8 flex-1 justify-center">
              {/* Home Link */}
              <Link
                to="/"
                className={`transition-colors text-base font-medium ${
                  isActive('/') ? 'text-primary' : 'text-black hover:text-primary'
                }`}
              >
                Home
              </Link>

              {/* Mega menus — the root/list stay `static` so each panel positions
                  against the navbar row and spans the full content width. The
                  aria-label gives Radix's inner <nav> a unique accessible name so
                  it reads as an intentional, distinct landmark (not a duplicate of
                  the outer "Main navigation"). */}
              <NavigationMenu
                viewport={false}
                aria-label="Services, Solutions and Company"
                className="static max-w-none flex-none"
              >
                <NavigationMenuList className="static space-x-8 gap-0">
                  <NavMegaMenu
                    label="Services"
                    active={isServicesActive}
                    items={serviceItems}
                    panel={servicesPanel}
                  />
                  <NavMegaMenu
                    label="Solutions"
                    active={isSolutionsActive}
                    items={solutionItems}
                    panel={solutionsPanel}
                  />
                  <NavMegaMenu
                    label="Company"
                    active={isCompanyActive}
                    items={companyItems}
                    panel={companyPanel}
                  />
                </NavigationMenuList>
              </NavigationMenu>

              <Link
                to="/ask-vasco"
                className={`transition-colors text-base font-medium flex items-center gap-1.5 ${
                  isActive('/ask-vasco') ? 'text-primary' : 'text-black hover:text-primary'
                }`}
              >
                <Compass className="h-4 w-4" />
                Ask Vasco
              </Link>

              {/* Other Navigation Items */}
              {navItems.slice(1).map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`transition-colors text-base font-medium ${
                    isActive(item.path) ? 'text-primary' : 'text-black hover:text-primary'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="hidden lg:flex items-center gap-3">
            {effectivelyAuthenticated ? (
              <UserProfileDropdown />
            ) : !isInApplicationPhase ? (
              <div className="contents">
                <Button
                  variant="ghost"
                  className="text-black hover:text-primary hover:bg-primary/10 text-base font-medium"
                  asChild
                >
                  <Link to="/login">
                    <LogIn className="h-4 w-4 mr-2" />
                    Log In
                  </Link>
                </Button>
                <Button
                  className="bg-primary hover:bg-primary/90 text-white text-base font-medium pulse-on-hover"
                  asChild
                >
                  <Link to="/signup">Get Started</Link>
                </Button>
              </div>
            ) : null}
          </div>

          {/* Mobile menu button - Only show for logged out users */}
          {!isInApplicationPhase && !effectivelyAuthenticated && (
            <div className="lg:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-black"
                aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={isMenuOpen}
              >
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </div>
          )}
        </div>

        {/* Mobile Navigation - Only show for logged out users */}
        {isMenuOpen && !isInApplicationPhase && !effectivelyAuthenticated && (
          <div className="lg:hidden absolute left-0 right-0 top-full bg-white border-b border-gray-300 shadow-lg z-50 py-4 px-4 sm:px-6">
            <div className="max-w-screen-2xl mx-auto flex flex-col space-y-3">
              {/* Home Link */}
              <Link
                to="/"
                onClick={() => setIsMenuOpen(false)}
                className={`px-2 py-1 transition-colors text-base font-medium ${
                  isActive('/') ? 'text-primary' : 'text-black hover:text-primary'
                }`}
              >
                Home
              </Link>

              {/* Mobile Services Section */}
              <div className="px-2 py-1">
                <button
                  onClick={() => setIsServicesExpanded(!isServicesExpanded)}
                  className="font-medium text-black flex items-center justify-between w-full"
                >
                  <div className="flex items-center space-x-2">
                    <Grid3X3 className="h-4 w-4" />
                    <span>Services</span>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${isServicesExpanded ? 'rotate-180' : ''}`}
                  />
                </button>
                {isServicesExpanded && (
                  <div className="ml-6 mt-2 space-y-2">
                    {serviceItems.map((service) => (
                      <Link
                        key={service.path}
                        to={service.path}
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center space-x-2 text-sm text-black hover:text-primary py-1"
                      >
                        <service.icon className="h-4 w-4" />
                        <span>{service.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Mobile Solutions Section */}
              <div className="px-2 py-1">
                <button
                  onClick={() => setIsSolutionsExpanded(!isSolutionsExpanded)}
                  className="font-medium text-black flex items-center justify-between w-full"
                >
                  <div className="flex items-center space-x-2">
                    <Briefcase className="h-4 w-4" />
                    <span>Solutions</span>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${isSolutionsExpanded ? 'rotate-180' : ''}`}
                  />
                </button>
                {isSolutionsExpanded && (
                  <div className="ml-6 mt-2 space-y-2">
                    {solutionItems.map((solution) => (
                      <Link
                        key={solution.path}
                        to={solution.path}
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center space-x-2 text-sm text-black hover:text-primary py-1"
                      >
                        <solution.icon className="h-4 w-4" />
                        <span>{solution.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Mobile Company Section */}
              <div className="px-2 py-1">
                <button
                  onClick={() => setIsCompanyExpanded(!isCompanyExpanded)}
                  className="font-medium text-black flex items-center justify-between w-full"
                >
                  <div className="flex items-center space-x-2">
                    <Info className="h-4 w-4" />
                    <span>Company</span>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${isCompanyExpanded ? 'rotate-180' : ''}`}
                  />
                </button>
                {isCompanyExpanded && (
                  <div className="ml-6 mt-2 space-y-2">
                    {companyItems.map((company) => (
                      <Link
                        key={company.path}
                        to={company.path}
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center space-x-2 text-sm text-black hover:text-primary py-1"
                      >
                        <company.icon className="h-4 w-4" />
                        <span>{company.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <Link
                to="/ask-vasco"
                onClick={() => setIsMenuOpen(false)}
                className={`px-2 py-1 transition-colors text-base font-medium flex items-center space-x-2 ${
                  isActive('/ask-vasco') ? 'text-primary' : 'text-black hover:text-primary'
                }`}
              >
                <Compass className="h-4 w-4" />
                <span>Ask Vasco</span>
              </Link>

              {/* Other Navigation Items */}
              {navItems.slice(1).map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMenuOpen(false)}
                  className={`px-2 py-1 transition-colors text-base font-medium ${
                    isActive(item.path) ? 'text-primary' : 'text-black hover:text-primary'
                  }`}
                >
                  {item.label}
                </Link>
              ))}

              {/* Mobile Action Buttons */}
              <div className="flex flex-col space-y-3 pt-4 mt-2 border-t border-gray-300 px-2">
                <Button
                  variant="outline"
                  className="w-full text-black border-gray-300 hover:bg-primary/10 hover:border-primary hover:text-primary text-base font-medium justify-center"
                  asChild
                >
                  <Link to="/login" onClick={() => setIsMenuOpen(false)}>
                    <LogIn className="h-4 w-4 mr-2" />
                    Log In
                  </Link>
                </Button>
                <Button
                  className="w-full bg-primary hover:bg-primary/90 text-white text-base font-medium justify-center shadow-md"
                  asChild
                >
                  <Link to="/signup" onClick={() => setIsMenuOpen(false)}>
                    Get Started
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
