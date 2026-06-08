import { ElementType } from 'react';
import {
  Package,
  Info,
  ExternalLink,
  HeartPulse,
  Stethoscope,
  PiggyBank,
  TrendingUp,
  ShieldCheck,
  ShieldPlus,
  Home,
  Car,
  GraduationCap,
  Wallet,
  FileText,
  Landmark,
} from 'lucide-react';
import { Badge } from '../../../../../ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../../../../ui/tooltip';
import { EXTERNAL_PRODUCT_CATEGORIES } from '../../constants';
import { ReviewSection } from './shared';

const PRODUCT_ICON_MAP: Record<string, ElementType> = {
  'heart-pulse': HeartPulse,
  stethoscope: Stethoscope,
  'piggy-bank': PiggyBank,
  'trending-up': TrendingUp,
  'shield-check': ShieldCheck,
  'shield-plus': ShieldPlus,
  home: Home,
  car: Car,
  'graduation-cap': GraduationCap,
  wallet: Wallet,
  'file-text': FileText,
  landmark: Landmark,
};

interface ExternalProductsSectionProps {
  existingProducts: string[];
  existingProductProviders: Record<string, string>;
}

export function ExternalProductsSection({
  existingProducts,
  existingProductProviders,
}: ExternalProductsSectionProps) {
  if (existingProducts.length === 0) return null;

  return (
    <ReviewSection
      icon={Package}
      title="External Financial Products"
      badge={
        <Badge
          variant="outline"
          className="text-[10px] font-medium bg-orange-50 text-orange-700 border-orange-200 ml-2"
        >
          {existingProducts.length} product{existingProducts.length !== 1 ? 's' : ''}
        </Badge>
      }
      actions={
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 text-[10px] text-gray-400 cursor-help">
                <Info className="h-3 w-3" />
                <span>Informational only</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="text-xs max-w-[260px]">
              These products are held at external providers. They do not link to the client profile
              but indicate where to look for existing cover.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {existingProducts.map((product) => {
          const category = EXTERNAL_PRODUCT_CATEGORIES.find(
            (c) => c.label === product || c.id === product,
          );
          const IconComponent = category ? PRODUCT_ICON_MAP[category.icon] || Package : Package;
          return (
            <div
              key={product}
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gradient-to-r from-orange-50/40 to-white hover:border-orange-200/60 transition-colors"
            >
              <div className="h-8 w-8 rounded-lg bg-orange-100/80 flex items-center justify-center shrink-0">
                <IconComponent className="h-4 w-4 text-orange-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{product}</p>
                {existingProductProviders[product] ? (
                  <p className="text-[10px] text-orange-600 font-medium truncate">
                    {existingProductProviders[product]}
                  </p>
                ) : category ? (
                  <p className="text-[10px] text-gray-400 truncate">{category.description}</p>
                ) : null}
              </div>
              <ExternalLink className="h-3 w-3 text-gray-300 shrink-0 ml-auto" />
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-gray-400 mt-3 flex items-center gap-1.5">
        <Info className="h-3 w-3 shrink-0" />
        These products are held at external providers and serve as reference for the adviser. They
        are not linked to the client profile.
      </p>
    </ReviewSection>
  );
}
