/**
 * Paginate Supabase Auth admin.listUsers — a single call only returns one page (default ~50).
 */

const PER_PAGE = 1000;

type ListUsersClient = {
  auth: {
    admin: {
      listUsers: (opts?: { page?: number; perPage?: number }) => Promise<{
        data: { users: unknown[] };
        error: unknown;
      }>;
    };
  };
};

export async function listAllAuthUsers(supabase: ListUsersClient): Promise<unknown[]> {
  const merged: unknown[] = [];
  let page = 1;

  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: PER_PAGE,
    });

    if (error) throw error;

    const batch = data?.users ?? [];
    merged.push(...batch);
    if (batch.length < PER_PAGE) break;
    page += 1;
  }

  return merged;
}
