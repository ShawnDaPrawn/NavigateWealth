/**
 * Profile Routes
 * Handles user profile operations including creation, retrieval, and updates
 */

import { Hono } from "npm:hono";
import { ZipWriter, Uint8ArrayWriter, Uint8ArrayReader } from "npm:@zip.js/zip.js";
import { sendEmail } from './email-service.ts';
import * as kv from './kv_store.tsx';
import { SUPER_ADMIN_EMAIL, PERSONNEL_ROLES } from './constants.ts';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { asyncHandler } from './error.middleware.ts';
import {
  UpdateSuperAdminProfileSchema,
  PersonalInfoQuerySchema,
  PersonalInfoUpdateSchema,
  AlternativeProfileUpdateSchema,
  CreateDefaultProfileSchema,
} from './client-management-validation.ts';
import {
  syncProfileToApplication,
  extractUserIdFromProfileKey,
} from './profile-application-sync.ts';

const router = new Hono();
const log = createModuleLogger('profile-routes');

/**
 * Create Supabase service client
 */
function createServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

/**
 * Recursively sanitizes an object to remove large Base64 strings
 * This prevents 500 errors when saving to KV store
 */
function deepSanitize(obj: unknown): unknown {
  if (obj === undefined || obj === null) return obj;
  
  // Handle primitive types
  if (typeof obj !== 'object') return obj;
  
  // Handle Date objects (preserve them)
  if (obj instanceof Date) return obj;

  // Handle Arrays
  if (Array.isArray(obj)) {
    return obj.map(item => deepSanitize(item));
  }

  // Handle Objects
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    // Check strings for large content
    if (typeof value === 'string') {
      // Allow known URL/path keys to be long
      if (key === 'fileUrl' || key === 'path' || key === 'url' || key === 'href') {
        // CRITICAL SECURITY FIX: Never allow data: URIs even in these allowed fields
        if (value.startsWith('data:')) {
           continue;
        }
        cleaned[key] = value;
        continue;
      }
      
      // Check for Base64 or excessive length (5KB limit)
      if (value.startsWith('data:') || value.length > 5000) {
        // Skip this property (effectively deleting it)
        continue;
      }
      
      cleaned[key] = value;
    } else {
      // Recursively sanitize other values
      cleaned[key] = deepSanitize(value);
    }
  }
  
  return cleaned;
}

/**
 * Determine whether a Supabase Auth user is a personnel (staff) account.
 * Checks user_metadata.role against PERSONNEL_ROLES and the `invited` flag
 * set by the personnel invite flow.  Also cross-checks the KV personnel
 * profile prefix as a belt-and-suspenders guard.
 *
 * Returns `true` if the user should be excluded from Client Management.
 */
function isPersonnelUser(
  user: { user_metadata?: Record<string, unknown>; id: string },
  personnelIds: Set<string>,
): boolean {
  // 1. Check user_metadata.role — set during personnel invite
  const metaRole = user.user_metadata?.role as string | undefined;
  if (metaRole && (PERSONNEL_ROLES as readonly string[]).includes(metaRole)) {
    return true;
  }

  // 2. Check user_metadata.invited — personnel invite flag
  if (user.user_metadata?.invited === true) {
    return true;
  }

  // 3. Check against the pre-fetched personnel profile IDs
  if (personnelIds.has(user.id)) {
    return true;
  }

  return false;
}

/**
 * GET /super-admin
 * Get the super admin profile
 */
