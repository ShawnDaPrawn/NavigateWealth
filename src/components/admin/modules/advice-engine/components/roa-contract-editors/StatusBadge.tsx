/**
 * The contract status pill.
 *
 * Its own file because both RoAModuleContractManager and PreviewPanel render it,
 * and duplicating a status vocabulary is how two views start disagreeing.
 */
import { Badge } from '../../../../../ui/badge';
import type { RoAModuleContract } from '../../types';

export function getStatusBadge(contract: RoAModuleContract) {
  if (contract.status === 'active') {
    return <Badge className="bg-green-100 text-green-700 border-green-200">Active</Badge>;
  }
  if (contract.status === 'archived') {
    return (
      <Badge variant="outline" className="bg-slate-100 text-slate-600">
        Archived
      </Badge>
    );
  }
  return <Badge variant="secondary">Draft</Badge>;
}
