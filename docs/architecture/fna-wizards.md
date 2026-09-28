# FNA and INA wizards

**What this is.** How the six adviser analysis wizards (Risk Planning, Medical
Aid, Retirement Planning, Tax Planning, Investment Needs Analysis, Estate
Planning) are built, and the rules that keep them looking, behaving and reading
the client the same way. Read it before changing any of them or adding a
seventh.

## One shell, one flow

Every wizard runs the same four steps, defined once in
`src/components/admin/modules/fna/wizard/fnaWizardFlow.ts`:

| Step | Title                     | What happens                                        |
| ---- | ------------------------- | --------------------------------------------------- |
| 1    | Information Gathering     | Client data, prefilled from the client keys         |
| 2    | System Auto-Calculation   | Formula-driven results; nothing editable            |
| 3    | Adviser Manual Adjustment | Overrides, each with a recorded reason              |
| 4    | Finalise & Publish        | Review, adviser notes, publish to the client record |

A wizard may give each step its own one-line description
(`buildFNAWizardSteps`), but not its own titles, order or navigation labels.

The pieces every wizard uses, all exported from the `fna` module barrel:

- `FNAWizardShell` — the dialog, the "&lt;analysis&gt; — &lt;client&gt;" header, the
  stepper, the scrolling body and the publishing overlay.
- `FNAStepNavigation` — the footer each step ends with: "Back to &lt;previous
  step&gt;" on the left, the step's primary action on the right. The client
  intake portal reuses the Step 1 forms and is the only caller that relabels
  the primary action.
- `useFNAPublish` — the Step 4 sequence: publishing flag, success and failure
  messages, `onFNAComplete(fnaId)`, close.
- `FNAAssumptionOverrides` — the Step 3 table for analyses whose adjustment is
  an assumption override (Investment INA, Estate). Any change needs a reason
  of at least ten characters.
- `resolveInitialFNAStep` — where a wizard opens. Step 1, unless an accepted
  client intake is supplied, in which case Step 2 with the calculation already
  run.

Every wizard takes the same props, `FNAWizardProps`, so the FNA registry
(`profile-sections/fna-config.ts`) and the intake hand-off
(`client-management/components/IntakeWizardHandoff.tsx`) treat all six
identically. The registry mounts a wizard only while it is open, so each
session starts on Step 1 with fresh state.

## One way to read the client

**Client keys** — single named values such as age, gross income, marital
status, total life cover or medical aid premium — reach a Step 1 form only
through the shared review prefill, `useFormPrefill` in the `form-prefill`
module. It asks the server resolver (`form-prefill-resolver.ts`) for matches
against `src/shared/form-prefill/form-field-registry.ts`, and the adviser
reviews them before anything is applied. "Load from policies" recalculates the
client's keys from their saved policies and opens the same review. No wizard
reads the client keys, the profile or the policies for these values itself.

The keys the analyses share are declared once, in `FNA_CLIENT_KEYS`: one
canonical key, one label. A form maps its own field name onto a shared key with
`clientKey()`. Where a form's field is an enum (marital status for Tax and
Estate, hospital cover for Medical), the resolver shapes the one value into
that form's vocabulary; the form does not get a canonical key of its own.

**Client records** — lists, which the prefill cannot carry — come from the
analysis's auto-populate endpoint, and only the list fields are taken from it:
discretionary investments for the INA; assets, liabilities, life policies and
dependants for Estate.

Two tests hold this in place:

- `src/shared/form-prefill/__tests__/fna-client-keys.test.ts` — a canonical key
  has the same label wherever it is used, and any key used by two analyses is
  declared in `FNA_CLIENT_KEYS`.
- `src/components/admin/modules/fna/__tests__/fnaClientKeyFields.test.ts` —
  every mapped field exists on that analysis's Step 1. A mapping for a missing
  field shows the adviser a match and then silently drops it.

## Adding or changing a wizard

- Render inside `FNAWizardShell`; end every step with `FNAStepNavigation`;
  publish through `useFNAPublish`.
- Take `FNAWizardProps` and nothing else from callers.
- Add client values to the registry, not to the wizard. Reuse a shared key if
  the fact is shared; add it to `FNA_CLIENT_KEYS` the moment a second analysis
  needs it.
