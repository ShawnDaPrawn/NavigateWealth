import { useEffect, useState } from 'react';
import { listStaff, type StaffMember } from './vaultApi';

/** The staff list for picking a person; empty when it cannot be loaded. */
export function useStaff(): StaffMember[] {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  useEffect(() => {
    let active = true;
    listStaff()
      .then((rows) => {
        if (active) setStaff(rows);
      })
      .catch(() => {
        /* Free text is the fallback. */
      });
    return () => {
      active = false;
    };
  }, []);
  return staff;
}
