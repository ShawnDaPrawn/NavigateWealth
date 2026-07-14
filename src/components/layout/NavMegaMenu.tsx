import { Link } from 'react-router';
import { ArrowRight, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
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
 * Desktop/tablet mega-menu panel for the public navbar: a large dropdown with
 * an image column on the left, a vertical divider, and a grid of tile-style
 * links (icon + label + short description) on the right.
 */
export function NavMegaMenu({ label, active, items, panel }: NavMegaMenuProps) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className={`group flex items-center space-x-1 transition-colors text-base font-medium ${
          active ? 'text-primary' : 'text-black hover:text-primary'
        }`}
      >
        <span>{label}</span>
        <ChevronDown className="h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        sideOffset={12}
        collisionPadding={16}
        className={cn(
          'p-0 rounded-2xl border-2 border-gray-100 bg-white/95 backdrop-blur-md shadow-2xl ring-1 ring-black/5 max-h-[calc(100vh-5rem)] animate-menu-pop',
          panel.panelClassName,
        )}
      >
        <div className="flex items-stretch">
          {/* Image column */}
          <div className={cn('relative shrink-0 self-stretch bg-gray-100', panel.imageClassName)}>
            <picture>
              <source
                type="image/avif"
                srcSet={`${getOptimizedImageUrl(panel.image.key, 480, 'avif')} 480w, ${getOptimizedImageUrl(panel.image.key, 768, 'avif')} 768w`}
                sizes="280px"
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
                <DropdownMenuItem asChild className="p-0">
                  <Link
                    to={panel.cta.to}
                    className="mt-1 flex w-fit cursor-pointer items-center gap-1 rounded-md text-sm font-medium text-white bg-transparent hover:underline focus:bg-transparent focus:text-white focus:underline data-[highlighted]:bg-transparent data-[highlighted]:text-white data-[highlighted]:underline"
                  >
                    <span>{panel.cta.label}</span>
                    <ArrowRight className="size-3.5 text-current" />
                  </Link>
                </DropdownMenuItem>
              )}
            </div>
          </div>

          {/* Tile grid, separated from the image by a vertical divider */}
          <div
            className={cn('grid flex-1 gap-2 border-l border-gray-200/80 p-4', panel.gridClassName)}
          >
            {items.map((item) => (
              <DropdownMenuItem key={item.path} asChild className="p-0">
                <Link
                  to={item.path}
                  className="group flex h-full cursor-pointer flex-col items-start gap-2 rounded-xl p-3 transition-all duration-200 hover:bg-primary hover:text-white hover:shadow-md hover:-translate-y-0.5 focus:bg-primary focus:text-white data-[highlighted]:bg-primary data-[highlighted]:text-white"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors duration-200 group-hover:bg-white/20 group-hover:text-white group-focus:bg-white/20 group-focus:text-white group-data-[highlighted]:bg-white/20 group-data-[highlighted]:text-white">
                    <item.icon className="size-4 text-current" />
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="text-sm font-semibold break-words text-gray-900 group-hover:text-white group-focus:text-white group-data-[highlighted]:text-white">
                      {item.label}
                    </span>
                    <span className="text-xs leading-snug text-gray-500 line-clamp-2 group-hover:text-white/85 group-focus:text-white/85 group-data-[highlighted]:text-white/85">
                      {item.description}
                    </span>
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
