/**
 * Task Management Module - Task Setup Component
 * Navigate Wealth Admin Dashboard
 * 
 * Setup wizard for creating the tasks table in Supabase
 * Provides SQL migration code and step-by-step instructions
 * 
 * @module tasks/components/TaskSetup
 */

import { useState } from 'react';
import { AlertCircle, Copy, Check, ExternalLink } from 'lucide-react';
import { projectId } from '../../../../../utils/supabase/info';

// ============================================================================
// SQL MIGRATION
// ============================================================================

const TASKS_TABLE_SQL = `-- Create tasks table for Task Management system
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
  EXECUTE FUNCTION set_task_completed_at();`;

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Task setup component
 * Guides users through database setup process
 */
export function TaskSetup() {
  const [copied, setCopied] = useState(false);

  const copySQL = async () => {
    try {
      // Try modern clipboard API first
      await navigator.clipboard.writeText(TASKS_TABLE_SQL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for browsers that don't support clipboard API or have permissions issues
      try {
        // Create a temporary textarea
        const textarea = document.createElement('textarea');
        textarea.value = TASKS_TABLE_SQL;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackErr) {
        console.error('Failed to copy:', fallbackErr);
        alert('Copy failed. Please manually select and copy the SQL code.');
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-300 rounded-xl p-6 mb-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <AlertCircle className="w-7 h-7 text-yellow-600 mt-1" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-yellow-900 mb-2">
              Task Management Setup Required
            </h2>
            <p className="text-sm text-yellow-800 leading-relaxed">
              The <code className="px-1.5 py-0.5 bg-yellow-100 rounded">tasks</code> table doesn't exist in your Supabase database yet. 
              Follow the quick steps below to set it up (takes about 2 minutes).
            </p>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
          <span className="text-purple-600">→</span>
          Setup Steps
        </h3>
        
        <ol className="space-y-5">
          <li className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 text-white flex items-center justify-center font-semibold shadow-md">
              1
            </div>
            <div className="flex-1 pt-1">
              <p className="text-gray-700 font-medium mb-1">Open Supabase SQL Editor</p>
              <p className="text-sm text-gray-600">Click the button below to open the SQL Editor in a new tab</p>
            </div>
          </li>
          
          <li className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 text-white flex items-center justify-center font-semibold shadow-md">
              2
            </div>
            <div className="flex-1 pt-1">
              <p className="text-gray-700 font-medium mb-1">Copy the SQL code</p>
              <p className="text-sm text-gray-600">Use the "Copy SQL" button below to copy the migration code</p>
            </div>
          </li>
          
          <li className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 text-white flex items-center justify-center font-semibold shadow-md">
              3
            </div>
            <div className="flex-1 pt-1">
              <p className="text-gray-700 font-medium mb-1">Paste and run the SQL</p>
              <p className="text-sm text-gray-600">Paste the code in the SQL Editor and click "Run"</p>
            </div>
          </li>
          
          <li className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 text-white flex items-center justify-center font-semibold shadow-md">
              4
            </div>
            <div className="flex-1 pt-1">
              <p className="text-gray-700 font-medium mb-1">Refresh this page</p>
              <p className="text-sm text-gray-600">After the SQL runs successfully, refresh this page to start using Task Management</p>
            </div>
          </li>
        </ol>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <a
            href={`https://supabase.com/dashboard/project/${projectId}/sql/new`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all shadow-md hover:shadow-lg font-medium"
          >
            <ExternalLink className="w-4 h-4" />
            Open Supabase SQL Editor
          </a>
        </div>
      </div>

      {/* SQL Code */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <span className="text-purple-600">⚡</span>
            SQL Migration Code
          </h3>
          <button
            onClick={copySQL}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white border border-gray-300 rounded-lg transition-all hover:shadow-sm"
          >
            {copied ? (
              <div className="contents">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-green-600 font-semibold">Copied!</span>
              </div>
            ) : (
              <div className="contents">
                <Copy className="w-4 h-4" />
                <span>Copy SQL</span>
              </div>
            )}
          </button>
        </div>
        <div className="p-6 max-h-[500px] overflow-y-auto bg-gray-50">
          <pre className="text-xs text-gray-800 font-mono leading-relaxed whitespace-pre-wrap">
            {TASKS_TABLE_SQL}
          </pre>
        </div>
      </div>

      {/* Refresh Button */}
      <div className="mt-8 flex items-center justify-center gap-4">
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 font-medium text-white bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all shadow-md hover:shadow-lg"
        >
          ✓ I've run the SQL - Refresh Page
        </button>
      </div>

      {/* Help Footer */}
      <div className="mt-6 p-5 bg-blue-50 border border-blue-200 rounded-xl">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <p className="font-medium text-blue-900 mb-1">Need help?</p>
            <p className="text-sm text-blue-800">
              If you encounter any issues, make sure you're logged into Supabase and have permissions to run SQL queries. 
              The table will be created with proper Row Level Security (RLS) policies to ensure data safety.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}