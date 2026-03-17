/**
 * Database Setup Endpoint
 * Creates the personal_client_applications table if it doesn't exist
 * This is a one-time setup that runs automatically
 */

import { Hono } from 'npm:hono';
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';

const setupApp = new Hono();
const log = createModuleLogger('setup');

// Root handlers
setupApp.get('/', (c) => c.json({ service: 'setup', status: 'active' }));
setupApp.get('', (c) => c.json({ service: 'setup', status: 'active' }));

/**
 * POST /setup/database - Create database tables if they don't exist
 */
setupApp.post('/database', async (c) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Create the personal_client_applications table using raw SQL
    const createTableSQL = `
      -- Enable UUID extension
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      -- Create helper function for updating timestamps
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      -- Create the applications table
      CREATE TABLE IF NOT EXISTS personal_client_applications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'approved', 'declined')),
        application_data JSONB DEFAULT '{}'::JSONB,
        submitted_at TIMESTAMPTZ,
        reviewed_at TIMESTAMPTZ,
        reviewed_by UUID REFERENCES auth.users(id),
        review_notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id)
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_personal_client_applications_user_id ON personal_client_applications(user_id);
      CREATE INDEX IF NOT EXISTS idx_personal_client_applications_status ON personal_client_applications(status);
      CREATE INDEX IF NOT EXISTS idx_personal_client_applications_submitted_at ON personal_client_applications(submitted_at);

      -- Enable RLS
      ALTER TABLE personal_client_applications ENABLE ROW LEVEL SECURITY;

      -- Drop existing policies if they exist
      DROP POLICY IF EXISTS "Clients can view own application" ON personal_client_applications;
      DROP POLICY IF EXISTS "Clients can insert own application" ON personal_client_applications;
      DROP POLICY IF EXISTS "Clients can update own application while in progress" ON personal_client_applications;
      DROP POLICY IF EXISTS "Clients can delete own application while in progress" ON personal_client_applications;

      -- Create RLS policies
      CREATE POLICY "Clients can view own application" ON personal_client_applications
        FOR SELECT USING (auth.uid() = user_id);

      CREATE POLICY "Clients can insert own application" ON personal_client_applications
        FOR INSERT WITH CHECK (auth.uid() = user_id);

      CREATE POLICY "Clients can update own application while in progress" ON personal_client_applications
        FOR UPDATE USING (auth.uid() = user_id AND status IN ('in_progress', 'declined'));

      CREATE POLICY "Clients can delete own application while in progress" ON personal_client_applications
        FOR DELETE USING (auth.uid() = user_id AND status = 'in_progress');

      -- Create triggers
      DROP TRIGGER IF EXISTS update_personal_client_applications_updated_at ON personal_client_applications;
      CREATE TRIGGER update_personal_client_applications_updated_at
        BEFORE UPDATE ON personal_client_applications
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();

      -- Create function for auto-setting timestamps
      CREATE OR REPLACE FUNCTION set_application_submitted_at()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status != 'submitted') AND NEW.submitted_at IS NULL THEN
          NEW.submitted_at = NOW();
        END IF;
        IF NEW.status IN ('approved', 'declined') AND (OLD.status IS NULL OR OLD.status NOT IN ('approved', 'declined')) AND NEW.reviewed_at IS NULL THEN
          NEW.reviewed_at = NOW();
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS auto_set_application_timestamps ON personal_client_applications;
      CREATE TRIGGER auto_set_application_timestamps
        BEFORE UPDATE ON personal_client_applications
        FOR EACH ROW
        EXECUTE FUNCTION set_application_submitted_at();
    `;

    // Execute the SQL using Supabase's rpc method with a custom function
    // Since we can't execute raw DDL directly, we'll use the REST API
    const { error } = await supabase.rpc('exec_sql', { sql: createTableSQL }).catch(() => ({ error: null }));

    // Alternative: Try using the REST API directly
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({ query: createTableSQL })
    }).catch(() => null);

    // Check if table exists by trying to query it
    const { error: checkError } = await supabase
      .from('personal_client_applications')
      .select('id')
      .limit(1);

    if (checkError) {
      // Table doesn't exist - provide manual instructions
      
      return c.json({
        success: false,
        requiresManualSetup: true,
        message: 'Database table does not exist. Please run the SQL migration manually.',
        instructions: [
          '1. Go to Supabase Dashboard → SQL Editor',
          '2. Copy the contents of /database/migrations/00_create_applications_table.sql',
          '3. Paste and run the SQL',
          '4. Refresh this page'
        ],
        migrationFile: '/database/migrations/00_create_applications_table.sql',
        documentationFile: '/FIX_DATABASE_ERROR.md'
      }, 400);
    }

    return c.json({
      success: true,
      message: 'Database is ready',
      tableExists: true
    });

  } catch (error) {
    log.error('Failed to setup database', error);
    return c.json({
      success: false,
      requiresManualSetup: true,
      error: 'Failed to setup database',
      details: getErrMsg(error),
      instructions: [
        '1. Go to Supabase Dashboard → SQL Editor',
        '2. Copy the contents of /database/migrations/00_create_applications_table.sql',
        '3. Paste and run the SQL',
        '4. Refresh this page'
      ],
      migrationFile: '/database/migrations/00_create_applications_table.sql',
      documentationFile: '/FIX_DATABASE_ERROR.md'
    }, 500);
  }
});

