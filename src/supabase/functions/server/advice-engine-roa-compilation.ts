import { ValidationError } from './error.middleware.ts';
import type { RoAModuleContract } from './advice-engine-roa-contract-types.ts';
import type {
  JsonRecord,
  RoAClientSnapshot,
  RoACompiledModule,
  RoACompiledOutput,
  RoACompiledSection,
  RoADraftRecord,
  RoAEvidenceItem,
  RoARecommendationSummary,
} from './advice-engine-roa-draft-types.ts';
import {
  asRecord,
  compactList,
  escapeHtml,
  findDataValue,
  formatLabel,
  hasValue,
  markdownishToHtml,
  readString,
  renderTemplate,
  valueToHumanText,
} from './advice-engine-roa-utils.ts';

function linesFromPairs(pairs: Array<[string, unknown]>): string {
  const lines = pairs
    .filter(([, value]) => hasValue(value))
    .map(([label, value]) => `${label}: ${valueToHumanText(value)}`);
  return lines.length > 0 ? lines.join('\n') : 'No information recorded in this section.';
}

export function buildSourceMap(): Record<string, string> {
  return {
    clientSnapshot: 'user_profile:{clientId}:personal_info',
    clientKeys: 'user_profile:{clientId}:client_keys',
    policies: 'policies:client:{clientId}',
    riskProfile: 'client:{clientId}:risk_profile',
    adviserSnapshot: 'personnel:profile:{adviserId}',
    fnaSummaries: 'fna kv prefixes by client',
  };
}

export function buildDataQuality(snapshot: RoAClientSnapshot): {
  missing: string[];
  warnings: string[];
  completenessScore: number;
} {
  const missing: string[] = [];
  const warnings: string[] = [];
  const personal = snapshot.personalInformation;
  const contact = snapshot.contactInformation;
  const employment = snapshot.employmentInformation;

  const checks: Array<[string, boolean]> = [
    ['Client name', snapshot.displayName !== 'Unknown Client'],
    [
      'ID or passport number',
      !!readString(personal.idNumber, personal.passportNumber, snapshot.profile?.idNumber),
    ],
    ['Date of birth', !!readString(personal.dateOfBirth, snapshot.profile?.dateOfBirth)],
    ['Email address', !!readString(personal.email, contact.email, snapshot.profile?.email)],
    [
      'Cellphone number',
      !!readString(
        personal.cellphone,
        personal.phoneNumber,
        contact.cellphone,
        snapshot.profile?.phoneNumber,
      ),
    ],
    [
      'Residential address',
      Object.keys(asRecord(contact.residentialAddress)).length > 0 ||
        !!readString(snapshot.profile?.residentialAddressLine1),
    ],
    [
      'Employment or occupation',
      !!readString(
        employment.status,
        employment.occupation,
        snapshot.profile?.employmentStatus,
        snapshot.profile?.occupation,
      ),
    ],
    [
      'Risk profile',
      !!snapshot.riskProfile ||
        !!readString(asRecord(snapshot.profile?.riskAssessment).riskCategory),
    ],
  ];

  for (const [label, present] of checks) {
    if (!present) missing.push(label);
  }

  if (snapshot.policies.length === 0) {
    warnings.push('No active policies were found in the policy register for this client.');
  }

  if (!snapshot.clientKeys || Object.keys(snapshot.clientKeys).length === 0) {
    warnings.push('Client financial key totals have not been calculated yet.');
  }

  const completenessScore = Math.round(((checks.length - missing.length) / checks.length) * 100);
  return { missing, warnings, completenessScore };
}

