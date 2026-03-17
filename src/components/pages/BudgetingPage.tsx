import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Separator } from '../ui/separator';
import { formatCurrency, formatCurrencyInput, cleanCurrencyInput } from '../../utils/currencyFormatter';
import { EmptyState } from './profile/EmptyState';
import { emptyStateConfigs } from './profile/emptyStateConfigs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  TooltipProvider,
} from '../ui/tooltip';
import { SVGBarChart } from '../ui/svg-charts';
import {
  PiggyBank,
  Home,
  Coffee,
  Wallet,
  AlertCircle,
  Info,
  Plus,
  CheckCircle,
  AlertTriangle,
  Edit2,
  Trash2,
  Lightbulb,
  X,
  Save,
  TrendingUp,
  Target,
} from 'lucide-react';

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: 'needs' | 'wants' | 'savings';
}

interface BudgetingPageProps {
  netIncome?: number;
  grossIncome?: number;
  onEmptyStateAction?: () => void;
  // Admin embed props
  userId?: string;
  embedded?: boolean;
  incomeValidationError?: string | null;
  setIncomeValidationError?: (error: string | null) => void;
  grossIncomeDisplay?: string;
  setGrossIncomeDisplay?: (value: string) => void;
  netIncomeDisplay?: string;
  setNetIncomeDisplay?: (value: string) => void;
  profileData?: Record<string, unknown>;
  handleInputChange?: (field: string, value: string | number | boolean) => void;
}

const CATEGORY_COLORS = {
  needs: '#3b82f6',
  wants: '#a855f7',
  savings: '#22c55e',
};

const CATEGORY_INFO = {
  needs: {
    name: 'Needs',
    percentage: 50,
    description: 'Essential expenses you can\'t live without',
    examples: ['Rent/Mortgage', 'Utilities', 'Groceries', 'Transport', 'Insurance', 'Minimum Debt Payments'],
    icon: Home,
    color: CATEGORY_COLORS.needs,
    tip: 'These are your non-negotiables. If this exceeds 50%, consider ways to reduce fixed costs like downsizing, refinancing, or finding better deals on insurance and utilities.',
  },
  wants: {
    name: 'Wants',
    percentage: 30,
    description: 'Lifestyle and discretionary spending',
    examples: ['Dining Out', 'Entertainment', 'Shopping', 'Hobbies', 'Subscriptions', 'Vacations'],
    icon: Coffee,
    color: CATEGORY_COLORS.wants,
    tip: 'This is where you have the most flexibility. If you\'re over budget, start here. Cancel unused subscriptions, reduce dining out, or find free entertainment options.',
  },
  savings: {
    name: 'Savings & Debt',
    percentage: 20,
    description: 'Future security and debt repayment',
    examples: ['Emergency Fund', 'Retirement', 'Investments', 'Extra Debt Payments', 'Savings Goals'],
    icon: PiggyBank,
    color: CATEGORY_COLORS.savings,
    tip: 'Pay yourself first! This should be your priority after Needs. Even if you can\'t reach 20% now, start with what you can and increase it gradually.',
  },
};

