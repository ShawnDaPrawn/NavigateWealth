import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import {
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuTrigger,
} from '../ui/navigation-menu';
import { cn } from '../ui/utils';
import { getOptimizedImageUrl } from '../../utils/optimizedImages';
import type { MegaPanelConfig, NavMenuItem } from './navigationData';

interface NavMegaMenuProps {
  label: string;
  active: boolean;
  items: NavMenuItem[];
  panel: MegaPanelConfig;
}

/**
 * Desktop/tablet mega-menu panel for the public navbar: a full-content-width
 * dropdown with an image column on the left, a vertical divider, and a grid of
 * tile-style links (icon + label + short description) on the right.
 *
 * The panel is absolutely positioned against the navbar row (the nearest
 * positioned ancestor — the NavigationMenu root/list/item are all `static`),
 * so it spans exactly the page content width and opens flush below the navbar
 * instead of overlapping it.
 */
export function NavMegaMenu({ label, active, items, panel }: NavMegaMenuProps) {
  return (
    <NavigationMenuItem className="static">
      <NavigationMenuTrigger
        className={`h-auto rounded-none bg-transparent p-0 text-base font-medium transition-colors hover:bg-transparent focus:bg-transparent data-[state=open]:bg-transparent data-[state=open]:hover:bg-transparent data-[state=open]:focus:bg-transparent [&_svg]:size-4 ${
          active
            ? 'text-primary hover:text-primary focus:text-primary data-[state=open]:text-primary'
            : 'text-black hover:text-primary focus:text-primary data-[state=open]:text-primary'
        }`}
      >
        {label}
      </NavigationMenuTrigger>
      {/* The `!` utilities out-rank the wrapper's viewport=false variant styles
          (bg-popover, rounded-md, border, shadow, mt-1.5), which otherwise win
          on specificity. */}
      <NavigationMenuContent className="absolute inset-x-0 top-full z-50 mt-px! w-auto overflow-hidden overflow-y-auto rounded-2xl! border-2! border-gray-100! bg-white/95! p-0 shadow-2xl! ring-1 ring-black/5 backdrop-blur-md animate-menu-pop max-h-[calc(100vh-8rem)]">
        <div className="flex items-stretch">
          {/* Image column */}
          <div className={cn('relative shrink-0 self-stretch bg-gray-100', panel.imageClassName)}>
            <picture>
              <source
                type="image/avif"
                srcSet={`${getOptimizedImageUrl(panel.image.key, 480, 'avif')} 480w, ${getOptimizedImageUrl(panel.image.key, 768, 'avif')} 768w`}
                sizes="300px"
              />
              <img
                src={getOptimizedImageUrl(panel.image.key, 768, 'webp')}
                alt={panel.image.alt}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </picture>
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-4">
              <p className="text-lg font-semibold text-white">{panel.heading}</p>
              <p className="text-sm text-white/80">{panel.tagline}</p>
              {panel.cta && (
                <NavigationMenuLink asChild>
                  <Link
                    to={panel.cta.to}
                    className="mt-1 flex w-fit cursor-pointer flex-row items-center gap-1 rounded-md bg-transparent p-0 text-sm font-medium text-white hover:bg-transparent hover:text-white hover:underline focus:bg-transparent focus:text-white focus:underline"
                  >
                    <span>{panel.cta.label}</span>
                    <ArrowRight className="size-3.5 text-current" />
                  </Link>
                </NavigationMenuLink>
              )}
            </div>
          </div>

          {/* Tile grid, separated from the image by a vertical divider */}
          <div
            className={cn('grid flex-1 gap-2 border-l border-gray-200/80 p-4', panel.gridClassName)}
          >
            {items.map((item) => (
              <NavigationMenuLink key={item.path} asChild>
                <Link
                  to={item.path}
                  className="group/tile flex h-full cursor-pointer flex-col items-start gap-2 rounded-xl p-3 transition-all duration-200 hover:bg-primary hover:text-white hover:shadow-md hover:-translate-y-0.5 focus:bg-primary focus:text-white"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors duration-200 group-hover/tile:bg-white/20 group-hover/tile:text-white group-focus/tile:bg-white/20 group-focus/tile:text-white">
                    <item.icon className="size-4 text-current" />
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="text-sm font-semibold break-words text-gray-900 group-hover/tile:text-white group-focus/tile:text-white">
                      {item.label}
                    </span>
                    <span className="text-xs leading-snug text-gray-500 line-clamp-2 group-hover/tile:text-white/85 group-focus/tile:text-white/85">
                      {item.description}
                    </span>
                  </span>
                </Link>
              </NavigationMenuLink>
            ))}
          </div>
        </div>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
}