function buildClientProfileSummary(client: RoAClientSnapshot | undefined): RoACompiledSection[] {
  if (!client) {
    return [
      {
        id: 'client_profile_summary',
        title: 'Client Profile Summary',
        content: 'No client profile snapshot is attached to this RoA.',
      },
    ];
  }

  const personal = asRecord(client.personalInformation);
  const contact = asRecord(client.contactInformation);
  const employment = asRecord(client.employmentInformation);
  const financial = asRecord(client.financialInformation);
  const risk = asRecord(client.riskProfile);

  return [
    {
      id: 'client_personal_details',
      title: 'Personal And Contact Details',
      content: linesFromPairs([
        ['Client', client.displayName],
        ['ID or passport', readString(personal.idNumber, personal.passportNumber)],
        ['Date of birth', readString(personal.dateOfBirth)],
        ['Nationality', readString(personal.nationality)],
        ['Marital status', readString(personal.maritalStatus)],
        ['Email', readString(contact.email, personal.email)],
        ['Cellphone', readString(contact.cellphone, personal.cellphone, personal.phoneNumber)],
        ['Residential address', contact.residentialAddress],
      ]),
    },
    {
      id: 'client_family_employment',
      title: 'Family, Employment And Income',
      content: linesFromPairs([
        [
          'Family members or dependants',
          client.familyMembers.length > 0
            ? `${client.familyMembers.length} recorded`
            : 'None recorded',
        ],
        ['Employment status', readString(employment.employmentStatus, employment.status)],
        [
          'Occupation or employer',
          readString(
            employment.occupation,
            employment.employerName,
            employment.selfEmployedCompanyName,
          ),
        ],
        ['Gross monthly income', readString(employment.grossMonthlyIncome, financial.grossIncome)],
        ['Net monthly income', readString(employment.netMonthlyIncome, financial.netIncome)],
        ['Monthly expenses', readString(financial.monthlyExpenses)],
      ]),
    },
    {
      id: 'client_financial_position',
      title: 'Financial Position Snapshot',
      content: linesFromPairs([
        ['Assets recorded', client.assets.length],
        ['Liabilities recorded', client.liabilities.length],
        ['Policies recorded', client.policies.length],
        [
          'Risk profile',
          readString(
            risk.riskCategory,
            risk.category,
            risk.profile,
            asRecord(financial.riskAssessment).riskCategory,
          ),
        ],
        ['Goals or objectives', financial.goals],
      ]),
    },
  ];
}

function buildInformationReliedUpon(
  draft: RoADraftRecord,
  contracts: RoAModuleContract[],
): string[] {
  const sources = new Set<string>();
  if (draft.clientSnapshot)
    sources.add(`Client profile snapshot captured ${draft.clientSnapshot.capturedAt}`);
  if (draft.adviserSnapshot)
    sources.add(`Adviser profile snapshot captured ${draft.adviserSnapshot.capturedAt}`);
  if (draft.clientSnapshot?.policies?.length)
    sources.add(`Policy register (${draft.clientSnapshot.policies.length} active policy records)`);
  if (draft.clientSnapshot?.riskProfile) sources.add('Client risk profile');
  if (draft.clientSnapshot?.clientKeys) sources.add('Client financial key totals');

  for (const contract of contracts) {
    if (!draft.selectedModules.includes(contract.id)) continue;
    for (const inputSource of contract.input.sources) {
      sources.add(
        `${contract.title}: ${inputSource.label}${inputSource.required ? ' (required source)' : ''}`,
      );
    }
  }

  for (const moduleEvidence of Object.values(draft.moduleEvidence || {})) {
    for (const item of Object.values(moduleEvidence || {})) {
      sources.add(`${item.label}: ${item.fileName}`);
    }
  }

  return [...sources];
}

function buildModuleOutputValues(
  contract: RoAModuleContract,
  moduleData: JsonRecord,
  moduleOutput: JsonRecord,
): Array<{ label: string; value: string }> {
  const outputValues = asRecord(moduleOutput.values);
  const fields =
    contract.output.fields.length > 0
      ? contract.output.fields
      : contract.formSchema.sections.flatMap((section) =>
          section.fields.map((field) => ({
            key: field.key,
            label: field.label,
            type: 'string' as const,
            required: Boolean(field.required),
          })),
        );

  return fields.map((field) => ({
    label: field.label || formatLabel(field.key),
    value: valueToHumanText(findDataValue(field.key, outputValues, moduleData)),
  }));
}

function buildModuleSummary(
  contract: RoAModuleContract,
  outputValues: Array<{ label: string; value: string }>,
): string {
  const recordedValues = outputValues.filter((item) => item.value !== 'Not recorded').slice(0, 3);
  if (recordedValues.length === 0) {
    return `${contract.title} has been completed using the configured ${contract.output.normalizedKey} module contract.`;
  }
  return `${contract.title}: ${recordedValues.map((item) => `${item.label} - ${item.value}`).join('; ')}.`;
}