router.get("/super-admin", async (c) => {
  try {
    log.info('Fetching super admin profile');
    
    const supabase = createServiceClient();
    
    // Get all users and find super admin by email
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      log.error('Error fetching users from Supabase Auth', error);
      return c.json({ error: 'Failed to fetch users' }, 500);
    }
    
    const superAdminUser = users?.find(u => 
      u.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
    );
    
    if (!superAdminUser) {
      log.warn('Super admin user not found', { email: SUPER_ADMIN_EMAIL });
      return c.json({ error: 'Super admin not found' }, 404);
    }
    
    // Get profile from KV store
    const profileKey = `user_profile:${superAdminUser.id}:personal_info`;
    let profile = await kv.get(profileKey);
    
    // If profile doesn't exist, create default super admin profile
    if (!profile) {
      log.info('Creating default super admin profile', { userId: superAdminUser.id });
      
      const nameParts = (superAdminUser.user_metadata?.name || '').split(/\s+/);
      profile = {
        userId: superAdminUser.id,
        email: superAdminUser.email,
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        phone: '',
        role: 'super_admin',
        applicationStatus: 'not_started',
        accountStatus: 'approved',
        adviserAssigned: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await kv.set(profileKey, profile);
    } else {
      // Ensure role is super_admin
      if (profile.role !== 'super_admin') {
        profile.role = 'super_admin';
        profile.accountStatus = 'approved';
        profile.adviserAssigned = true;
        await kv.set(profileKey, profile);
      }
      
      // Add userId and email if missing
      profile.userId = superAdminUser.id;
      profile.email = superAdminUser.email;
    }
    
    log.success('Super admin profile retrieved', { userId: superAdminUser.id });
    
    return c.json({ 
      success: true, 
      profile 
    });
    
  } catch (error) {
    log.error('Error fetching super admin profile', error);
    return c.json({ 
      error: 'Failed to fetch super admin profile',
      details: getErrMsg(error)
    }, 500);
  }
});

/**
 * PUT /super-admin
 * Update the super admin profile
 */
router.put("/super-admin", asyncHandler(async (c) => {
  const body = await c.req.json();
  
  // Validate input
  const updates = UpdateSuperAdminProfileSchema.parse(body);
  
  log.info('Updating super admin profile');
  
  const supabase = createServiceClient();
  
  // Get all users and find super admin by email
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    log.error('Error fetching users from Supabase Auth', error);
    return c.json({ error: 'Failed to fetch users' }, 500);
  }
  
  const superAdminUser = users?.find(u => 
    u.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
  );
  
  if (!superAdminUser) {
    log.warn('Super admin user not found', { email: SUPER_ADMIN_EMAIL });
    return c.json({ error: 'Super admin not found' }, 404);
  }
  
  // Update profile in KV store
  const profileKey = `user_profile:${superAdminUser.id}:personal_info`;
  const existingProfile = await kv.get(profileKey) || {};
  
  let updatedProfile = {
    ...existingProfile,
    ...updates,
    userId: superAdminUser.id,
    email: superAdminUser.email,
    role: 'super_admin', // Always enforce super admin role
    updatedAt: new Date().toISOString()
  };
  
  // Sanitize potentially large fields
  try {
    const sanitized = deepSanitize(updatedProfile);
    if (sanitized) updatedProfile = sanitized;
  } catch (e) {
    log.error('Sanitization failed for super admin update', e);
  }

  await kv.set(profileKey, updatedProfile);
  
  log.success('Super admin profile updated', { userId: superAdminUser.id });
  
  return c.json({ 
    success: true, 
    profile: updatedProfile 
  });
}));

/**
 * GET /all-users
 * Get all users with their profiles (for admin use)
 * Includes deleted, suspended, and accountStatus fields for admin filtering.
 */
