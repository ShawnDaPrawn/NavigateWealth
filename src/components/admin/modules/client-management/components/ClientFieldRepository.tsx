import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/table';
import { ScrollArea } from '../../../../ui/scroll-area';
import { Badge } from '../../../../ui/badge';
import { Search, Copy } from 'lucide-react';
import { Input } from '../../../../ui/input';
import { Button } from '../../../../ui/button';
import { toast } from 'sonner@2.0.3';
import { copyToClipboard as copyToClipboardUtil } from '../../../../../utils/clipboard';

interface FieldDefinition {
  id: string;
  path: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  example?: string;
  source?: string;
}

export const FIELD_DEFINITIONS: FieldDefinition[] = [
  // Personal Information
  { id: 'firstName', path: 'personalInformation.firstName', description: "Client's first name", type: 'string', example: 'John' },
  { id: 'lastName', path: 'personalInformation.lastName', description: "Client's surname", type: 'string', example: 'Doe' },
  { id: 'dateOfBirth', path: 'personalInformation.dateOfBirth', description: "Date of birth (ISO format)", type: 'date', example: '1980-01-01' },
  { id: 'age', path: 'personalInformation.age', description: "Current Age (Derived from Date of Birth)", type: 'number', source: 'Calculated automatically', example: '45' },
  { id: 'idNumber', path: 'personalInformation.idNumber', description: "South African ID Number", type: 'string', example: '8001015009087' },
  { id: 'passportNumber', path: 'personalInformation.passportNumber', description: "Passport Number (if applicable)", type: 'string' },
  { id: 'maritalStatus', path: 'personalInformation.maritalStatus', description: "Marital status", type: 'string', example: 'Married' },
  { id: 'spouseName', path: 'personalInformation.spouseName', description: "Spouse's full name", type: 'string' },
  { id: 'spouseDateOfBirth', path: 'personalInformation.spouseDateOfBirth', description: "Spouse's date of birth", type: 'date' },
  { id: 'spouseIncome', path: 'personalInformation.spouseIncome', description: "Spouse's monthly income", type: 'number' },
  { id: 'gender', path: 'personalInformation.gender', description: "Gender", type: 'string', example: 'Male' },
  
  // Contact Information
  { id: 'email', path: 'personalInformation.email', description: "Email address", type: 'string', example: 'john@example.com' },
  { id: 'phone', path: 'personalInformation.cellphone', description: "Cellphone number", type: 'string', example: '+27821234567' },
  
  // Employment & Income
  { id: 'grossIncome', path: 'employmentInformation.grossIncome', description: "Gross monthly income", type: 'number', source: 'Also checked at root: grossIncome' },
  { id: 'netIncome', path: 'employmentInformation.netIncome', description: "Net monthly income", type: 'number', source: 'Also checked at root: netIncome' },
  { id: 'occupation', path: 'employmentInformation.occupation', description: "Current occupation", type: 'string' },
  { id: 'employer', path: 'employmentInformation.employer', description: "Current employer", type: 'string' },
  { id: 'grossMonthlyIncome', path: 'employmentInformation.grossMonthlyIncome', description: "Gross monthly income (Primary)", type: 'number', source: 'Root: grossMonthlyIncome' },
  { id: 'netMonthlyIncome', path: 'employmentInformation.netMonthlyIncome', description: "Net monthly income (Primary)", type: 'number', source: 'Root: netMonthlyIncome' },
  { id: 'grossAnnualIncome', path: 'employmentInformation.grossAnnualIncome', description: "Gross annual income", type: 'number', source: 'Root: grossAnnualIncome' },
  { id: 'netAnnualIncome', path: 'employmentInformation.netAnnualIncome', description: "Net annual income", type: 'number', source: 'Root: netAnnualIncome' },
  
  // Financial Information
  { id: 'monthlyEssentialExpenses', path: 'financialInformation.monthlyEssentialExpenses', description: "Essential monthly expenses", type: 'number' },
  { id: 'monthlyTotalExpenses', path: 'financialInformation.monthlyTotalExpenses', description: "Total monthly expenses", type: 'number' },
  { id: 'monthlyRetirementSaving', path: 'financialInformation.monthlyRetirementSaving', description: "Monthly retirement contribution", type: 'number' },
  { id: 'expectedRetirementAge', path: 'personalInformation.expectedRetirementAge', description: "Expected retirement age", type: 'number', example: '65' },

  // Arrays / Collections
  { id: 'familyMembers', path: 'familyMembers', description: "List of family members/dependants", type: 'array' },
  { id: 'liabilities', path: 'liabilities', description: "List of debts and liabilities", type: 'array' },
  { id: 'assets', path: 'assets', description: "List of assets", type: 'array' },
  
  // Nested Objects (inside Arrays)
  { id: 'dependantName', path: 'familyMembers[].fullName', description: "Family member name", type: 'string' },
  { id: 'dependantRelation', path: 'familyMembers[].relationship', description: "Relationship to client", type: 'string' },
  { id: 'dependantDependency', path: 'familyMembers[].isFinanciallyDependent', description: "Is financially dependent?", type: 'boolean' },
  
  { id: 'liabilityType', path: 'liabilities[].type', description: "Type of liability (e.g., Bond, Vehicle)", type: 'string' },
  { id: 'liabilityBalance', path: 'liabilities[].outstandingBalance', description: "Outstanding balance amount", type: 'number' },
  
  { id: 'assetType', path: 'assets[].type', description: "Type of asset", type: 'string' },
  { id: 'assetValue', path: 'assets[].value', description: "Current value of asset", type: 'number' },
];

interface ClientFieldRepositoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClientFieldRepository({ open, onOpenChange }: ClientFieldRepositoryProps) {
  const [search, setSearch] = React.useState('');

  const filteredFields = FIELD_DEFINITIONS.filter(field => 
    field.id.toLowerCase().includes(search.toLowerCase()) ||
    field.path.toLowerCase().includes(search.toLowerCase()) ||
    field.description.toLowerCase().includes(search.toLowerCase())
  );

  const copyToClipboard = async (text: string) => {
    try {
      await copyToClipboardUtil(text);
      toast.success('Field path copied to clipboard');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      toast.error('Failed to copy to clipboard');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Client Profile Field Repository</DialogTitle>
          <DialogDescription>
            Reference for identifier fields used in the Personal Client Profile (Key-Value Store).
            Use these paths when mapping data across the application.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex items-center gap-2 py-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search fields..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
        </div>

        <div className="flex-1 min-h-0 border rounded-md overflow-hidden">
          <ScrollArea className="h-full">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur-sm">
                <TableRow>
                  <TableHead>Field ID</TableHead>
                  <TableHead>KV Path</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
              {filteredFields.map((field) => (
                <TableRow key={field.id}>
                  <TableCell className="font-medium font-mono text-xs">{field.id}</TableCell>
                  <TableCell className="font-mono text-xs text-blue-600 dark:text-blue-400">
                    {field.path}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs font-normal">
                      {field.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {field.description}
                    {field.source && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Note: {field.source}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Copy path ${field.path}`}
                      className="h-8 w-8"
                      onClick={() => copyToClipboard(field.path)}
                      title="Copy Path"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredFields.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No fields found matching "{search}"
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </ScrollArea>
        </div>
        
        <div className="text-xs text-muted-foreground pt-4">
          <strong>Usage:</strong> These fields are stored in the Key-Value store under the key format <code>user_profile:{'{userId}'}:personal_info</code>.
        </div>
      </DialogContent>
    </Dialog>
  );
}