function buildNeedsAndObjectives(draft: RoADraftRecord, modules: RoACompiledModule[]): string[] {
  const clientGoals = asRecord(draft.clientSnapshot?.financialInformation).goals;
  const goals = Array.isArray(clientGoals)
    ? clientGoals.map(valueToHumanText)
    : compactList([valueToHumanText(clientGoals)]);
  return [
    ...goals.filter((goal) => goal !== 'Not recorded'),
    ...modules.map((module) => `Advice need addressed through ${module.title}.`),
  ];
}

function buildScopeAndSynopsis(
  draft: RoADraftRecord,
  modules: RoACompiledModule[],
): { scopeAndPurpose: string; synopsis: string } {
  const clientName = draft.clientSnapshot?.displayName || 'the client';
  const moduleTitles =
    modules.map((module) => module.title).join(', ') || 'the selected advice areas';
  const scopeAndPurpose = `This Record of Advice records the basis of advice provided to ${clientName} in respect of ${moduleTitles}. It reflects the client and adviser snapshots, the information relied upon, the completed module contracts, evidence attached to the draft, and adviser-reviewed module narratives.`;
  const synopsis = `${clientName}'s current position was considered using the available profile, financial, policy and module information. The recommendation is limited to the modules included in this RoA and should be read with the attached evidence, disclosures and implementation steps.`;
  return { scopeAndPurpose, synopsis };
}

function buildReplacementAnalysis(modules: RoACompiledModule[]): RoACompiledSection[] {
  const replacementModules = modules.filter(
    (module) => module.compilerHints?.includeReplacementAnalysis === true,
  );
  if (replacementModules.length === 0) return [];
  return replacementModules.map((module) => ({
    id: `replacement_${module.moduleId}`,
    title: `${module.title} Replacement Analysis`,
    content: [
      `This module has been identified as replacement, comparison or transfer advice and must be reviewed with heightened care.`,
      `Evidence reviewed: ${module.evidence.length > 0 ? module.evidence.map((item) => `${item.label} (${item.fileName})`).join(', ') : 'No evidence recorded'}.`,
      `Key adviser-reviewed points: ${module.summary}`,
      'The client should understand any lost benefits, new exclusions, penalties, tax effects, waiting periods, underwriting changes, and timing risks before implementation.',
    ].join('\n'),
  }));
}