router.get("/all-users", async (c) => {
  try {
    log.info('Fetching all users');
    
    const supabase = createServiceClient();
    
    // Pagination query params (optional — omit for full list)
    const pageParam = c.req.query('page');
    const perPageParam = c.req.query('perPage');
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : null;
    const perPage = perPageParam ? Math.min(100, Math.max(1, parseInt(perPageParam, 10) || 50)) : null;

    // Get all users from Supabase Auth
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      log.error('Error fetching users from Supabase Auth', error);
      return c.json({ error: 'Failed to fetch users' }, 500);
    }
    
    if (!users || users.length === 0) {
      log.info('No users found');
      return c.json({ success: true, users: [] });
    }
    
    // ── Personnel exclusion ────────────────────────────────────────────
    // Batch-fetch all personnel profile IDs so we can cross-reference.
    // This covers cases where user_metadata may not yet have a role
    // (e.g. a personnel record bootstrapped by the super admin auto-create).
    const personnelProfiles = await kv.getByPrefix('personnel:profile:');
    const personnelIds = new Set<string>(
      personnelProfiles.map((p: Record<string, unknown>) => p.id as string).filter(Boolean)
    );
    
    // Get profiles AND security entries for all users from KV store
    const usersWithProfiles = await Promise.all(
      users
        .filter(user => !isPersonnelUser(user, personnelIds))
        .map(async (user) => {
        const profileKey = `user_profile:${user.id}:personal_info`;
        const [profile, security] = await Promise.all([
          kv.get(profileKey),
          kv.get(`security:${user.id}`)
        ]);
        
        return {
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          user_metadata: user.user_metadata,
          profile: profile || null,
          // Add derived fields for compatibility
          name: user.user_metadata?.name || 
                (profile?.firstName && profile?.lastName 
                  ? `${profile.firstName} ${profile.lastName}` 
                  : ''),
          application_number: profile?.applicationNumber || null,
          application_status: profile?.applicationStatus || 'not_started',
          account_type: profile?.accountType || null,
          // Status fields for admin filtering and display
          deleted: security?.deleted || false,
          suspended: security?.suspended || false,
          account_status: profile?.accountStatus || null,
        };
      })
    );
    
    log.success('Clients retrieved (personnel excluded)', {
      totalAuthUsers: users.length,
      personnelExcluded: users.length - usersWithProfiles.length,
      clientsReturned: usersWithProfiles.length,
    });
    
    // Apply server-side pagination if params provided
    if (page !== null && perPage !== null) {
      const total = usersWithProfiles.length;
      const totalPages = Math.ceil(total / perPage);
      const offset = (page - 1) * perPage;
      const paginatedUsers = usersWithProfiles.slice(offset, offset + perPage);

      return c.json({
        success: true,
        users: paginatedUsers,
        total,
        page,
        perPage,
        totalPages,
      });
    }

    // Unpaginated (backward compat)
    return c.json({ 
      success: true, 
      users: usersWithProfiles 
    });
    
  } catch (error) {
    log.error('Error fetching all users', error);
    return c.json({ 
      error: 'Failed to fetch users',
      details: getErrMsg(error)
    }, 500);
  }
});

/**
 * PUT /users/:userId/metadata
 * Update a client's Supabase Auth user_metadata.
 *
 * §4.2 — Route handler is a thin dispatcher; delegates to Supabase Admin API.
 * §12.2 — Only accessible by authenticated admins.
 *
 * Body: { metadata: Record<string, unknown> }
 * Merges the provided fields into the user's existing user_metadata.
 */
router.put("/users/:userId/metadata", asyncHandler(async (c) => {
  const { userId } = c.req.param();
  if (!userId) {
    return c.json({ error: 'Missing userId parameter' }, 400);
  }

  const body = await c.req.json();
  const metadata = body?.metadata;
  if (!metadata || typeof metadata !== 'object') {
    return c.json({ error: 'Request body must include a `metadata` object' }, 400);
  }

  log.info('Updating user metadata', { userId, fields: Object.keys(metadata) });

  const supabase = createServiceClient();

  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: metadata,
  });

  if (error) {
    log.error('Failed to update user metadata', error, { userId });
    return c.json({
      error: 'Failed to update user metadata',
      details: getErrMsg(error),
    }, 500);
  }

  log.success('User metadata updated', { userId });

  return c.json({ success: true, user: { id: data.user.id, user_metadata: data.user.user_metadata } });
}));

/**
 * GET /personal-info
 * Retrieve user profile from KV store
 */
router.get("/personal-info", asyncHandler(async (c) => {
  const query = c.req.query();
  
  // Validate query parameters
  const { key, email } = PersonalInfoQuerySchema.parse(query);

  log.info('Fetching profile', { key, email });
  
  // Get profile from KV store
  let profile = await kv.get(key);
  
  // Check if super admin by email
  const isSuperAdmin = email && email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  
  // If profile exists, ensure super admin has correct role
  if (profile) {
    if (isSuperAdmin && profile.role !== 'super_admin') {
      log.info('Upgrading super admin role', { email });
      profile.role = 'super_admin';
      profile.accountStatus = 'approved';
      profile.adviserAssigned = true;
      await kv.set(key, profile);
    }
    
    log.success('Profile retrieved', { 
      role: profile.role, 
      email,
      isSuperAdmin 
    });
    
    return c.json({ 
      success: true, 
      data: profile 
    });
  }
  
  // Profile not found
  log.warn('Profile not found', { key });
  return c.json({ error: 'Profile not found' }, 404);
}));

/**
 * POST /personal-info
 * Update user profile in KV store
 */
