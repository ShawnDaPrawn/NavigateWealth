import React, { useState, useEffect } from 'react';
import { Button } from '../../../../../ui/button';
import { Plus, Loader2 } from 'lucide-react';
import { Goal } from './types';
import { GoalCard } from './GoalCard';
import { projectId, publicAnonKey } from '../../../../../../utils/supabase/info';
import { GoalFormDialog } from './GoalFormDialog';

interface GoalDashboardProps {
  clientId: string;
  policies: Array<{ id?: string; [key: string]: unknown }>; // Investment policies to link
  onGoalsUpdate?: (goals: Goal[]) => void;
  schemas?: Record<string, Array<{ id: string; name: string; [key: string]: unknown }>>;
  mainSchema?: Array<{ id: string; name: string; [key: string]: unknown }>;
}

export function GoalDashboard({ clientId, policies, onGoalsUpdate, schemas = {}, mainSchema = [] }: GoalDashboardProps) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>(undefined);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/goals`;

  useEffect(() => {
    fetchGoals();
  }, [clientId]);

  const fetchGoals = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/${clientId}`, {
         headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      if (res.ok) {
        const data = await res.json();
        const loadedGoals = data.goals || [];
        setGoals(loadedGoals);
        if (onGoalsUpdate) onGoalsUpdate(loadedGoals);
      }
    } catch (error) {
      console.error('Error fetching goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGoal = async (newGoal: Goal) => {
    // Optimistic update
    let updatedGoals;
    if (editingGoal) {
       updatedGoals = goals.map(g => g.id === newGoal.id ? newGoal : g);
    } else {
       updatedGoals = [...goals, newGoal];
    }
    
    setGoals(updatedGoals);
    if (onGoalsUpdate) onGoalsUpdate(updatedGoals);
    
    // Persist
    try {
       await fetch(`${API_BASE}/${clientId}`, {
          method: 'POST',
          headers: { 
             'Authorization': `Bearer ${publicAnonKey}`,
             'Content-Type': 'application/json'
          },
          body: JSON.stringify({ goals: updatedGoals })
       });
    } catch (e) {
       console.error("Failed to save goals", e);
       // Revert on error would go here
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm("Are you sure you want to delete this goal?")) return;

    const updatedGoals = goals.filter(g => g.id !== goalId);
    setGoals(updatedGoals);
    if (onGoalsUpdate) onGoalsUpdate(updatedGoals);

    try {
       await fetch(`${API_BASE}/${clientId}`, {
          method: 'POST',
          headers: { 
             'Authorization': `Bearer ${publicAnonKey}`,
             'Content-Type': 'application/json'
          },
          body: JSON.stringify({ goals: updatedGoals })
       });
    } catch (e) {
       console.error("Failed to delete goal", e);
    }
  }

  const handleAddClick = () => {
    setEditingGoal(undefined);
    setIsDialogOpen(true);
  };

  const handleEditClick = (goal: Goal) => {
    setEditingGoal(goal);
    setIsDialogOpen(true);
  };

  if (loading) {
     return <div className="flex justify-center p-4"><Loader2 className="animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
         <div>
            <h3 className="text-lg font-semibold text-gray-900">Investment Goals</h3>
            <p className="text-sm text-gray-500">Track your progress towards specific financial targets.</p>
         </div>
         <Button onClick={handleAddClick} size="sm" className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            New Goal
         </Button>
      </div>

      {goals.length === 0 ? (
         <div className="bg-blue-50 border border-blue-100 rounded-lg p-6 text-center">
            <p className="text-blue-800 text-sm mb-2">No goals defined yet.</p>
            <p className="text-blue-600 text-xs">Create a goal to link your voluntary investments and track performance.</p>
         </div>
      ) : (
         <div className="flex overflow-x-auto pb-4 gap-4 snap-x">
            {goals.map(goal => (
               <div key={goal.id} className="snap-start">
                  <GoalCard 
                     goal={goal} 
                     policies={policies} 
                     onEdit={handleEditClick}
                  />
               </div>
            ))}
         </div>
      )}

      <GoalFormDialog 
         isOpen={isDialogOpen}
         onClose={() => setIsDialogOpen(false)}
         onSave={handleSaveGoal}
         onDelete={handleDeleteGoal}
         initialData={editingGoal}
         policies={policies}
         clientId={clientId}
         schemas={schemas}
         mainSchema={mainSchema}
      />
    </div>
  );
}