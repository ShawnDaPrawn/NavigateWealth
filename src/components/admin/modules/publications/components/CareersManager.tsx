/**
 * Careers Manager — Admin CRUD for public Careers page job listings
 *
 * Guidelines:
 *   §7    — Presentation layer only; data via API helpers
 *   §8.3  — Status colour vocabulary, stat card standards
 *   §8.4  — Platform constraints (sonner@2.0.3)
 *   §14.1 — Destructive actions require confirmation
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import { Skeleton } from '../../../../ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../../ui/alert-dialog';
import {
  Briefcase,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Save,
  X,
  Eye,
  EyeOff,
  MapPin,
  Clock,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';
import { createClient } from '../../../../../utils/supabase/client';

// ============================================================================
// TYPES
// ============================================================================

interface JobListing {
  id: string;
  title: string;
  category: string;
  location: string;
  type: string;
  description: string;
  requirements: string[];
  benefits: string[];
  closingDate?: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

type FormData = Omit<JobListing, 'id' | 'createdAt' | 'updatedAt'>;

const EMPTY_FORM: FormData = {
  title: '',
  category: 'advisory',
  location: 'Pretoria, South Africa',
  type: 'full-time',
  description: '',
  requirements: [],
  benefits: [],
  closingDate: '',
  active: true,
  sortOrder: 99,
};

const CATEGORIES = [
  { value: 'advisory', label: 'Advisory', color: 'bg-purple-100 text-purple-700' },
  { value: 'administration', label: 'Administration', color: 'bg-blue-100 text-blue-700' },
  { value: 'compliance', label: 'Compliance', color: 'bg-green-100 text-green-700' },
  { value: 'marketing', label: 'Marketing', color: 'bg-orange-100 text-orange-700' },
];

const JOB_TYPES = [
  { value: 'full-time', label: 'Full-time' },
  { value: 'part-time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
];

function getCategoryConfig(cat: string) {
  return CATEGORIES.find(c => c.value === cat) || { value: cat, label: cat, color: 'bg-gray-100 text-gray-700' };
}

// ============================================================================
// API HELPERS
// ============================================================================

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/publications`;

async function getAuthToken(): Promise<string> {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) return data.session.access_token;
  } catch { /* fall through */ }
  return publicAnonKey;
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = await getAuthToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.details || `Request failed (${res.status})`);
  return data;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CareersManager() {
  const [listings, setListings] = useState<JobListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({ ...EMPTY_FORM });
  const [requirementInput, setRequirementInput] = useState('');
  const [benefitInput, setBenefitInput] = useState('');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<JobListing | null>(null);

  // ── Load ─────────────────────────────────────────────────────────────
  const loadListings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/careers/admin');
      setListings(data.data || []);
    } catch (err) {
      console.error('Failed to load job listings:', err);
      toast.error('Failed to load job listings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadListings(); }, [loadListings]);

  // ── Form helpers ────────────────────────────────────────────────────
  const updateForm = (field: keyof FormData, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const addListItem = (field: 'requirements' | 'benefits', input: string, setInput: (v: string) => void) => {
    const trimmed = input.trim();
    if (trimmed && !form[field].includes(trimmed)) {
      updateForm(field, [...form[field], trimmed]);
      setInput('');
    }
  };

  const removeListItem = (field: 'requirements' | 'benefits', item: string) => {
    updateForm(field, form[field].filter(i => i !== item));
  };

  // ── Open dialog ─────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, sortOrder: listings.length + 1 });
    setRequirementInput('');
    setBenefitInput('');
    setDialogOpen(true);
  };

  const openEdit = (listing: JobListing) => {
    setEditingId(listing.id);
    setForm({
      title: listing.title,
      category: listing.category,
      location: listing.location,
      type: listing.type,
      description: listing.description,
      requirements: [...listing.requirements],
      benefits: [...listing.benefits],
      closingDate: listing.closingDate || '',
      active: listing.active,
      sortOrder: listing.sortOrder,
    });
    setRequirementInput('');
    setBenefitInput('');
    setDialogOpen(true);
  };

  // ── Save ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.title.trim() || !form.category) {
      toast.error('Title and category are required');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await apiFetch(`/careers/admin/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
        toast.success(`"${form.title}" updated`);
      } else {
        await apiFetch('/careers/admin', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        toast.success(`"${form.title}" listing created`);
      }
      setDialogOpen(false);
      loadListings();
    } catch (err) {
      console.error('Save failed:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle active ───────────────────────────────────────────────────
  const handleToggleActive = async (listing: JobListing) => {
    try {
      await apiFetch(`/careers/admin/${listing.id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: !listing.active }),
      });
      toast.success(`"${listing.title}" ${listing.active ? 'hidden from' : 'shown on'} careers page`);
      loadListings();
    } catch (err) {
      console.error('Toggle failed:', err);
      toast.error('Failed to update visibility');
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/careers/admin/${deleteTarget.id}`, { method: 'DELETE' });
      toast.success(`"${deleteTarget.title}" removed`);
      setDeleteTarget(null);
      loadListings();
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Failed to remove listing');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────
  const activeCount = listings.filter(l => l.active).length;
  const categoryCounts = CATEGORIES.map(c => ({
    ...c,
    count: listings.filter(l => l.category === c.value && l.active).length,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Career Listings</h3>
          <p className="text-sm text-muted-foreground">
            Manage job listings displayed on the public Careers page.
          </p>
        </div>
        <Button
          size="sm"
          onClick={openCreate}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Listing
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Briefcase className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{listings.length}</p>
                <p className="text-[10px] text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <Eye className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-[10px] text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {categoryCounts.map(c => (
          <Card key={c.value}>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <p className="text-xl font-bold">{c.count}</p>
                <p className="text-[10px] text-muted-foreground">{c.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Listings */}
      {loading ? (
        <Card>
          <CardContent className="pt-4 pb-4 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-56" />
                  <Skeleton className="h-3 w-36" />
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : listings.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Briefcase className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-medium text-sm">No job listings yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add job listings to display on the public Careers page.
            </p>
            <Button size="sm" className="mt-4 bg-purple-600 hover:bg-purple-700" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add First Listing
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="divide-y">
            {listings.map((listing) => {
              const catCfg = getCategoryConfig(listing.category);
              return (
                <div
                  key={listing.id}
                  className={`flex items-center gap-4 p-4 transition-colors ${!listing.active ? 'opacity-50 bg-muted/20' : 'hover:bg-muted/10'}`}
                >
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-lg bg-purple-50 flex-shrink-0 flex items-center justify-center">
                    <Briefcase className="h-4 w-4 text-purple-600" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">{listing.title}</p>
                      <Badge className={`text-[10px] px-1.5 py-0 h-4 ${catCfg.color}`}>
                        {catCfg.label}
                      </Badge>
                      {!listing.active && (
                        <Badge variant="outline" className="text-[10px] border-gray-300 text-gray-500">
                          Hidden
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {listing.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {listing.type}
                      </span>
                      {listing.closingDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Closes {listing.closingDate}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Sort */}
                  <span className="text-[10px] text-muted-foreground w-6 text-center">#{listing.sortOrder}</span>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => handleToggleActive(listing)}
                      title={listing.active ? 'Hide from careers page' : 'Show on careers page'}
                    >
                      {listing.active ? (
                        <Eye className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5 text-gray-400" />
                      )}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(listing)}>
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setDeleteTarget(listing)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="border-t px-4 py-2.5 text-xs text-muted-foreground bg-muted/20">
            {listings.length} listing(s) — {activeCount} visible on the public Careers page
          </div>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* CREATE / EDIT DIALOG                                             */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Job Listing' : 'Add Job Listing'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update this job listing.'
                : 'Create a new job listing for the public Careers page.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="jl-title">Job Title <span className="text-red-500">*</span></Label>
              <Input
                id="jl-title"
                value={form.title}
                onChange={(e) => updateForm('title', e.target.value)}
                placeholder="e.g. Senior Wealth Advisor"
              />
            </div>

            {/* Category & Type */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="jl-category">Category <span className="text-red-500">*</span></Label>
                <select
                  id="jl-category"
                  value={form.category}
                  onChange={(e) => updateForm('category', e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jl-type">Employment Type</Label>
                <select
                  id="jl-type"
                  value={form.type}
                  onChange={(e) => updateForm('type', e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                >
                  {JOB_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Location & Closing Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="jl-location">Location</Label>
                <Input
                  id="jl-location"
                  value={form.location}
                  onChange={(e) => updateForm('location', e.target.value)}
                  placeholder="Pretoria, South Africa"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jl-closing">Closing Date</Label>
                <Input
                  id="jl-closing"
                  type="date"
                  value={form.closingDate}
                  onChange={(e) => updateForm('closingDate', e.target.value)}
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="jl-desc">Description</Label>
              <Textarea
                id="jl-desc"
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
                placeholder="Describe the role, responsibilities, and what the candidate can expect..."
                rows={4}
              />
            </div>

            {/* Requirements */}
            <div className="space-y-1.5">
              <Label>Requirements</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={requirementInput}
                  onChange={(e) => setRequirementInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addListItem('requirements', requirementInput, setRequirementInput); } }}
                  placeholder="Type and press Enter"
                  className="flex-1"
                />
                <Button type="button" size="sm" variant="outline" onClick={() => addListItem('requirements', requirementInput, setRequirementInput)} disabled={!requirementInput.trim()}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              {form.requirements.length > 0 && (
                <ul className="space-y-1 mt-1">
                  {form.requirements.map((r) => (
                    <li key={r} className="flex items-center gap-2 text-xs bg-gray-50 rounded px-2 py-1.5">
                      <span className="flex-1">{r}</span>
                      <button type="button" onClick={() => removeListItem('requirements', r)} className="text-gray-400 hover:text-red-500">
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Benefits */}
            <div className="space-y-1.5">
              <Label>Benefits</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={benefitInput}
                  onChange={(e) => setBenefitInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addListItem('benefits', benefitInput, setBenefitInput); } }}
                  placeholder="Type and press Enter"
                  className="flex-1"
                />
                <Button type="button" size="sm" variant="outline" onClick={() => addListItem('benefits', benefitInput, setBenefitInput)} disabled={!benefitInput.trim()}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              {form.benefits.length > 0 && (
                <ul className="space-y-1 mt-1">
                  {form.benefits.map((b) => (
                    <li key={b} className="flex items-center gap-2 text-xs bg-gray-50 rounded px-2 py-1.5">
                      <span className="flex-1">{b}</span>
                      <button type="button" onClick={() => removeListItem('benefits', b)} className="text-gray-400 hover:text-red-500">
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Sort order & Active */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="jl-sort">Display Order</Label>
                <Input
                  id="jl-sort"
                  type="number"
                  min={1}
                  value={form.sortOrder}
                  onChange={(e) => updateForm('sortOrder', parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Visibility</Label>
                <div className="flex items-center gap-2 h-9">
                  <input
                    type="checkbox"
                    id="jl-active"
                    checked={form.active}
                    onChange={(e) => updateForm('active', e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="jl-active" className="text-sm">
                    Show on public Careers page
                  </label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.title.trim() || !form.category}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1.5" />
              )}
              {editingId ? 'Save Changes' : 'Create Listing'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* DELETE CONFIRMATION                                              */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Job Listing?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>"{deleteTarget?.title}"</strong> will be removed from the public Careers page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}