import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useAuth } from '../auth/AuthContext';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';
import { 
  FileText, 
  Download, 
  Eye, 
  Search,
  Filter,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  CreditCard,
  Shield,
  Heart,
  Target,
  TrendingUp,
  Briefcase,
  Calculator,
  Users,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  Files,
  ChevronDown
} from 'lucide-react';

interface DocumentItem {
  id: string;
  userId: string;
  type: 'document' | 'link';
  title: string;
  uploadDate: string;
  productCategory: string;
  policyNumber: string;
  status: 'new' | 'viewed';
  isFavourite: boolean;
  uploadedBy: string;
  // Grouping
  packId?: string;
  packTitle?: string;
  // Document specific
  fileName?: string;
  fileSize?: number;
  filePath?: string;
  // Link specific
  url?: string;
  description?: string;
}

export function TransactionsDocumentsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('transactions');
  
  // Real Data State
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedPacks, setExpandedPacks] = useState<Set<string>>(new Set());

  // Filter State
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  useEffect(() => {
    if (user?.id && activeTab === 'documents') {
      fetchDocuments();
    }
  }, [user?.id, activeTab]);

  const fetchDocuments = async () => {
    if (!user?.id) return;

    const maxRetries = 2;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        setLoading(true);
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/documents/${user.id}`,
          {
            headers: { 'Authorization': `Bearer ${publicAnonKey}` }
          }
        );

        if (!response.ok) throw new Error('Failed to fetch documents');

        const data = await response.json();
        // Sort by upload date, newest first
        const sortedDocs = data.documents.sort((a: DocumentItem, b: DocumentItem) => 
          new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
        );
        setDocuments(sortedDocs);
        return; // Success — exit retry loop
      } catch (error) {
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
          continue;
        }
        console.error('Error fetching documents after retries:', error);
        toast.error('Failed to load documents');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDownload = async (doc: DocumentItem) => {
    if (doc.type === 'link') {
      window.open(doc.url, '_blank');
      return;
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/documents/${doc.userId}/${doc.id}/download`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (!response.ok) throw new Error('Failed to get download URL');
      const data = await response.json();
      window.open(data.url, '_blank');
    } catch (error) {
      console.error('Error downloading:', error);
      toast.error('Failed to download document');
    }
  };

  const togglePack = (packId: string) => {
    const newSet = new Set(expandedPacks);
    if (newSet.has(packId)) newSet.delete(packId);
    else newSet.add(packId);
    setExpandedPacks(newSet);
  };

  // Group documents logic
  const getGroupedDocuments = () => {
    const groupedItems: (DocumentItem | { type: 'pack', id: string, title: string, documents: DocumentItem[], category: string, date: string })[] = [];
    const processedPackIds = new Set<string>();

    documents.forEach(doc => {
      if (doc.packId && documents.filter(d => d.packId === doc.packId).length > 1) {
        if (!processedPackIds.has(doc.packId)) {
          processedPackIds.add(doc.packId);
          const packDocs = documents.filter(d => d.packId === doc.packId);
          const sortedPackDocs = [...packDocs].sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));

          groupedItems.push({
            type: 'pack',
            id: doc.packId,
            title: doc.packTitle || doc.title.replace(/\s\(\d+\)$/, ''),
            documents: sortedPackDocs,
            category: doc.productCategory,
            date: doc.uploadDate
          });
        }
      } else if (!doc.packId || !processedPackIds.has(doc.packId)) {
        groupedItems.push(doc);
      }
    });
    return groupedItems;
  };

  const groupedDocuments = getGroupedDocuments();

  // Calculate real counts for categories
  const getCategoryCount = (cat: string) => documents.filter(d => d.productCategory === cat).length;

  // Formatting helpers
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };
  
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getCategoryColor = (category: string) => {
     switch (category) {
       case 'Life': return 'bg-red-50 text-red-700';
       case 'Short-Term': return 'bg-blue-50 text-blue-700';
       case 'Investment': return 'bg-green-50 text-green-700';
       case 'Medical Aid': return 'bg-purple-50 text-purple-700';
       case 'Retirement': return 'bg-orange-50 text-orange-700';
       case 'Estate': return 'bg-amber-50 text-amber-700';
       default: return 'bg-gray-50 text-gray-700';
     }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Risk Planning': return Shield;
      case 'Medical Aid': return Heart;
      case 'Retirement Planning': return Target;
      case 'Investment Management': return TrendingUp;
      case 'Employee Benefits': return Briefcase;
      case 'Tax Planning': return Calculator;
      case 'Estate Planning': return Users;
      default: return FolderOpen;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-black">Transactions & Documents</h1>
          <p className="text-gray-600 mt-2">
            View your transaction history and access important documents
          </p>
        </div>

        <Tabs defaultValue="transactions" className="space-y-6" onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 bg-gray-100">
            <TabsTrigger 
              value="transactions" 
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Transactions
            </TabsTrigger>
            <TabsTrigger 
              value="documents" 
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white"
            >
              <FileText className="h-4 w-4 mr-2" />
              Documents
            </TabsTrigger>
          </TabsList>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-6">
            {/* Filters */}
            <Card className="bg-white border-gray-200">
              <CardHeader>
                <CardTitle className="text-black">Filter Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  <Button 
                    variant={selectedFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => setSelectedFilter('all')}
                    className={selectedFilter === 'all' ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}
                  >
                    All Transactions
                  </Button>
                  <Button 
                    variant={selectedFilter === 'deposits' ? 'default' : 'outline'}
                    onClick={() => setSelectedFilter('deposits')}
                    className={selectedFilter === 'deposits' ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}
                  >
                    Deposits
                  </Button>
                  <Button 
                    variant={selectedFilter === 'withdrawals' ? 'default' : 'outline'}
                    onClick={() => setSelectedFilter('withdrawals')}
                    className={selectedFilter === 'withdrawals' ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}
                  >
                    Withdrawals
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Transactions List */}
            <Card className="bg-white border-gray-200">
              <CardHeader>
                <CardTitle className="text-black">Recent Transactions</CardTitle>
                <CardDescription>Last 30 days of account activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    {
                      id: 'TXN-2024-001',
                      type: 'Deposit',
                      description: 'Monthly Investment Contribution',
                      account: 'Investment Portfolio',
                      amount: '+R 15,000.00',
                      date: 'Jan 30, 2024',
                      time: '09:30 AM',
                      status: 'Completed',
                      reference: 'AUTO-INV-001'
                    },
                    {
                      id: 'TXN-2024-002',
                      type: 'Purchase',
                      description: 'Satrix Top 40 ETF Units',
                      account: 'Investment Portfolio',
                      amount: '-R 25,000.00',
                      date: 'Jan 29, 2024',
                      time: '10:15 AM',
                      status: 'Completed',
                      reference: 'TRADE-001'
                    },
                    {
                      id: 'TXN-2024-003',
                      type: 'Deposit',
                      description: 'Auto-save Transfer',
                      account: 'Cashback Account',
                      amount: '+R 5,000.00',
                      date: 'Jan 28, 2024',
                      time: '12:00 PM',
                      status: 'Completed',
                      reference: 'AUTO-SAVE-001'
                    },
                    {
                      id: 'TXN-2024-004',
                      type: 'Fee',
                      description: 'Monthly Management Fee',
                      account: 'Investment Portfolio',
                      amount: '-R 124.50',
                      date: 'Jan 28, 2024',
                      time: '11:00 AM',
                      status: 'Completed',
                      reference: 'FEE-001'
                    },
                    {
                      id: 'TXN-2024-005',
                      type: 'Dividend',
                      description: 'Naspers Dividend Payment',
                      account: 'Investment Portfolio',
                      amount: '+R 1,234.00',
                      date: 'Jan 25, 2024',
                      time: '02:30 PM',
                      status: 'Completed',
                      reference: 'DIV-001'
                    }
                  ].map((transaction) => (
                    <div key={transaction.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                            transaction.type === 'Deposit' ? 'bg-green-100 text-green-700' :
                            transaction.type === 'Purchase' ? 'bg-blue-100 text-blue-700' :
                            transaction.type === 'Fee' ? 'bg-red-100 text-red-700' :
                            'bg-purple-100 text-purple-700'
                          }`}>
                            {transaction.type === 'Deposit' ? <ArrowDownLeft className="h-4 w-4" /> :
                             transaction.type === 'Purchase' ? <ArrowUpRight className="h-4 w-4" /> :
                             <CreditCard className="h-4 w-4" />}
                          </div>
                          <div>
                            <div className="font-medium text-black text-sm">{transaction.description}</div>
                            <div className="text-xs text-gray-500">{transaction.account}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-medium text-sm ${
                            transaction.amount.startsWith('+') ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {transaction.amount}
                          </div>
                          <Badge className="bg-green-100 text-green-800 text-xs mt-1">
                            {transaction.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="space-x-4">
                          <span>ID: {transaction.id}</span>
                          <span>Ref: {transaction.reference}</span>
                        </div>
                        <span>{transaction.date} at {transaction.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-6">
            {/* Document Categories */}
            <div className="grid md:grid-cols-4 gap-6">
              {[
                { category: 'Risk Planning', description: 'Life and disability insurance', icon: Shield, color: 'bg-blue-100 text-blue-700' },
                { category: 'Medical Aid', description: 'Medical scheme documents', icon: Heart, color: 'bg-red-100 text-red-700' },
                { category: 'Retirement Planning', description: 'Retirement fund statements', icon: Target, color: 'bg-purple-100 text-purple-700' },
                { category: 'Investment Management', description: 'Portfolio reports and statements', icon: TrendingUp, color: 'bg-green-100 text-green-700' },
                { category: 'Employee Benefits', description: 'Benefits and provident fund', icon: Briefcase, color: 'bg-orange-100 text-orange-700' },
                { category: 'Tax Planning', description: 'IT3(b) and tax certificates', icon: Calculator, color: 'bg-yellow-100 text-yellow-700' },
                { category: 'Estate Planning', description: 'Wills and trust documents', icon: Users, color: 'bg-indigo-100 text-indigo-700' },
                { category: 'General', description: 'Miscellaneous documents', icon: FolderOpen, color: 'bg-gray-100 text-gray-700' }
              ].map((category, index) => {
                const Icon = category.icon;
                const count = getCategoryCount(category.category);
                return (
                  <Card key={index} className="bg-white border-gray-200 hover:shadow-md transition-shadow cursor-pointer">
                    <CardHeader className="text-center">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 ${category.color}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <CardTitle className="text-lg text-black">{category.category}</CardTitle>
                      <CardDescription className="text-sm">{category.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-center">
                      <div className="text-2xl font-bold text-black mb-2">{count}</div>
                      <div className="text-xs text-gray-500">Documents available</div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* All Documents */}
            <Card className="bg-white border-gray-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-black">All Documents</CardTitle>
                    <CardDescription>
                      {loading ? 'Loading...' : `Showing ${groupedDocuments.length} items`}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                   <div className="text-center py-8">Loading documents...</div>
                ) : groupedDocuments.length === 0 ? (
                   <div className="text-center py-8 text-muted-foreground">No documents found</div>
                ) : (
                   <div className="space-y-4">
                     {groupedDocuments.map((item) => {
                        if ('documents' in item) {
                          // PACK RENDER
                          const isExpanded = expandedPacks.has(item.id);
                          return (
                            <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden">
                               <div 
                                 className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 bg-gray-50/50"
                                 onClick={() => togglePack(item.id)}
                               >
                                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                     <Files className="h-5 w-5 text-blue-600" />
                                  </div>
                                  <div className="flex-1">
                                     <h4 className="font-medium text-black">{item.title}</h4>
                                     <div className="flex items-center gap-2 text-xs text-gray-500">
                                       <Badge variant="secondary">{item.documents.length} files</Badge>
                                       <span>{formatDate(item.date)}</span>
                                       <Badge className={`${getCategoryColor(item.category)} border border-transparent`}>{item.category}</Badge>
                                     </div>
                                  </div>
                                  <div>
                                     {isExpanded ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                                  </div>
                               </div>
                               {isExpanded && (
                                 <div className="bg-gray-50 border-t border-gray-200 p-3 pl-8 space-y-2">
                                    {item.documents.map(doc => (
                                       <div key={doc.id} className="flex items-center justify-between p-3 bg-white rounded border border-gray-200">
                                          <div className="flex items-center gap-3">
                                             <FileText className="h-4 w-4 text-gray-400" />
                                             <div>
                                                <p className="text-sm font-medium text-black">{doc.title}</p>
                                                <p className="text-xs text-gray-500">{doc.fileName} • {formatFileSize(doc.fileSize)}</p>
                                             </div>
                                          </div>
                                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDownload(doc); }}>
                                             <Download className="h-4 w-4" />
                                          </Button>
                                       </div>
                                    ))}
                                 </div>
                               )}
                            </div>
                          );
                        } else {
                          // SINGLE DOC RENDER
                          const doc = item;
                          return (
                            <div key={doc.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
                              <div className="flex items-center space-x-4">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${doc.type === 'link' ? 'bg-purple-100' : 'bg-red-100'}`}>
                                  {doc.type === 'link' ? <CreditCard className="h-5 w-5 text-purple-600" /> : <FileText className="h-5 w-5 text-red-600" />}
                                </div>
                                <div>
                                  <div className="font-medium text-black text-sm">{doc.title}</div>
                                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                                    <Badge className={`${getCategoryColor(doc.productCategory)} border border-transparent`}>{doc.productCategory}</Badge>
                                    {doc.type === 'document' && <span>• {formatFileSize(doc.fileSize)}</span>}
                                    <span>• {formatDate(doc.uploadDate)}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Button variant="ghost" size="sm" className="text-purple-600 hover:text-purple-700 hover:bg-purple-50" onClick={() => handleDownload(doc)}>
                                  {doc.type === 'link' ? <ArrowUpRight className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>
                          );
                        }
                     })}
                   </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