router.post("/personal-info", asyncHandler(async (c) => {
  let body;
  try {
    log.info('=== POST /personal-info START ===');
    
    // Safety: Catch body parsing errors
    try {
      body = await c.req.json();
    } catch (parseError) {
      log.error('Failed to parse request body', parseError);
      return c.json({
        error: 'Request Payload Too Large',
        message: 'The data being saved is too large for the server to process.',
        code: 'PAYLOAD_TOO_LARGE'
      }, 413);
    }
    
    // Validate input
    let validated;
    try {
      validated = PersonalInfoUpdateSchema.parse(body);
    } catch (zodError: unknown) {
      const ze = zodError as { errors?: Array<{ message?: string }> };
      log.error('Validation Error', zodError);
      return c.json({
        error: `VALIDATION_ERROR: ${ze.errors?.[0]?.message || 'Invalid Request Data'}`,
        details: ze.errors
      }, 400);
    }
    const { key, data } = validated;

    if (!key || !key.includes('user_profile')) {
      log.warn('Suspicious Key Format', { key });
    }

    const incomingData = data as Record<string, unknown>;
    const keys = Object.keys(incomingData);
    
    // Heuristic: Is this a full replacement?
    const hasCoreFields = keys.includes('firstName') && keys.includes('lastName') && keys.includes('email');
    const isBigPayload = keys.length > 5;
    const isFullProfileReplacement = hasCoreFields || isBigPayload;

    log.info('Analyzing update type', { 
      isFullProfileReplacement, 
      keyCount: keys.length
    });
    
    let finalProfile = {};

    if (isFullProfileReplacement) {
      log.info('Full profile replacement detected. Deleting existing record first.', { key });
      
      // Delete the old record first (clean slate)
      try {
        await kv.del(key);
      } catch (delError) {
        log.error('Failed to delete existing record (non-fatal)', delError);
      }
      
      finalProfile = {
        ...data,
        updatedAt: new Date().toISOString()
      };
      
    } else {
      // Partial Patch Logic
      log.info('Partial patch detected. Merging...');
      try {
        const existing = await kv.get(key) || {};
        finalProfile = { ...existing, ...data, updatedAt: new Date().toISOString() };
      } catch (readError) {
        log.error('Failed to read profile for PATCH.', readError);
        throw new Error('Database error. Please refresh the page.');
      }
    }
    
    // Sanitize
    try {
      const sanitized = deepSanitize(finalProfile);
      if (sanitized) {
        finalProfile = sanitized;
      }
    } catch (sanitizationError) {
      log.error('Deep sanitize failed on server', sanitizationError);
      throw new Error('Sanitization failed');
    }
    
    // Save to KV store
    try {
      await kv.set(key, finalProfile);
    } catch (setError) {
      log.error('KV Write Failed', setError);
      throw new Error(`KV Write Failed: ${setError instanceof Error ? setError.message : String(setError)}`);
    }
    
    log.success('Profile updated successfully', { key });
    
    // ── Phase 1: Profile → Application sync ──────────────────────────────
    // If this client has a syncable (pre-approval) application, push changed
    // fields into application_data so both records stay consistent.
    // Non-blocking — sync failure must not break the profile save response.
    const userId = extractUserIdFromProfileKey(key);
    if (userId) {
      syncProfileToApplication(
        userId,
        finalProfile as Record<string, unknown>,
      ).then(result => {
        if (result.synced) {
          log.info('Profile → Application sync triggered', {
            userId,
            fieldsUpdated: result.fieldsUpdated,
          });
        }
      }).catch(syncErr => {
        log.error('Profile → Application background sync error', syncErr);
      });
    }

    return c.json({ 
      success: true, 
      data: finalProfile 
    });
  } catch (error) {
    log.error('Error in POST /personal-info', error);
    
    return c.json({ 
      error: 'Server Error',
      message: `BACKEND_ERROR: ${getErrMsg(error)}`,
      code: 'INTERNAL_ERROR',
      details: error instanceof Error ? error.stack : undefined
    }, 500);
  }
}));

/**
 * PUT /
 * Alternative update endpoint (for backward compatibility)
 */
router.put("/", asyncHandler(async (c) => {
  const body = await c.req.json();
  
  // Validate input
  const validated = AlternativeProfileUpdateSchema.parse(body);
  const { userId, ...updates } = validated;

  const key = `user_profile:${userId}:personal_info`;
  
  log.info('Updating profile (PUT)', { key });
  
  // Get existing profile
  const existingProfile = await kv.get(key) || {};
  
  // Merge updates (handle legacy 'surname' field)
  let updatedProfile = {
    ...existingProfile,
    ...updates,
    lastName: updates.lastName || (updates as Record<string, unknown>).surname || existingProfile.lastName,
    updatedAt: new Date().toISOString()
  };
  
  // Sanitize potentially large fields
  try {
     const sanitized = deepSanitize(updatedProfile);
     if (sanitized) updatedProfile = sanitized;
  } catch (e) {
     log.error('Sanitization failed for legacy update', e);
  }

  await kv.set(key, updatedProfile);
  
  log.success('Profile updated (PUT)', { key });
  
  return c.json({ 
    success: true, 
    data: updatedProfile 
  });
}));

