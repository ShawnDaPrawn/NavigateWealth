import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/tabs';
import { FileText, FolderTree, Settings as SettingsIcon, Loader2, AlertCircle } from 'lucide-react';
import { ArticlesListView } from '../publications/ArticlesListView';
import { ArticleEditor } from '../publications/ArticleEditor';
import { CategoriesManager } from '../publications/CategoriesManager';
import { PublicationsSettings } from '../publications/PublicationsSettings';
import { InitializePublications } from '../publications/InitializePublications';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';

interface Article {
  id: string;
  title: string;
  subtitle?: string;
  slug: string;
  excerpt: string;
  category_id: string;
  type_id: string;
  status: 'draft' | 'in_review' | 'scheduled' | 'published' | 'archived';
  is_featured: boolean;
  published_at?: string;
  scheduled_for?: string;
  created_at: string;
  updated_at: string;
}

export function PublicationsTab() {
  const [activeTab, setActiveTab] = useState('articles');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const baseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/publications`;

  useEffect(() => {
    checkInitialization();
  }, []);

  const checkInitialization = async () => {
    try {
      const response = await fetch(`${baseUrl}/categories`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setIsInitialized(data.data && data.data.length > 0);
      } else {
        setIsInitialized(false);
      }
    } catch (error) {
      // Suppress fetch errors if backend is not available
      // console.error('Error checking initialization:', error);
      setIsInitialized(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setSelectedArticle(null);
    setShowEditor(true);
  };

  const handleEditArticle = (article: Article) => {
    setSelectedArticle(article);
    setShowEditor(true);
  };

  const handleBackToList = () => {
    setShowEditor(false);
    setSelectedArticle(null);
    checkInitialization(); // Refresh the list
  };

  const handleArticleSaved = () => {
    setShowEditor(false);
    setSelectedArticle(null);
    checkInitialization(); // Refresh the list
  };

  const handleInitialized = () => {
    // Re-check initialization status after successful init
    checkInitialization();
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
        <p className="text-xl font-medium text-purple-600">Loading Publications...</p>
      </div>
    );
  }

  // Initialization required state
  if (isInitialized === false) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <AlertCircle className="h-6 w-6 text-purple-600 mt-0.5" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-purple-900 mb-1">Publications Setup Required</h3>
              <p className="text-sm text-purple-700">
                Initialize the Publications system to start managing content for your Financial Insights & Market Intelligence resource center.
              </p>
            </div>
          </div>
        </div>
        <div className="max-w-3xl mx-auto">
          <InitializePublications onInitialized={handleInitialized} />
        </div>
      </div>
    );
  }

  // If editor is shown, render only the editor
  if (showEditor) {
    return (
      <div className="space-y-4">
        <ArticleEditor 
          key={selectedArticle?.id || 'new'}
          article={selectedArticle}
          onBack={handleBackToList}
          onSaved={handleArticleSaved}
        />
      </div>
    );
  }

  // Main view with tabs
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <FileText className="h-5 w-5 text-purple-600 mt-0.5" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-purple-900 mb-1">Publications Management</h3>
            <p className="text-sm text-purple-700">
              Manage content for the Financial Insights & Market Intelligence resource center. 
              Create articles, organize categories, and publish to the public Resources page.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-3xl grid-cols-3">
          <TabsTrigger value="articles" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Articles
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <FolderTree className="h-4 w-4" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="articles" className="mt-6">
          <ArticlesListView 
            onCreateNew={handleCreateNew}
            onEditArticle={handleEditArticle}
          />
        </TabsContent>

        <TabsContent value="categories" className="mt-6">
          <CategoriesManager />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <PublicationsSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}