export function BudgetingPage({ 
  netIncome: propNetIncome, 
  grossIncome: propGrossIncome, 
  onEmptyStateAction,
  userId,
  embedded,
  profileData,
  handleInputChange 
}: BudgetingPageProps) {
  const navigate = useNavigate();
  
  // Use profileData if in embedded mode, otherwise use props
  const netIncome = embedded && profileData ? (profileData.netMonthlyIncome || 0) : (propNetIncome || 0);
  const grossIncome = embedded && profileData ? (profileData.grossMonthlyIncome || 0) : (propGrossIncome || 0);
  
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  
  // Form state for adding/editing expense
  const [expenseForm, setExpenseForm] = useState({
    description: '',
    amount: '',
    category: 'needs' as 'needs' | 'wants' | 'savings',
  });

  // Calculate totals
  const totals = useMemo(() => {
    const needsTotal = expenses
      .filter(e => e.category === 'needs')
      .reduce((sum, e) => sum + e.amount, 0);
    const wantsTotal = expenses
      .filter(e => e.category === 'wants')
      .reduce((sum, e) => sum + e.amount, 0);
    const savingsTotal = expenses
      .filter(e => e.category === 'savings')
      .reduce((sum, e) => sum + e.amount, 0);
    const total = needsTotal + wantsTotal + savingsTotal;

    return { needsTotal, wantsTotal, savingsTotal, total };
  }, [expenses]);

  // Calculate budget recommendations (50-30-20 rule)
  const recommendations = useMemo(() => ({
    needs: (netIncome * 0.5),
    wants: (netIncome * 0.3),
    savings: (netIncome * 0.2),
  }), [netIncome]);

  // Remaining amounts
  const remaining = useMemo(() => ({
    needs: recommendations.needs - totals.needsTotal,
    wants: recommendations.wants - totals.wantsTotal,
    savings: recommendations.savings - totals.savingsTotal,
    total: netIncome - totals.total,
  }), [recommendations, totals, netIncome]);

  // Analysis and insights
  const analysis = useMemo(() => {
    if (netIncome === 0) return null;

    const insights: { type: 'error' | 'warning' | 'success' | 'info'; title: string; message: string }[] = [];

    // Check if total exceeds income
    if (totals.total > netIncome) {
      insights.push({
        type: 'error',
        title: 'Budget Exceeded',
        message: `Your total expenses (${formatCurrency(totals.total)}) exceed your net income by ${formatCurrency(totals.total - netIncome)}. You need to reduce spending immediately.`,
      });
    }

    // Check each category
    const needsPercentage = (totals.needsTotal / netIncome) * 100;
    const wantsPercentage = (totals.wantsTotal / netIncome) * 100;
    const savingsPercentage = (totals.savingsTotal / netIncome) * 100;

    if (needsPercentage > 50) {
      insights.push({
        type: 'warning',
        title: 'Needs Over Budget',
        message: `You're allocating ${needsPercentage.toFixed(0)}% to Needs. Consider ways to reduce essential expenses.`,
      });
    }

    if (wantsPercentage > 30) {
      insights.push({
        type: 'warning',
        title: 'Wants Over Budget',
        message: `You're spending ${wantsPercentage.toFixed(0)}% on Wants. Look for areas to cut discretionary spending.`,
      });
    }

    if (savingsPercentage < 20 && totals.total > 0) {
      insights.push({
        type: 'info',
        title: 'Increase Savings',
        message: `You're only saving ${savingsPercentage.toFixed(0)}% of your income. Try to reach the 20% goal.`,
      });
    }

    // Positive feedback
    if (totals.total > 0 && totals.total <= netIncome) {
      const needsOk = needsPercentage >= 45 && needsPercentage <= 55;
      const wantsOk = wantsPercentage >= 25 && wantsPercentage <= 35;
      const savingsOk = savingsPercentage >= 18 && savingsPercentage <= 25;

      if (needsOk && wantsOk && savingsOk) {
        insights.push({
          type: 'success',
          title: 'Excellent Budget!',
          message: 'You\'re following the 50-30-20 rule perfectly. Keep up the great work!',
        });
      }

      if (remaining.total > 0) {
        insights.push({
          type: 'success',
          title: 'Unallocated Income',
          message: `You have ${formatCurrency(remaining.total)} unallocated. Consider adding it to savings or investments.`,
        });
      }
    }

    return insights;
  }, [netIncome, totals, remaining]);

  const handleSaveExpense = () => {
    const cleaned = cleanCurrencyInput(expenseForm.amount);
    const amount = parseFloat(cleaned);
    
    if (!expenseForm.description.trim()) {
      alert('Please enter a description');
      return;
    }
    
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    const newExpense: Expense = {
      id: editingExpense?.id || Date.now().toString(),
      description: expenseForm.description,
      amount: amount,
      category: expenseForm.category,
    };

    if (editingExpense) {
      setExpenses(expenses.map(e => e.id === editingExpense.id ? newExpense : e));
    } else {
      setExpenses([...expenses, newExpense]);
    }

    // Reset form
    setExpenseForm({ description: '', amount: '', category: 'needs' });
    setEditingExpense(null);
    setIsAddingExpense(false);
  };

  const handleCancelForm = () => {
    setExpenseForm({ description: '', amount: '', category: 'needs' });
    setEditingExpense(null);
    setIsAddingExpense(false);
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setExpenseForm({
      description: expense.description,
      amount: expense.amount.toString(),
      category: expense.category,
    });
    setIsAddingExpense(true);
    // Scroll to top where the form is
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteExpense = (id: string) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      setExpenses(expenses.filter(e => e.id !== id));
      if (editingExpense?.id === id) {
        handleCancelForm();
      }
    }
  };

  const getProgressColor = (allocated: number, recommended: number) => {
    const percentage = (allocated / recommended) * 100;
    if (percentage > 100) return 'bg-red-500';
    if (percentage > 90) return 'bg-orange-500';
    return 'bg-green-500';
  };

  const getStatusBadge = (allocated: number, recommended: number) => {
    const percentage = (allocated / recommended) * 100;
    if (percentage > 100) {
      return <Badge className="bg-red-100 text-red-800 border-red-300">Over Budget</Badge>;
    }
    if (percentage > 90) {
      return <Badge className="bg-orange-100 text-orange-800 border-orange-300">Near Limit</Badge>;
    }
    if (percentage < 1) {
      return <Badge className="bg-gray-100 text-gray-800 border-gray-300">Not Started</Badge>;
    }
    return <Badge className="bg-green-100 text-green-800 border-green-300">On Track</Badge>;
  };

  // Chart data for bar chart comparison
  const barChartData = [
    {
      name: 'Needs',
      Recommended: recommendations.needs,
      Allocated: totals.needsTotal,
    },
    {
      name: 'Wants',
      Recommended: recommendations.wants,
      Allocated: totals.wantsTotal,
    },
    {
      name: 'Savings',
      Recommended: recommendations.savings,
      Allocated: totals.savingsTotal,
    },
  ];

  if (netIncome === 0) {
    return (
      <TooltipProvider>
        <EmptyState
          icon={emptyStateConfigs.budgeting.icon}
          title={emptyStateConfigs.budgeting.title}
          description={emptyStateConfigs.budgeting.description}
          actionLabel={emptyStateConfigs.budgeting.actionLabel}
          onAction={onEmptyStateAction || (() => navigate('/profile?tab=personal'))}
          iconColor={emptyStateConfigs.budgeting.iconColor}
          iconBgColor={emptyStateConfigs.budgeting.iconBgColor}
          buttonColor={emptyStateConfigs.budgeting.buttonColor}
          buttonHoverColor={emptyStateConfigs.budgeting.buttonHoverColor}
        />
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        {/* Income Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Budgeting Summary</CardTitle>
            <CardDescription>Your monthly income breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Gross Income</p>
                <p className="text-2xl text-gray-900">{formatCurrency(grossIncome)}</p>
              </div>
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Net Income</p>
                <p className="text-2xl text-gray-900">{formatCurrency(netIncome)}</p>
              </div>
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Total Allocated</p>
                <p className={`text-2xl ${totals.total > netIncome ? 'text-red-600' : 'text-[#6d28d9]'}`}>
                  {formatCurrency(totals.total)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Budget Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(['needs', 'wants', 'savings'] as const).map((category) => {
            const info = CATEGORY_INFO[category];
            const Icon = info.icon;
            const allocated = category === 'needs' ? totals.needsTotal : category === 'wants' ? totals.wantsTotal : totals.savingsTotal;
            const recommended = category === 'needs' ? recommendations.needs : category === 'wants' ? recommendations.wants : recommendations.savings;
            const categoryRemaining = recommended - allocated;
            const percentage = recommended > 0 ? (allocated / recommended) * 100 : 0;

            return (
              <Card key={category} className="relative overflow-hidden">
                <div 
                  className="absolute top-0 left-0 right-0 h-1" 
                  style={{ backgroundColor: info.color }}
                />
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${info.color}15` }}
                      >
                        <Icon className="h-6 w-6" style={{ color: info.color }} />
                      </div>
                      <div>
                        <CardTitle className="text-base">{info.name}</CardTitle>
                        <p className="text-sm text-gray-500">{info.percentage}% of income</p>
                      </div>
                    </div>
                    {getStatusBadge(allocated, recommended)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Recommended</span>
                      <span className="text-gray-900">{formatCurrency(recommended)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Allocated</span>
                      <span className="text-gray-900">{formatCurrency(allocated)}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Remaining</span>
                      <span className={categoryRemaining < 0 ? 'text-red-600' : 'text-green-600'}>
                        {formatCurrency(Math.abs(categoryRemaining))}
                        {categoryRemaining < 0 && ' over'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${getProgressColor(allocated, recommended)}`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5 text-center">
                      {percentage.toFixed(0)}% used
                    </p>
                  </div>

                  {/* Helpful Tip */}
                  <Alert className="bg-blue-50 border-blue-200">
                    <Lightbulb className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-sm text-blue-800">
                      <strong>Tip:</strong> {info.tip}
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Add/Edit Expense Form */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {isAddingExpense ? (editingExpense ? 'Edit Expense' : 'Add New Expense') : 'Your Expenses'}
                </CardTitle>
                <CardDescription>
                  {isAddingExpense 
                    ? 'Fill in the details below to track your expense' 
                    : `${expenses.length} ${expenses.length === 1 ? 'expense' : 'expenses'} tracked • ${formatCurrency(totals.total)} total`
                  }
                </CardDescription>
              </div>
              {!isAddingExpense && (
                <Button 
                  onClick={() => setIsAddingExpense(true)}
                  className="bg-[#6d28d9] hover:bg-[#5b21b6]"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Expense
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isAddingExpense && (
              <div className="p-5 rounded-lg border-2 border-[#6d28d9] bg-white shadow-sm space-y-4">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-base text-gray-900">
                    {editingExpense ? 'Edit Expense Details' : 'New Expense Details'}
                  </h3>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleCancelForm}
                      variant="outline"
                      size="sm"
                      className="border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveExpense}
                      size="sm"
                      className="bg-[#6d28d9] text-white hover:bg-[#5b21b6] disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!expenseForm.amount || parseFloat(cleanCurrencyInput(expenseForm.amount)) <= 0}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expenseCategory">Category *</Label>
                    <Select
                      value={expenseForm.category}
                      onValueChange={(value: 'needs' | 'wants' | 'savings') => 
                        setExpenseForm({ ...expenseForm, category: value })
                      }
                    >
                      <SelectTrigger id="expenseCategory">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="needs">
                          <div className="flex items-center gap-2">
                            <Home className="h-4 w-4 text-blue-600" />
                            <span>Needs</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="wants">
                          <div className="flex items-center gap-2">
                            <Coffee className="h-4 w-4 text-purple-600" />
                            <span>Wants</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="savings">
                          <div className="flex items-center gap-2">
                            <PiggyBank className="h-4 w-4 text-green-600" />
                            <span>Savings & Debt</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expenseDescription">Description *</Label>
                    <Input
                      id="expenseDescription"
                      value={expenseForm.description}
                      onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                      placeholder={`e.g., ${CATEGORY_INFO[expenseForm.category].examples[0]}`}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expenseAmount">Monthly Amount (Rands) *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R</span>
                      <Input
                        id="expenseAmount"
                        type="text"
                        value={expenseForm.amount || ''}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9.]/g, '');
                          setExpenseForm({ ...expenseForm, amount: raw });
                        }}
                        className="pl-8"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                <Alert className="bg-blue-50 border-blue-200">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-sm text-blue-800">
                    <strong>Budget Impact:</strong> {formatCurrency(Math.max(0, 
                      (expenseForm.category === 'needs' ? recommendations.needs - totals.needsTotal : 
                       expenseForm.category === 'wants' ? recommendations.wants - totals.wantsTotal : 
                       recommendations.savings - totals.savingsTotal) - 
                      (parseFloat(cleanCurrencyInput(expenseForm.amount)) || 0)
                    ))} remaining in {CATEGORY_INFO[expenseForm.category].name}
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* All Expenses by Category */}
            {expenses.length === 0 && !isAddingExpense ? (
              <div className="text-center py-12 px-6">
                <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-[#6d28d9] to-[#5b21b6] flex items-center justify-center mb-4">
                  <Wallet className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg text-gray-900 mb-2">No Expenses Yet</h3>
                <p className="text-sm text-gray-600 mb-4 max-w-md mx-auto">
                  Start tracking your expenses to see how they align with the 50-30-20 budgeting rule.
                </p>
                <Button 
                  onClick={() => setIsAddingExpense(true)}
                  className="bg-[#6d28d9] hover:bg-[#5b21b6]"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Expense
                </Button>
              </div>
            ) : !isAddingExpense && (
              <div className="space-y-6">
                {(['needs', 'wants', 'savings'] as const).map((category) => {
                  const categoryExpenses = expenses.filter(e => e.category === category);
                  if (categoryExpenses.length === 0) return null;

                  const info = CATEGORY_INFO[category];
                  const Icon = info.icon;
                  const allocated = categoryExpenses.reduce((sum, e) => sum + e.amount, 0);

                  return (
                    <div key={category}>
                      <div className="flex items-center gap-2 mb-3">
                        <div
                          className="h-8 w-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${info.color}15` }}
                        >
                          <Icon className="h-4 w-4" style={{ color: info.color }} />
                        </div>
                        <h3 className="text-base text-gray-900">
                          {info.name} • {categoryExpenses.length} {categoryExpenses.length === 1 ? 'expense' : 'expenses'}
                        </h3>
                        <span className="text-sm text-gray-600">
                          ({formatCurrency(allocated)})
                        </span>
                      </div>
                      <div className="space-y-2">
                        {categoryExpenses.map((expense) => (
                          <div
                            key={expense.id}
                            className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-[#6d28d9] transition-colors group"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div
                                className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: `${info.color}15` }}
                              >
                                <Icon className="h-5 w-5" style={{ color: info.color }} />
                              </div>
                              <p className="text-sm text-gray-900 truncate flex-1">{expense.description}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <p className="text-base text-gray-900 mr-2">
                                {formatCurrency(expense.amount)}
                              </p>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => handleEditExpense(expense)}
                                >
                                  <Edit2 className="h-4 w-4 text-gray-500" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => handleDeleteExpense(expense.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-gray-500" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Charts */}
        {expenses.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recommended vs Actual */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-[#6d28d9]" />
                  Recommended vs Actual
                </CardTitle>
                <CardDescription>Compare your allocation to the 50-30-20 rule</CardDescription>
              </CardHeader>
              <CardContent>
                <SVGBarChart
                  data={barChartData}
                  categoryKey="name"
                  series={[
                    { key: 'Recommended', label: 'Recommended', color: '#cbd5e1' },
                    { key: 'Allocated', label: 'Allocated', color: '#6d28d9' },
                  ]}
                  tooltipFormatter={(v) => formatCurrency(v)}
                  yAxisFormatter={(v) => `R${(v / 1000).toFixed(0)}k`}
                />
              </CardContent>
            </Card>

            {/* Budget Health */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-[#6d28d9]" />
                  Budget Health
                </CardTitle>
                <CardDescription>Your financial wellness score</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">Total Budget Usage</span>
                      <span className="text-gray-900">
                        {((totals.total / netIncome) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${
                          totals.total > netIncome ? 'bg-red-500' : 'bg-[#6d28d9]'
                        }`}
                        style={{ width: `${Math.min((totals.total / netIncome) * 100, 100)}%` }}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    {(['needs', 'wants', 'savings'] as const).map((category) => {
                      const info = CATEGORY_INFO[category];
                      const allocated = category === 'needs' ? totals.needsTotal : category === 'wants' ? totals.wantsTotal : totals.savingsTotal;
                      const recommended = category === 'needs' ? recommendations.needs : category === 'wants' ? recommendations.wants : recommendations.savings;
                      const percentage = recommended > 0 ? (allocated / recommended) * 100 : 0;

                      return (
                        <div key={category} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: info.color }}
                            />
                            <span className="text-gray-600">{info.name}</span>
                          </div>
                          <span className={percentage > 100 ? 'text-red-600' : 'text-gray-900'}>
                            {percentage.toFixed(0)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Alert className={
                  totals.total > netIncome 
                    ? 'bg-red-50 border-red-200' 
                    : remaining.total > netIncome * 0.1
                    ? 'bg-orange-50 border-orange-200'
                    : 'bg-green-50 border-green-200'
                }>
                  {totals.total > netIncome ? (
                    <div className="contents">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-sm text-red-800">
                        You're spending more than you earn. Review your expenses immediately.
                      </AlertDescription>
                    </div>
                  ) : remaining.total > netIncome * 0.1 ? (
                    <div className="contents">
                      <Info className="h-4 w-4 text-orange-600" />
                      <AlertDescription className="text-sm text-orange-800">
                        You have {formatCurrency(remaining.total)} unallocated. Consider allocating it to savings.
                      </AlertDescription>
                    </div>
                  ) : (
                    <div className="contents">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-sm text-green-800">
                        Your budget is well balanced. Keep up the great work!
                      </AlertDescription>
                    </div>
                  )}
                </Alert>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Analysis & Recommendations */}
        {analysis && analysis.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-[#6d28d9]" />
                Insights & Recommendations
              </CardTitle>
              <CardDescription>Personalized advice for your budget</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analysis.map((insight, index) => (
                  <Alert
                    key={index}
                    className={
                      insight.type === 'error'
                        ? 'bg-red-50 border-red-200'
                        : insight.type === 'warning'
                        ? 'bg-orange-50 border-orange-200'
                        : insight.type === 'success'
                        ? 'bg-green-50 border-green-200'
                        : 'bg-blue-50 border-blue-200'
                    }
                  >
                    {insight.type === 'error' && <AlertTriangle className={`h-5 w-5 text-red-600`} />}
                    {insight.type === 'warning' && <AlertCircle className={`h-5 w-5 text-orange-600`} />}
                    {insight.type === 'success' && <CheckCircle className={`h-5 w-5 text-green-600`} />}
                    {insight.type === 'info' && <Info className={`h-5 w-5 text-blue-600`} />}
                    <AlertDescription
                      className={
                        insight.type === 'error'
                          ? 'text-red-800'
                          : insight.type === 'warning'
                          ? 'text-orange-800'
                          : insight.type === 'success'
                          ? 'text-green-800'
                          : 'text-blue-800'
                      }
                    >
                      <strong
                        className={
                          insight.type === 'error'
                            ? 'text-red-900'
                            : insight.type === 'warning'
                            ? 'text-orange-900'
                            : insight.type === 'success'
                            ? 'text-green-900'
                            : 'text-blue-900'
                        }
                      >
                        {insight.title}:
                      </strong>{' '}
                      {insight.message}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}