/**
 * POST /create-default
 * Create a default profile for a new user
 */
router.post("/create-default", asyncHandler(async (c) => {
  const body = await c.req.json();
  
  // Validate input
  const { userId, email, displayName } = CreateDefaultProfileSchema.parse(body);

  const key = `user_profile:${userId}:personal_info`;
  
  log.info('Creating default profile', { userId, email });
  
  // Check if profile already exists
  const existingProfile = await kv.get(key);
  
  if (existingProfile) {
    log.info('Profile already exists', { userId });
    return c.json({ 
      success: true, 
      message: 'Profile already exists',
      data: existingProfile 
    });
  }
  
  // ── Personnel guard (Change B) ──────────────────────────────────────
  // If this user already has a personnel:profile: entry, they are staff.
  // Do NOT create a client-type user_profile entry — return a minimal
  // response instead so the frontend doesn't break.
  const personnelProfile = await kv.get(`personnel:profile:${userId}`);
  if (personnelProfile) {
    log.info('User is personnel — skipping client profile creation', { userId });
    return c.json({
      success: true,
      message: 'Personnel account — no client profile created',
      data: {
        userId,
        email,
        role: personnelProfile.role || 'admin',
        accountStatus: 'approved',
        isPersonnel: true,
      },
    });
  }

  // Determine role based on email
  const isSuperAdmin = email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  const role = isSuperAdmin ? 'super_admin' : 'client';
  
  // Parse display name
  const nameParts = displayName.trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const surname = nameParts.slice(1).join(' ') || '';
  
  // Create default profile
  const defaultProfile = {
    firstName,
    surname,
    email,
    role,
    accountStatus: isSuperAdmin ? 'approved' : 'pending',
    accountType: undefined,
    applicationStatus: 'not_started',
    adviserAssigned: isSuperAdmin,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // Save to KV store
  await kv.set(key, defaultProfile);
  
  log.success('Default profile created', { 
    userId, 
    role,
    isSuperAdmin 
  });
  
  return c.json({ 
    success: true, 
    message: 'Profile created',
    data: defaultProfile 
  });
}));

/**
 * POST /upload
 * Upload a document to Supabase Storage
 */
router.post("/upload", async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body['file'];
    const userId = body['userId']; // Optional, for folder structure
    
    if (!file || !(file instanceof File)) {
      return c.json({ error: 'No file uploaded' }, 400);
    }
    
    // Create Supabase client
    const supabase = createServiceClient();
    const bucketName = 'make-91ed8379-client-documents';
    
    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === bucketName);
    
    if (!bucketExists) {
      await supabase.storage.createBucket(bucketName, {
        public: false,
        fileSizeLimit: 6 * 1024 * 1024, // 6MB
        allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
      });
    }
    
    // Generate safe filename
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = userId 
      ? `${userId}/${timestamp}_${safeName}`
      : `temp/${timestamp}_${safeName}`;
      
    // Upload file
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(path, file, {
        contentType: file.type,
        upsert: false
      });
      
    if (error) {
      log.error('Upload failed', error);
      return c.json({ error: error.message }, 500);
    }
    
    // Return the path (not Signed URL yet, frontend requests it when needed)
    return c.json({
      success: true,
      path: data.path,
      fileName: file.name
    });
    
  } catch (error) {
    log.error('Error in POST /upload', error);
    return c.json({ 
      error: 'Upload failed',
      details: getErrMsg(error)
    }, 500);
  }
});

/**
 * POST /send-documents
 * Send encrypted documents to client via email
 */
