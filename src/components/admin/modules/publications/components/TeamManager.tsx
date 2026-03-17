/**
 * Team Manager — Admin CRUD for public Team page members
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
  Users,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  GripVertical,
  Linkedin,
  Mail,
  Save,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../../../../utils/supabase/info';
import { createClient } from '../../../../../utils/supabase/client';

// ============================================================================
// TYPES
// ============================================================================

interface TeamMember {
  id: string;
  name: string;
  title: string;
  credentials: string;
  bio: string;
  specialties: string[];
  image: string;
  linkedinUrl?: string;
  email?: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

type FormData = Omit<TeamMember, 'id' | 'createdAt' | 'updatedAt'>;

const EMPTY_FORM: FormData = {
  name: '',
  title: '',
  credentials: '',
  bio: '',
  specialties: [],
  image: '',
  linkedinUrl: '',
  email: '',
  sortOrder: 99,
  active: true,
};

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

export function TeamManager() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({ ...EMPTY_FORM });
  const [specialtyInput, setSpecialtyInput] = useState('');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null);

  // ── Load ─────────────────────────────────────────────────────────────
  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/team/admin');
      setMembers(data.data || []);
    } catch (err) {
      console.error('Failed to load team members:', err);
      toast.error('Failed to load team members');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  // ── Form helpers ────────────────────────────────────────────────────
  const updateForm = (field: keyof FormData, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const addSpecialty = () => {
    const trimmed = specialtyInput.trim();
    if (trimmed && !form.specialties.includes(trimmed)) {
      updateForm('specialties', [...form.specialties, trimmed]);
      setSpecialtyInput('');
    }
  };

  const removeSpecialty = (s: string) => {
    updateForm('specialties', form.specialties.filter(sp => sp !== s));
  };

  const handleSpecialtyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSpecialty();
    }
  };

  // ── Open dialog ─────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, sortOrder: members.length + 1 });
    setSpecialtyInput('');
    setDialogOpen(true);
  };

  const openEdit = (member: TeamMember) => {
    setEditingId(member.id);
    setForm({
      name: member.name,
      title: member.title,
      credentials: member.credentials,
      bio: member.bio,
      specialties: [...member.specialties],
      image: member.image,
      linkedinUrl: member.linkedinUrl || '',
      email: member.email || '',
      sortOrder: member.sortOrder,
      active: member.active,
    });
    setSpecialtyInput('');
    setDialogOpen(true);
  };

  // ── Save ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim() || !form.title.trim()) {
      toast.error('Name and title are required');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await apiFetch(`/team/admin/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
        toast.success(`${form.name} updated`);
      } else {
        await apiFetch('/team/admin', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        toast.success(`${form.name} added to team`);
      }
      setDialogOpen(false);
      loadMembers();
    } catch (err) {
      console.error('Save failed:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle active ───────────────────────────────────────────────────
  const handleToggleActive = async (member: TeamMember) => {
    try {
      await apiFetch(`/team/admin/${member.id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: !member.active }),
      });
      toast.success(`${member.name} ${member.active ? 'hidden from' : 'shown on'} team page`);
      loadMembers();
    } catch (err) {
      console.error('Toggle failed:', err);
      toast.error('Failed to update visibility');
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/team/admin/${deleteTarget.id}`, { method: 'DELETE' });
      toast.success(`${deleteTarget.name} removed`);
      setDeleteTarget(null);
      loadMembers();
    } catch (err) {
      console.error('Delete failed:', err);
      toast.error('Failed to remove team member');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────
  const activeCount = members.filter(m => m.active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Team Members</h3>
          <p className="text-sm text-muted-foreground">
            Manage the team displayed on the public Team page.
          </p>
        </div>
        <Button
          size="sm"
          onClick={openCreate}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Member
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Users className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{members.length}</p>
                <p className="text-xs text-muted-foreground">Total Members</p>
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
                <p className="text-xs text-muted-foreground">Visible on Page</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <EyeOff className="h-4 w-4 text-gray-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{members.length - activeCount}</p>
                <p className="text-xs text-muted-foreground">Hidden</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Members list */}
      {loading ? (
        <Card>
          <CardContent className="pt-4 pb-4 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : members.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-medium text-sm">No team members yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Add team members to display on the public Team page.
            </p>
            <Button size="sm" className="mt-4 bg-purple-600 hover:bg-purple-700" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add First Member
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="divide-y">
            {members.map((member) => (
              <div
                key={member.id}
                className={`flex items-center gap-4 p-4 transition-colors ${!member.active ? 'opacity-50 bg-muted/20' : 'hover:bg-muted/10'}`}
              >
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                  {member.image ? (
                    <img
                      src={member.image}
                      alt={member.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <Users className="h-5 w-5" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{member.name}</p>
                    {member.credentials && (
                      <span className="text-[10px] text-muted-foreground">{member.credentials}</span>
                    )}
                    {!member.active && (
                      <Badge variant="outline" className="text-[10px] border-gray-300 text-gray-500">
                        Hidden
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-purple-600">{member.title}</p>
                  {member.specialties.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {member.specialties.slice(0, 3).map((s) => (
                        <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-purple-50 text-purple-600">
                          {s}
                        </Badge>
                      ))}
                      {member.specialties.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">+{member.specialties.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Sort order */}
                <span className="text-[10px] text-muted-foreground w-6 text-center">#{member.sortOrder}</span>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() => handleToggleActive(member)}
                    title={member.active ? 'Hide from team page' : 'Show on team page'}
                  >
                    {member.active ? (
                      <Eye className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5 text-gray-400" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() => openEdit(member)}
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() => setDeleteTarget(member)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t px-4 py-2.5 text-xs text-muted-foreground bg-muted/20">
            {members.length} member(s) — {activeCount} visible on the public Team page
          </div>
        </Card>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* CREATE / EDIT DIALOG                                             */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Team Member' : 'Add Team Member'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update this team member\'s details.'
                : 'Add a new member to the public Team page.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Name & Title */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tm-name">Name <span className="text-red-500">*</span></Label>
                <Input
                  id="tm-name"
                  value={form.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tm-title">Title <span className="text-red-500">*</span></Label>
                <Input
                  id="tm-title"
                  value={form.title}
                  onChange={(e) => updateForm('title', e.target.value)}
                  placeholder="e.g. Senior Wealth Advisor"
                />
              </div>
            </div>

            {/* Credentials */}
            <div className="space-y-1.5">
              <Label htmlFor="tm-credentials">Credentials</Label>
              <Input
                id="tm-credentials"
                value={form.credentials}
                onChange={(e) => updateForm('credentials', e.target.value)}
                placeholder="e.g. CFP, CFA, MBA"
              />
            </div>

            {/* Bio */}
            <div className="space-y-1.5">
              <Label htmlFor="tm-bio">Bio</Label>
              <Textarea
                id="tm-bio"
                value={form.bio}
                onChange={(e) => updateForm('bio', e.target.value)}
                placeholder="Brief biography..."
                rows={3}
              />
            </div>

            {/* Photo URL */}
            <div className="space-y-1.5">
              <Label htmlFor="tm-image">Photo URL</Label>
              <Input
                id="tm-image"
                value={form.image}
                onChange={(e) => updateForm('image', e.target.value)}
                placeholder="https://images.unsplash.com/..."
              />
              {form.image && (
                <div className="w-16 h-16 rounded-full overflow-hidden border">
                  <img src={form.image} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            {/* Specialties */}
            <div className="space-y-1.5">
              <Label>Specialties</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={specialtyInput}
                  onChange={(e) => setSpecialtyInput(e.target.value)}
                  onKeyDown={handleSpecialtyKeyDown}
                  placeholder="Type and press Enter"
                  className="flex-1"
                />
                <Button type="button" size="sm" variant="outline" onClick={addSpecialty} disabled={!specialtyInput.trim()}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              {form.specialties.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {form.specialties.map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs bg-purple-50 text-purple-600 pr-1">
                      {s}
                      <button
                        type="button"
                        onClick={() => removeSpecialty(s)}
                        className="ml-1 hover:text-red-500"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* LinkedIn & Email */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tm-linkedin">LinkedIn URL</Label>
                <Input
                  id="tm-linkedin"
                  value={form.linkedinUrl}
                  onChange={(e) => updateForm('linkedinUrl', e.target.value)}
                  placeholder="https://linkedin.com/in/..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tm-email">Email</Label>
                <Input
                  id="tm-email"
                  value={form.email}
                  onChange={(e) => updateForm('email', e.target.value)}
                  placeholder="name@navigatewealth.co"
                />
              </div>
            </div>

            {/* Sort order & Active */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tm-sort">Display Order</Label>
                <Input
                  id="tm-sort"
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
                    id="tm-active"
                    checked={form.active}
                    onChange={(e) => updateForm('active', e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="tm-active" className="text-sm">
                    Show on public Team page
                  </label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name.trim() || !form.title.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1.5" />
              )}
              {editingId ? 'Save Changes' : 'Add Member'}
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
            <AlertDialogTitle>Remove Team Member?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> will be removed from the public Team page.
              This can be undone by re-adding them.
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