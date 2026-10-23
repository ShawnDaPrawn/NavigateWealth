import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '../../../../ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../ui/dropdown-menu';
import { clientApi } from '../api';
import { clientKeys } from '../hooks/queryKeys';
import { resizeAvatarImage } from '../resizeAvatarImage';

/** Photos are resized in the browser first, so this only rejects absurd inputs. */
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const AVATAR_STALE_TIME = 30 * 60 * 1000; // signed URLs live 60 min

interface ClientAvatarProps {
  clientId: string;
  /** Used for the initials fallback and accessible labels. */
  firstName: string;
  lastName: string;
  /** Tailwind size classes, e.g. `h-12 w-12`. */
  className?: string;
  /** Show the upload / remove controls. Display-only when false. */
  editable?: boolean;
  fallbackClassName?: string;
}

/**
 * A client's profile photo, falling back to their initials.
 *
 * Shared by the client drawer header and the overview banner; both read the
 * same query so a change in one shows in the other immediately.
 */
export function ClientAvatar({
  clientId,
  firstName,
  lastName,
  className = 'h-12 w-12',
  editable = false,
  fallbackClassName,
}: ClientAvatarProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: url } = useQuery({
    queryKey: clientKeys.avatar(clientId),
    queryFn: () => clientApi.getClientAvatarUrl(clientId),
    enabled: !!clientId,
    staleTime: AVATAR_STALE_TIME,
    // A missing photo is not worth retrying or surfacing; initials are shown.
    retry: false,
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const resized = await resizeAvatarImage(file);
      return clientApi.uploadClientAvatar(clientId, resized);
    },
    onSuccess: (newUrl) => {
      queryClient.setQueryData(clientKeys.avatar(clientId), newUrl);
      toast.success('Profile photo updated');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Could not update the photo');
    },
  });

  const remove = useMutation({
    mutationFn: () => clientApi.deleteClientAvatar(clientId),
    onSuccess: () => {
      queryClient.setQueryData(clientKeys.avatar(clientId), null);
      toast.success('Profile photo removed');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Could not remove the photo');
    },
  });

  const busy = upload.isPending || remove.isPending;
  const initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so choosing the same file again still fires onChange.
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file');
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      toast.error('That image is too large — please choose one under 20MB');
      return;
    }
    upload.mutate(file);
  };

  const avatar = (
    <Avatar className={className}>
      {url && <AvatarImage src={url} alt={`${firstName} ${lastName}`} className="object-cover" />}
      <AvatarFallback className={fallbackClassName}>{initials}</AvatarFallback>
    </Avatar>
  );

  if (!editable) return avatar;

  const openPicker = () => inputRef.current?.click();

  const triggerClass =
    'relative block rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2';
  const triggerBody = (
    <>
      {avatar}
      <span
        className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white transition-opacity ${
          busy ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
        }`}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
      </span>
    </>
  );

  return (
    <div className="relative group flex-shrink-0">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFile}
        aria-label="Upload profile photo"
      />
      {url ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={busy}
            className={triggerClass}
            aria-label="Change or remove profile photo"
          >
            {triggerBody}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={openPicker}>
              <Camera className="mr-2 h-4 w-4" />
              Change photo
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => remove.mutate()}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove photo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        // With no photo there is nothing to choose between: go straight to the picker.
        <button
          type="button"
          disabled={busy}
          onClick={openPicker}
          className={triggerClass}
          aria-label="Add profile photo"
          title="Add profile photo"
        >
          {triggerBody}
        </button>
      )}
    </div>
  );
}