export function buildCanonicalRoACompilation(input: {
  draft: RoADraftRecord;
  contracts: RoAModuleContract[];
  status?: 'draft' | 'final';
  now?: string;
  compilationId?: string;
}): RoACompiledOutput {
  const { draft, contracts, status = 'draft' } = input;
  const now = input.now || new Date().toISOString();
  const contractsById = new Map(contracts.map((contract) => [contract.id, contract]));

  const modules: RoACompiledModule[] = draft.selectedModules.map((moduleId) => {
    const contract = contractsById.get(moduleId);
    if (!contract) throw new ValidationError(`Module contract not found: ${moduleId}`);
    const moduleData = asRecord(draft.moduleData[moduleId]);
    const moduleEvidence = asRecord(draft.moduleEvidence?.[moduleId]) as Record<
      string,
      RoAEvidenceItem
    >;
    const moduleOutput = asRecord(draft.moduleOutputs?.[moduleId]);
    const outputValues = buildModuleOutputValues(contract, moduleData, moduleOutput);
    const evidence = Object.values(moduleEvidence || {}).map((item) => ({
      id: item.id,
      label: item.label,
      fileName: item.fileName,
      type: item.type,
      source: item.source,
      sha256: item.sha256,
      uploadedAt: item.uploadedAt,
    }));
    const tokenContext: JsonRecord = {
      client: draft.clientSnapshot || {},
      adviser: draft.adviserSnapshot || {},
      module: moduleData,
      output: asRecord(moduleOutput.values),
      evidence: moduleEvidence,
      draft,
    };
    const sections = contract.documentSections
      .slice()
      .sort((a, b) => a.order - b.order)
      .filter(
        (section) =>
          contract.compileOrder.length === 0 || contract.compileOrder.includes(section.id),
      )
      .map((section) => ({
        id: section.id,
        title: section.title,
        content: renderTemplate(section.template || section.purpose, tokenContext),
      }));

    return {
      moduleId,
      title: contract.title,
      category: contract.category,
      contractVersion: contract.version,
      contractSchemaVersion: contract.schemaVersion,
      normalizedKey: contract.output.normalizedKey,
      compilerHints: contract.compilerHints,
      summary: buildModuleSummary(contract, outputValues),
      outputValues,
      evidence,
      sections,
      disclosures: contract.disclosures,
    };
  });

  const { scopeAndPurpose, synopsis } = buildScopeAndSynopsis(draft, modules);
  const clientProfileSummary = buildClientProfileSummary(draft.clientSnapshot);
  const informationReliedUpon = buildInformationReliedUpon(draft, contracts);
  const needsAndObjectives = buildNeedsAndObjectives(draft, modules);
  const recommendationSummary: RoARecommendationSummary[] = modules.map((module) => ({
    moduleId: module.moduleId,
    title: module.title,
    category: module.category,
    summary: module.summary,
    outputValues: module.outputValues,
  }));
  const replacementAnalysis = buildReplacementAnalysis(modules);
  const feesCostsConflicts = [
    'All fees, premiums, costs, commissions, platform charges and adviser remuneration disclosed in the relevant module sections and supporting evidence must be checked before finalisation.',
    'The adviser must disclose any actual or potential conflict of interest that could influence the recommendation.',
  ];
  const risksAndDisclosures = Array.from(
    new Set([
      'Recommendations are based on the information available and recorded at the time of advice.',
      'Missing or inaccurate client information may affect the suitability of the advice.',
      ...modules.flatMap((module) => module.disclosures),
    ]),
  );
  const implementationPlan = [
    'Confirm that the client understands the recommendation, risks, costs and alternatives.',
    'Complete provider and compliance documentation required for the selected recommendation.',
    'Do not cancel or replace existing products until replacement cover, transfer or investment instructions are accepted and implementation timing is confirmed.',
    'Schedule the next review after implementation or when the client circumstances change.',
  ];
  const acknowledgements = [
    'The client confirms receipt and understanding of this Record of Advice and the recommendations contained herein.',
    'The client confirms that the information supplied for the purpose of this advice is true and complete to the best of their knowledge.',
    'The adviser confirms this document records the basis of advice, the material information relied upon, and the reasons for the recommendation.',
  ];
  const appendices = [
    ...modules.flatMap((module) =>
      module.evidence.map((item) => `${module.title}: ${item.label} - ${item.fileName}`),
    ),
  ];
  const documentSections: RoACompiledSection[] = [
    {
      id: 'document_control',
      title: 'Document Control',
      content: linesFromPairs([
        ['Draft ID', draft.id],
        ['Status', status],
        ['Version', draft.version],
        ['Generated at', now],
        ['Client', draft.clientSnapshot?.displayName],
        ['Adviser', draft.adviserSnapshot?.displayName],
      ]),
    },
    {
      id: 'adviser_details',
      title: 'Adviser And FSP Details',
      content: linesFromPairs([
        ['Adviser', draft.adviserSnapshot?.displayName],
        ['Email', draft.adviserSnapshot?.email],
        ['Role', draft.adviserSnapshot?.role],
        ['Job title', draft.adviserSnapshot?.jobTitle],
        ['FSP reference', draft.adviserSnapshot?.fspReference],
        ['FSCA status', draft.adviserSnapshot?.fscaStatus],
      ]),
    },
    ...clientProfileSummary,
    { id: 'scope_and_purpose', title: 'Scope And Purpose Of Advice', content: scopeAndPurpose },
    {
      id: 'information_relied_upon',
      title: 'Information Relied Upon',
      content: informationReliedUpon.map((item) => `- ${item}`).join('\n'),
    },
    { id: 'synopsis', title: 'Synopsis Of Current Position', content: synopsis },
    {
      id: 'needs_and_objectives',
      title: 'Needs And Objectives',
      content:
        needsAndObjectives.map((item) => `- ${item}`).join('\n') ||
        'No specific objectives were recorded beyond the selected RoA modules.',
    },
    {
      id: 'recommendation_summary',
      title: 'Recommendation Summary',
      content: recommendationSummary.map((item) => `${item.title}: ${item.summary}`).join('\n'),
    },
    ...replacementAnalysis,
    {
      id: 'fees_costs_conflicts',
      title: 'Fees, Costs, Commission And Conflicts',
      content: feesCostsConflicts.map((item) => `- ${item}`).join('\n'),
    },
    {
      id: 'risks_disclosures',
      title: 'Risks And Important Disclosures',
      content: risksAndDisclosures.map((item) => `- ${item}`).join('\n'),
    },
    {
      id: 'implementation_plan',
      title: 'Implementation Plan',
      content: implementationPlan.map((item) => `- ${item}`).join('\n'),
    },
    {
      id: 'client_acknowledgement',
      title: 'Client Acknowledgement',
      content: acknowledgements.map((item) => `- ${item}`).join('\n'),
    },
    {
      id: 'appendices',
      title: 'Appendices And Evidence',
      content:
        appendices.length > 0
          ? appendices.map((item) => `- ${item}`).join('\n')
          : 'No evidence appendices were recorded.',
    },
  ];

  const compilation: RoACompiledOutput = {
    id: input.compilationId || crypto.randomUUID(),
    draftId: draft.id,
    version: draft.version,
    status,
    generatedAt: now,
    documentControl: {
      draftId: draft.id,
      status,
      version: draft.version,
      moduleContractVersions: Object.fromEntries(
        modules.map((module) => [module.moduleId, module.contractVersion]),
      ),
      moduleContractSchemaVersions: Object.fromEntries(
        modules.map((module) => [module.moduleId, module.contractSchemaVersion ?? '']),
      ),
      canonicalSectionIds: documentSections.map((section) => section.id),
    },
    client: draft.clientSnapshot || null,
    adviser: draft.adviserSnapshot || null,
    scopeAndPurpose,
    synopsis,
    clientProfileSummary,
    informationReliedUpon,
    needsAndObjectives,
    recommendationSummary,
    modules,
    replacementAnalysis,
    feesCostsConflicts,
    risksAndDisclosures,
    implementationPlan,
    acknowledgements,
    appendices,
    documentSections,
    html: '',
  };
  compilation.html = createDocumentHtml(compilation);
  return compilation;
}

