import { useCurrentUserPermissions } from '../personnel';
import { SocialMediaTab } from './SocialMediaTab';
import { SocialMediaSkeleton } from './components/SocialMediaSkeleton';
import { NoAccess } from '../../layout/page';

/**
 * Social & Marketing: one row of tabs (Assets, Weekly pipeline, Calendar,
 * Compose, AI generator, Channels, Link in bio). Publications used to be a tab
 * here as well; it now lives only in the Publications module.
 */
export function SocialMediaModule() {
  const { can, isLoading } = useCurrentUserPermissions();

  if (isLoading) {
    return <SocialMediaSkeleton />;
  }

  if (!can('marketing')) {
    return (
      <div className="p-6 lg:p-8">
        <NoAccess what="Social & Marketing" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <SocialMediaTab />
    </div>
  );
}