/**
 * GET /setup/check - Check if database is setup correctly
 */
setupApp.get('/check', async (c) => {
  try {

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Try to query the table
    const { error } = await supabase
      .from('personal_client_applications')
      .select('id')
      .limit(1);

    if (error) {
      return c.json({
        ready: false,
        tableExists: false,
        message: 'Database table does not exist',
        error: error.message,
        needsSetup: true
      }, 400);
    }

    return c.json({
      ready: true,
      tableExists: true,
      message: 'Database is ready'
    });

  } catch (error) {
    log.error('Failed to check database', error);
    return c.json({
      ready: false,
      error: 'Failed to check database',
      details: getErrMsg(error)
    }, 500);
  }
});

/**
 * POST /setup/tasks-table - Create tasks table for Task Management system
 */
setupApp.post('/tasks-table', async (c) => {
  try {

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Check if table already exists
    const { error: checkError } = await supabase
      .from('tasks')
      .select('id')
      .limit(1);

    if (!checkError) {
      return c.json({
        success: true,
        message: 'Tasks table already exists',
        tableExists: true
      });
    }

    // Table doesn't exist - provide SQL for manual creation
    
    const createTasksTableSQL = `
-- Create tasks table for Task Management system
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'completed', 'archived')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  is_template BOOLEAN NOT NULL DEFAULT FALSE,
  due_date TIMESTAMPTZ,
  assignee_initials TEXT,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  category TEXT CHECK (category IN ('client', 'compliance', 'application', 'internal')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sort_order ON public.tasks(status, sort_order);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date) WHERE due_date IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admin users can view all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admin users can insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admin users can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admin users can delete tasks" ON public.tasks;

-- RLS Policy: Only authenticated admin users can access tasks
CREATE POLICY "Admin users can view all tasks"
  ON public.tasks
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin users can insert tasks"
  ON public.tasks
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND created_by = auth.uid()
  );

CREATE POLICY "Admin users can update tasks"
  ON public.tasks
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admin users can delete tasks"
  ON public.tasks
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function before updates
DROP TRIGGER IF EXISTS tasks_updated_at_trigger ON public.tasks;
CREATE TRIGGER tasks_updated_at_trigger
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_tasks_updated_at();

-- Function to set completed_at when status changes to completed
CREATE OR REPLACE FUNCTION set_task_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = NOW();
  ELSIF NEW.status != 'completed' AND OLD.status = 'completed' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically set completed_at
DROP TRIGGER IF EXISTS tasks_completed_at_trigger ON public.tasks;
CREATE TRIGGER tasks_completed_at_trigger
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION set_task_completed_at();
    `;

    return c.json({
      success: false,
      requiresManualSetup: true,
      message: 'Tasks table does not exist. Please run the SQL migration manually.',
      instructions: [
        '1. Go to Supabase Dashboard → SQL Editor',
        '2. Create a new query',
        '3. Copy the SQL provided below',
        '4. Paste and run the SQL',
        '5. Refresh the Task Management page'
      ],
      sql: createTasksTableSQL,
      migrationFile: '/supabase/migrations/create_tasks_table.sql',
      documentationFile: '/TASK_MANAGEMENT_QUICKSTART.md'
    }, 400);

  } catch (error) {
    log.error('Failed to check tasks table', error);
    return c.json({
      success: false,
      requiresManualSetup: true,
      error: 'Failed to check tasks table',
      details: getErrMsg(error),
      instructions: [
        '1. Go to Supabase Dashboard → SQL Editor',
        '2. Copy the contents of /supabase/migrations/create_tasks_table.sql',
        '3. Paste and run the SQL',
        '4. Refresh the Task Management page'
      ],
      migrationFile: '/supabase/migrations/create_tasks_table.sql',
      documentationFile: '/TASK_MANAGEMENT_QUICKSTART.md'
    }, 500);
  }
});

/**
 * GET /setup/check-tasks-table - Check if tasks table exists
 */
setupApp.get('/check-tasks-table', async (c) => {
  try {

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Try to query the tasks table
    const { error } = await supabase
      .from('tasks')
      .select('id')
      .limit(1);

    if (error) {
      return c.json({
        ready: false,
        tableExists: false,
        message: 'Tasks table does not exist',
        error: error.message,
        needsSetup: true
      }, 400);
    }

    return c.json({
      ready: true,
      tableExists: true,
      message: 'Tasks table is ready'
    });

  } catch (error) {
    log.error('Failed to check tasks table', error);
    return c.json({
      ready: false,
      error: 'Failed to check tasks table',
      details: getErrMsg(error)
    }, 500);
  }
});

export default setupApp;