function createDocumentHtml(compilation: RoACompiledOutput): string {
  const staticSectionHtml = compilation.documentSections
    .map(
      (section, index) => `
    <section class="roa-section">
      <div class="section-head">
        <span class="num">${String(index + 1).padStart(2, '0')}</span>
        <h2>${escapeHtml(section.title)}</h2>
      </div>
      <div class="text-block">${markdownishToHtml(section.content)}</div>
    </section>
  `,
    )
    .join('');

  const recommendationRows = compilation.recommendationSummary
    .map(
      (item) => `
    <tr>
      <td>${escapeHtml(item.title)}</td>
      <td>${escapeHtml(item.category)}</td>
      <td>${escapeHtml(item.summary)}</td>
    </tr>
  `,
    )
    .join('');

  const moduleHtml = compilation.modules
    .map(
      (module) => `
    <section class="roa-section module">
      <div class="section-head">
        <span class="num">M</span>
        <h2>${escapeHtml(module.title)}</h2>
      </div>
      <p class="muted">Category: ${escapeHtml(module.category)} | Contract v${module.contractVersion} | Output: ${escapeHtml(module.normalizedKey || module.moduleId)}</p>
      ${
        module.outputValues.length > 0
          ? `
        <table>
          <thead><tr><th>Output Field</th><th>Value</th></tr></thead>
          <tbody>${module.outputValues.map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${escapeHtml(item.value)}</td></tr>`).join('')}</tbody>
        </table>
      `
          : ''
      }
      ${module.sections
        .map(
          (section) => `
        <article>
          <h3>${escapeHtml(section.title)}</h3>
          <div class="text-block">${markdownishToHtml(section.content)}</div>
        </article>
      `,
        )
        .join('')}
      ${
        module.disclosures.length > 0
          ? `
        <h3>Module Disclosures</h3>
        <ul>${module.disclosures.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      `
          : ''
      }
    </section>
  `,
    )
    .join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Record of Advice - ${escapeHtml(compilation.client?.displayName || 'Client')}</title>
  <style>
    :root {
      --nw-purple: #6d28d9;
      --ink: #111827;
      --muted: #6b7280;
      --border: #e5e7eb;
      --soft: #f9fafb;
    }
    @page { size: A4; margin: 14mm 12mm 18mm; }
    * { box-sizing: border-box; }
    body { font-family: Inter, "Segoe UI", Arial, sans-serif; color: var(--ink); line-height: 1.48; margin: 0; background: #ffffff; }
    .pdf-preview-container { max-width: 190mm; margin: 0 auto; }
    .top-masthead { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 22px; }
    .masthead-left { font-size: 11px; font-weight: 800; color: #374151; text-transform: uppercase; letter-spacing: 0.2px; }
    .masthead-right { font-size: 10px; color: var(--muted); text-align: right; }
    .cover { margin-bottom: 24px; }
    .doc-title { font-size: 26px; font-weight: 800; color: #312f55; margin: 0 0 6px; }
    .brand-subline { color: var(--muted); font-size: 12px; margin: 0; }
    .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 16px; }
    .meta-cell { border: 1px solid var(--border); background: var(--soft); padding: 8px; border-radius: 6px; }
    .meta-k { display: block; font-size: 9px; color: var(--muted); text-transform: uppercase; }
    .meta-v { display: block; font-size: 11px; font-weight: 700; margin-top: 2px; }
    .roa-section { break-inside: avoid; margin: 18px 0; }
    .section-head { display: flex; gap: 8px; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 5px; margin-bottom: 8px; }
    .section-head .num { color: var(--nw-purple); font-size: 11px; font-weight: 800; }
    h2 { color: #312f55; font-size: 13px; line-height: 1.2; margin: 0; text-transform: uppercase; }
    h3 { color: #374151; font-size: 11px; margin: 12px 0 5px; }
    p, li { font-size: 10.5px; margin: 0 0 5px; }
    ul { margin: 6px 0 0 18px; padding: 0; }
    .muted { color: var(--muted); }
    table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 10px; }
    th, td { border: 1px solid var(--border); padding: 6px; text-align: left; vertical-align: top; }
    th { background: var(--soft); color: #374151; font-weight: 700; }
    .pdf-footer { border-top: 1px solid var(--border); margin-top: 28px; padding-top: 10px; font-size: 9px; color: var(--muted); }
  </style>
</head>
<body>
  <div class="pdf-preview-container">
    <header class="top-masthead">
      <div class="masthead-left">Navigate Wealth | Record of Advice</div>
      <div class="masthead-right">Generated ${escapeHtml(compilation.generatedAt)}<br />Version ${compilation.version} | ${escapeHtml(compilation.status)}</div>
    </header>
    <section class="cover">
      <h1 class="doc-title">Record of Advice</h1>
      <p class="brand-subline">${escapeHtml(compilation.scopeAndPurpose)}</p>
      <div class="meta-grid">
        <div class="meta-cell"><span class="meta-k">Client</span><span class="meta-v">${escapeHtml(compilation.client?.displayName || 'Unknown Client')}</span></div>
        <div class="meta-cell"><span class="meta-k">Adviser</span><span class="meta-v">${escapeHtml(compilation.adviser?.displayName || 'Unknown Adviser')}</span></div>
        <div class="meta-cell"><span class="meta-k">Modules</span><span class="meta-v">${compilation.modules.length}</span></div>
      </div>
    </section>
    ${staticSectionHtml}
    <section class="roa-section">
      <div class="section-head"><span class="num">R</span><h2>Recommendation Summary Table</h2></div>
      <table>
        <thead><tr><th>Module</th><th>Category</th><th>Summary</th></tr></thead>
        <tbody>${recommendationRows}</tbody>
      </table>
    </section>
    ${moduleHtml}
    <footer class="pdf-footer">This document was compiled from the canonical RoA JSON/HTML source and the active module contract versions recorded in document control.</footer>
  </div>
</body>
</html>`;
}