router.post("/send-documents", async (c) => {
  try {
    const body = await c.req.json();
    const { userId } = body;
    
    if (!userId) {
      return c.json({ error: 'User ID is required' }, 400);
    }
    
    log.info('Sending documents for user', { userId });
    
    const supabase = createServiceClient();
    
    // Fetch profile to get ID number (password) and email
    const profileKey = `user_profile:${userId}:personal_info`;
    const profile = await kv.get(profileKey);
    
    if (!profile) {
      return c.json({ error: 'Profile not found' }, 404);
    }
    
    // Validate requirements
    const idNumber = profile.idNumber;
    const email = profile.email;
    const documents = profile.identityDocuments || [];
    
    if (!idNumber) {
      return c.json({ error: 'Client ID number is missing (required for password)' }, 400);
    }
    
    if (!email) {
      return c.json({ error: 'Client email is missing' }, 400);
    }
    
    const uploadedDocs = documents.filter((d: Record<string, unknown>) => d.fileName && (d.fileUrl || d.path));
    
    if (uploadedDocs.length === 0) {
      return c.json({ error: 'No uploaded documents found' }, 400);
    }
    
    // Create ZIP
    const zipWriter = new ZipWriter(new Uint8ArrayWriter());
    const bucketName = 'make-91ed8379-client-documents';
    
    for (const doc of uploadedDocs) {
      const filePath = doc.fileUrl || doc.path; // Frontend saves path in fileUrl often
      
      // Download file from Storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(bucketName)
        .download(filePath);
        
      if (downloadError) {
        log.error(`Failed to download file ${doc.fileName}`, downloadError);
        continue;
      }
      
      // Add to ZIP with password
      const fileBuffer = await fileData.arrayBuffer();
      await zipWriter.add(doc.fileName, new Uint8ArrayReader(new Uint8Array(fileBuffer)), {
        password: idNumber,
        level: 9 // Max compression
      });
    }
    
    const zipBlob = await zipWriter.close();
    
    // Convert to Base64
    // Using a chunk-safe approach for large files if needed, but for now simple conversion
    let binary = '';
    const bytes = new Uint8Array(zipBlob);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Zip = btoa(binary);
    
    // Send Email
    const emailHtml = `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>Secure Documents Attached</h2>
        <p>Dear ${profile.firstName || 'Client'},</p>
        <p>Your identity documents have been securely uploaded to your profile.</p>
        <p>Please find them attached in an encrypted ZIP file.</p>
        <p><strong>Password:</strong> Your National ID Number</p>
        <br/>
        <p>Best regards,</p>
        <p>Navigate Wealth Team</p>
      </div>
    `;
    
    const success = await sendEmail({
      to: email,
      subject: 'Secure Document Upload Notification',
      html: emailHtml,
      attachments: [
        {
          content: base64Zip,
          filename: 'identity_documents.zip'
        }
      ]
    });
    
    if (!success) {
      return c.json({ error: 'Failed to send email' }, 500);
    }
    
    return c.json({ success: true, message: 'Documents sent successfully' });
    
  } catch (error) {
    log.error('Error in /send-documents', error);
    return c.json({ 
      error: 'Failed to send documents', 
      details: getErrMsg(error) 
    }, 500);
  }
});

/**
 * POST /update-status
 * Lightweight endpoint for the client-side AccountTypeSelectionPage to sync
 * accountStatus into the KV profile when the user selects their account type.
 * This ensures route guards work correctly after page refresh. (SS5.4)
 */
router.post('/update-status', async (c) => {
  try {
    const { userId, accountStatus, accountType } = await c.req.json();

    if (!userId || !accountStatus) {
      return c.json({ error: 'userId and accountStatus are required' }, 400);
    }

    const profileKey = `user_profile:${userId}:personal_info`;
    const profile = await kv.get(profileKey) as Record<string, unknown> | null;

    if (!profile) {
      log.warn('No profile found for update-status', { userId });
      return c.json({ error: 'Profile not found' }, 404);
    }

    const now = new Date().toISOString();
    await kv.set(profileKey, {
      ...profile,
      accountStatus,
      ...(accountType ? { accountType } : {}),
      metadata: {
        ...(profile.metadata as Record<string, unknown> || {}),
        updatedAt: now,
      },
    });

    log.info('Profile status synced', { userId, accountStatus });
    return c.json({ success: true });
  } catch (error: unknown) {
    log.error('update-status error:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to update status',
    }, 500);
  }
});

/**
 * GET /
 * Health check endpoint
 */
router.get("/", async (c) => {
  return c.json({ 
    status: 'ok',
    service: 'Profile Routes',
    timestamp: new Date().toISOString()
  });
});

export default router;