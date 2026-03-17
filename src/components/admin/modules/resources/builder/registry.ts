/**
 * Block Registry — entry-point that imports and registers every block.
 *
 * The store itself (BlockDefinition, BLOCK_REGISTRY, registerBlock,
 * getBlockDefinition) lives in block-store.ts to avoid circular
 * dependencies when a block needs to look up sibling blocks at runtime
 * (e.g. ContainerBlock rendering nested children).
 *
 * All public symbols are re-exported here so existing consumers do not
 * need to change their imports.
 */

// Re-export everything from the store so existing imports stay valid
export type { BlockDefinition } from './block-store';
export { BLOCK_REGISTRY, registerBlock, getBlockDefinition } from './block-store';

import { registerBlock } from './block-store';

// ============================================================================
// Import all block definitions
// ============================================================================
import { SpacerBlock } from './blocks/SpacerBlock';
import { SectionHeaderBlock } from './blocks/SectionHeaderBlock';
import { TextBlock } from './blocks/TextBlock';
import { ImageBlock } from './blocks/ImageBlock';
import { FieldGridBlock } from './blocks/FieldGridBlock';
import { RadioOptionsBlock } from './blocks/RadioOptionsBlock';
import { SignatureBlock } from './blocks/SignatureBlock';
import { InstructionalCalloutBlock } from './blocks/InstructionalCalloutBlock';
import { CombInputBlock } from './blocks/CombInputBlock';
import { PageBreakBlock } from './blocks/PageBreakBlock';
import { BankDetailsBlock } from './blocks/BankDetailsBlock';
import { BeneficiaryTableBlock } from './blocks/BeneficiaryTableBlock';
import { FinancialTableBlock } from './blocks/FinancialTableBlock';
import { WitnessSignatureBlock } from './blocks/WitnessSignatureBlock';
import { AddressBlock } from './blocks/AddressBlock';
import { ClientSummaryBlock } from './blocks/ClientSummaryBlock';
import { ComplianceQuestionBlock } from './blocks/ComplianceQuestionBlock';
import { RiskProfileBlock } from './blocks/RiskProfileBlock';
import { FinePrintBlock } from './blocks/FinePrintBlock';
import { OfficeUseBlock } from './blocks/OfficeUseBlock';
import { ClauseInitialBlock } from './blocks/ClauseInitialBlock';
import { AttachmentPlaceholderBlock } from './blocks/AttachmentPlaceholderBlock';
import { CheckboxTableBlock } from './blocks/CheckboxTableBlock';
import { TableBlock } from './blocks/TableBlock';
import { RepeaterBlock } from './blocks/RepeaterBlock';
import { SmartClauseBlock } from './blocks/SmartClauseBlock';
import { ContainerBlock } from './blocks/ContainerBlock';
import { NonBreakingSignatureBlock } from './blocks/NonBreakingSignatureBlock';

// ============================================================================
// Register all blocks
// ============================================================================
registerBlock(SpacerBlock);
registerBlock(SectionHeaderBlock);
registerBlock(TextBlock);
registerBlock(ImageBlock);
registerBlock(FieldGridBlock);
registerBlock(RadioOptionsBlock);
registerBlock(SignatureBlock);
registerBlock(InstructionalCalloutBlock);
registerBlock(CombInputBlock);
registerBlock(CheckboxTableBlock);
registerBlock(TableBlock);
registerBlock(RepeaterBlock);
registerBlock(SmartClauseBlock);
registerBlock(ContainerBlock);
registerBlock(NonBreakingSignatureBlock);
registerBlock(PageBreakBlock);
registerBlock(BankDetailsBlock);
registerBlock(BeneficiaryTableBlock);
registerBlock(FinancialTableBlock);
registerBlock(WitnessSignatureBlock);
registerBlock(AddressBlock);
registerBlock(ClientSummaryBlock);
registerBlock(ComplianceQuestionBlock);
registerBlock(RiskProfileBlock);
registerBlock(FinePrintBlock);
registerBlock(OfficeUseBlock);
registerBlock(ClauseInitialBlock);
registerBlock(AttachmentPlaceholderBlock);