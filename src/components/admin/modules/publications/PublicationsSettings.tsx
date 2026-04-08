import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '../../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import {
  Settings,
  Database,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Loader2,
  Newspaper,
  Save,
} from 'lucide-react';
import { PublicationsAPI } from './api';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';
import { createClient } from '../../../../utils/supabase/client';

export function PublicationsSettings() {
  const [confirmClear, setConfirmClear] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Press Stats Config ──────────────────────────────────────────────────
  const [pressAum, setPressAum] = useState('R500 mil+');
  const [pressYears, setPressYears] = useState('15+');
  const [pressExperience, setPressExperience] = useState('55+');
  const [pressLoading, setPressLoading] = useState(true);
  const [pressSaving, setPressSaving] = useState(false);

  const loadPressConfig = useCallback(async () => {
    setPressLoading(true);
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || publicAnonKey;

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/publications/press/config`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const json = await res.json();
      if (json.success && json.data) {
        setPressAum(json.data.aum || 'R500 mil+');
        setPressYears(json.data.yearsInBusiness || '15+');
        setPressExperience(json.data.combinedExperience || '55+');
      }
    } catch (err) {
      console.error('Failed to load press config:', err);
    } finally {
      setPressLoading(false);
    }
  }, []);

  useEffect(() => { loadPressConfig(); }, [loadPressConfig]);

  const handleSavePressConfig = async () => {
    setPressSaving(true);
    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || publicAnonKey;

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/publications/press/config`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            aum: pressAum.trim(),
            yearsInBusiness: pressYears.trim(),
            combinedExperience: pressExperience.trim(),
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save');
      toast.success('Press page stats updated');
    } catch (err) {
      console.error('Failed to save press config:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save press stats');
    } finally {
      setPressSaving(false);
    }
  };

  const handleExportData = async () => {
    setExporting(true);
    setMessage(null);

    try {
      const result = await PublicationsAPI.Settings.exportData();
      
      // Create downloadable JSON file
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `navigate-wealth-articles-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setMessage({ type: 'success', text: 'Articles exported successfully!' });
    } catch (err) {
      console.error('Error exporting data:', err);
      setMessage({ type: 'error', text: 'Failed to export articles' });
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImportData(file);
    }
  };

  const handleImportData = async (file: File) => {
    setImporting(true);
    setMessage(null);

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const result = await PublicationsAPI.Settings.importData(data);
      setMessage({ 
        type: 'success', 
        text: `Imported ${result.imported.articles} articles, ${result.imported.categories} categories, ${result.imported.types} types` 
      });
    } catch (err) {
      console.error('Error importing data:', err);
      setMessage({ type: 'error', text: 'Failed to import articles. Check file format.' });
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClearDrafts = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 5000);
      return;
    }

    setClearing(true);
    setMessage(null);

    try {
      const result = await PublicationsAPI.Settings.clearDrafts();
      setMessage({ type: 'success', text: result.message });
      setConfirmClear(false);
    } catch (err) {
      console.error('Error clearing drafts:', err);
      setMessage({ type: 'error', text: 'Failed to clear drafts' });
    } finally {
      setClearing(false);
    }
  };

  const handleRebuildCache = () => {
    setMessage({ type: 'success', text: 'Cache rebuild complete (no action needed for KV store)' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Publications Settings</h2>
        <p className="text-sm text-gray-500">
          Configure publication system settings and maintenance
        </p>
      </div>

      {/* Message Alert */}
      {message && (
        <div className={`rounded-lg p-4 flex items-start gap-3 ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
          )}
          <div className="flex-1">
            <p className={`text-sm ${
              message.type === 'success' ? 'text-green-600' : 'text-red-600'
            }`}>
              {message.text}
            </p>
          </div>
          <button onClick={() => setMessage(null)}>
            <span className={`text-sm ${
              message.type === 'success' ? 'text-green-600' : 'text-red-600'
            }`}>
              ✕
            </span>
          </button>
        </div>
      )}

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            General Settings
          </CardTitle>
          <CardDescription>
            Configure default settings for the publications system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div>
              <Label>
                Default Article Author
              </Label>
              <Input
                type="text"
                defaultValue="Navigate Wealth Editorial Team"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <Label>
                Articles per Page (Public)
              </Label>
              <Input
                type="number"
                defaultValue="12"
                min="6"
                max="50"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto_publish"
                defaultChecked={true}
                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
              />
              <label htmlFor="auto_publish" className="text-sm font-medium text-gray-700">
                Auto-publish scheduled articles
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="track_views"
                defaultChecked={true}
                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
              />
              <label htmlFor="track_views" className="text-sm font-medium text-gray-700">
                Track article view counts
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="show_featured"
                defaultChecked={true}
                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
              />
              <label htmlFor="show_featured" className="text-sm font-medium text-gray-700">
                Show featured articles on homepage
              </label>
            </div>
          </div>

          <div className="pt-4">
            <Button disabled>
              <CheckCircle className="h-4 w-4 mr-2" />
              Save Settings
            </Button>
            <p className="text-xs text-gray-500 mt-2">
              Note: Settings persistence will be implemented in a future update
            </p>
          </div>
        </CardContent>
      </Card>

      {/* SEO Settings */}
      <Card>
        <CardHeader>
          <CardTitle>SEO Defaults</CardTitle>
          <CardDescription>
            Default SEO settings for new articles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>
              Default Meta Description Template
            </Label>
            <textarea
              defaultValue="Read {title} on Navigate Wealth. {excerpt}"
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Available variables: {'{title}'}, {'{excerpt}'}, {'{category}'}, {'{author}'}
            </p>
          </div>

          <div>
            <Label>
              Canonical URL Base
            </Label>
            <Input
              type="text"
              defaultValue="https://www.navigatewealth.co/resources"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="pt-2">
            <Button disabled>
              <CheckCircle className="h-4 w-4 mr-2" />
              Save SEO Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Press Page Stats Config */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-purple-500" />
            Press Page Stats
          </CardTitle>
          <CardDescription>
            Configure the headline stats displayed on the public Press page. Active client count is derived automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pressLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading current config...
            </div>
          ) : (
            <div className="contents">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="press-aum">Assets Under Management</Label>
                  <Input
                    id="press-aum"
                    value={pressAum}
                    onChange={(e) => setPressAum(e.target.value)}
                    placeholder="e.g. R500 mil+"
                  />
                  <p className="text-[11px] text-muted-foreground">Displayed as-is on the Press page</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="press-years">Years in Business</Label>
                  <Input
                    id="press-years"
                    value={pressYears}
                    onChange={(e) => setPressYears(e.target.value)}
                    placeholder="e.g. 15+"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="press-experience">Combined Experience (years)</Label>
                  <Input
                    id="press-experience"
                    value={pressExperience}
                    onChange={(e) => setPressExperience(e.target.value)}
                    placeholder="e.g. 55+"
                  />
                </div>
              </div>
              <div className="pt-2">
                <Button
                  onClick={handleSavePressConfig}
                  disabled={pressSaving}
                  className="bg-purple-600 hover:bg-purple-700"
                  size="sm"
                >
                  {pressSaving ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1.5" />
                  )}
                  {pressSaving ? 'Saving...' : 'Save Press Stats'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Management
          </CardTitle>
          <CardDescription>
            Import, export, and manage publication data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-sm">Export All Articles</p>
              <p className="text-xs text-gray-500">Download articles, categories, and types as JSON</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleExportData} disabled={exporting}>
              {exporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {exporting ? 'Exporting...' : 'Export'}
            </Button>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-sm">Import Articles</p>
              <p className="text-xs text-gray-500">Upload JSON file to import articles</p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {importing ? 'Importing...' : 'Import'}
            </Button>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-sm">Rebuild Search Cache</p>
              <p className="text-xs text-gray-500">Refresh search index for all articles</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleRebuildCache}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Rebuild
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Maintenance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            Maintenance & Cleanup
          </CardTitle>
          <CardDescription>
            Dangerous operations - use with caution
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
            <div>
              <p className="font-medium text-sm text-red-900">Clear All Drafts</p>
              <p className="text-xs text-red-700">
                Permanently delete all draft articles (published articles are not affected)
              </p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleClearDrafts}
              disabled={clearing}
              className={confirmClear ? 'bg-red-600 text-white border-red-600 hover:bg-red-700' : 'border-red-300 text-red-700 hover:bg-red-50'}
            >
              {clearing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              {clearing ? 'Deleting...' : confirmClear ? 'Confirm Delete' : 'Clear Drafts'}
            </Button>
          </div>

          {confirmClear && (
            <p className="text-sm text-red-600 font-medium">
              ⚠️ Click again to confirm deletion
            </p>
          )}
        </CardContent>
      </Card>

      {/* System Info */}
      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Publications System Version:</span>
            <span className="font-medium">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Database Schema:</span>
            <span className="font-medium">v1 (Stage 1)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">API Endpoint:</span>
            <code className="text-xs bg-gray-100 px-2 py-1 rounded">/publications</code>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Last Updated:</span>
            <span className="font-medium">{new Date().toLocaleDateString()}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}