/**
 * A request template's blocks, drawn in the "Request Completion" board's
 * form. The live page hands blocks to the admin form builder's interactive
 * renderer (InteractiveFormRenderer); this draws the same block types in the
 * board's design and keeps everything that decides what is sent: the same
 * response key for every input (a field's own key or field_<block>_<n>,
 * radio_<block>, chk_<block>_<row>_<col>, comp_<block> and its _details,
 * sig_<block>_<n>, a repeater's variable), the same values, the same
 * conditions on a conditional container, the same sanitising of rich text,
 * and the same "Type your full name to sign:" prompt. Block types the live
 * renderer does not draw are left out here too.
 */
import DOMPurify from 'dompurify';
import { useId, type ReactNode } from 'react';
import { FieldLabel, GroupLegend, OptionGroup } from './RequestCompletionControls';
import { SectionHeading } from './RequestCompletionFields';
import { RequestCompletionIcon } from './RequestCompletionIcons';

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(' ');
}

/** The shape of a template block as the request carries it. */
export interface RequestBlock {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

interface GridField {
  label: string;
  placeholder?: string;
  key?: string;
  required?: boolean;
}

interface RepeaterColumn {
  header: string;
  key: string;
  width?: string;
}

interface BlocksProps {
  blocks: RequestBlock[];
  responses: Record<string, unknown>;
  invalidKeys: ReadonlySet<string>;
  onChange: (key: string, value: unknown) => void;
}

export function RequestCompletionBlocks(props: BlocksProps) {
  const base = useId();
  return <BlockList {...props} base={base} />;
}

function BlockList({ blocks, base, ...rest }: BlocksProps & { base: string }) {
  return (
    <>
      {blocks.map((block, index) => (
        <div key={block.id} id={`block-${block.id}`} className="nwrc-block">
          <Block
            block={block}
            base={`${base}-${index}`}
            afterHeading={blocks[index - 1]?.type === 'section_header'}
            {...rest}
          />
        </div>
      ))}
    </>
  );
}

interface BlockProps extends Omit<BlocksProps, 'blocks'> {
  block: RequestBlock;
  base: string;
  afterHeading: boolean;
}

function Block({ block, base, afterHeading, responses, invalidKeys, onChange }: BlockProps) {
  const data = block.data;
  switch (block.type) {
    case 'text':
      return (
        <div
          className={cx('nwrc-para nwrc-rich', afterHeading && 'nwrc-para--lead')}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(data.content as string) }}
        />
      );

    case 'section_header':
      return <SectionHeading number={data.number as string} title={data.title as string} />;

    case 'field_grid': {
      const columns = data.columns === 3 ? 3 : data.columns === 4 ? 4 : 2;
      const fields = (data.fields as GridField[]) ?? [];
      return (
        <div className={`nwrc-grid nwrc-grid--${columns}`}>
          {fields.map((field, idx) => {
            const fieldKey = field.key || `field_${block.id}_${idx}`;
            const id = `${base}-${idx}`;
            const invalid = invalidKeys.has(fieldKey);
            return (
              <div key={idx} className="nwrc-field">
                <FieldLabel htmlFor={id} label={field.label} required={field.required} />
                <input
                  id={id}
                  type="text"
                  className={cx('nwrc-input', invalid && 'nwrc-invalid')}
                  value={String(responses[fieldKey] ?? '')}
                  onChange={(e) => onChange(fieldKey, e.target.value)}
                  placeholder={field.placeholder}
                  required={field.required}
                  aria-invalid={invalid ? true : undefined}
                />
              </div>
            );
          })}
        </div>
      );
    }

    case 'radio_options': {
      const radioKey = (data.key as string) || `radio_${block.id}`;
      return (
        <fieldset className="nwrc-group">
          <GroupLegend id={`${base}-legend`} label={data.label as string} />
          <OptionGroup
            labelledBy={`${base}-legend`}
            value={responses[radioKey] as string | undefined}
            options={(data.options as string[]) ?? []}
            vertical={data.layout !== 'horizontal'}
            onChange={(val) => onChange(radioKey, val)}
          />
        </fieldset>
      );
    }

    case 'checkbox_table': {
      const columns = (data.columns as string[]) ?? [];
      const rows = (data.rows as string[]) ?? [];
      return (
        <div className="nwrc-table-wrap">
          <table className="nwrc-table">
            <thead>
              <tr>
                <th scope="col" className="nwrc-th nwrc-th--item">
                  Item
                </th>
                {columns.map((col, idx) => (
                  <th key={idx} scope="col" className="nwrc-th nwrc-th--center">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  <th scope="row" className="nwrc-td nwrc-td--item">
                    {row}
                  </th>
                  {columns.map((col, colIdx) => {
                    const cellKey = `chk_${block.id}_${rowIdx}_${colIdx}`;
                    return (
                      <td key={colIdx} className="nwrc-td nwrc-td--center">
                        <input
                          type="checkbox"
                          className="nwrc-check-box"
                          aria-label={`${row}: ${col}`}
                          checked={(responses[cellKey] as boolean) || false}
                          onChange={(e) => onChange(cellKey, e.target.checked)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case 'compliance_question': {
      const compKey = (data.key as string) || `comp_${block.id}`;
      const detailsKey = `${compKey}_details`;
      return (
        <div className="nwrc-question">
          <fieldset className="nwrc-group">
            <GroupLegend id={`${base}-legend`} label={data.question as string} />
            <OptionGroup
              labelledBy={`${base}-legend`}
              value={responses[compKey] as string | undefined}
              options={['Yes', 'No']}
              pair
              onChange={(val) => onChange(compKey, val)}
            />
            {data.showDetails ? (
              <div className="nwrc-field nwrc-question-details">
                <FieldLabel
                  htmlFor={`${base}-details`}
                  label={(data.detailsLabel as string) || 'Please provide details:'}
                />
                <textarea
                  id={`${base}-details`}
                  rows={4}
                  className="nwrc-input nwrc-textarea"
                  value={String(responses[detailsKey] ?? '')}
                  onChange={(e) => onChange(detailsKey, e.target.value)}
                />
              </div>
            ) : null}
          </fieldset>
        </div>
      );
    }

    case 'signature': {
      const signatories = (data.signatories as Array<{ label: string; key: string }>) ?? [];
      return (
        <div className="nwrc-signatures">
          {signatories.map((sig, idx) => {
            const sigKey = sig.key || `sig_${block.id}_${idx}`;
            const signed = responses[sigKey];
            return (
              <div key={idx} className="nwrc-sign">
                <p className="nwrc-sign-label">{sig.label}</p>
                {signed ? (
                  <div className="nwrc-sign-pad nwrc-sign-pad--done">
                    <p className="nwrc-sign-name">{String(responses[sigKey] ?? '')}</p>
                    <p className="nwrc-sign-when">
                      Digitally Signed on {new Date().toLocaleDateString()}
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="nwrc-sign-pad"
                    onClick={() => onChange(sigKey, prompt('Type your full name to sign:'))}
                  >
                    <RequestCompletionIcon name="pen" size={22} />
                    <span>Click to Sign</span>
                  </button>
                )}
                {data.showDate ? (
                  <p className="nwrc-sign-date">Date: {new Date().toLocaleDateString()}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      );
    }

    case 'instructional_callout': {
      const tone = data.type === 'warning' ? 'warning' : data.type === 'stop' ? 'stop' : 'info';
      return (
        <div className={`nwrc-callout nwrc-callout--${tone}`}>
          <RequestCompletionIcon
            name={tone === 'info' ? 'info' : 'alertCircle'}
            size={17}
            className="nwrc-callout-icon"
          />
          <p className="nwrc-callout-text">{data.text as string}</p>
        </div>
      );
    }

    case 'spacer':
      return <div style={{ height: (data.height as string) || '20px' }} />;

    case 'page_break':
      return <hr className="nwrc-break" />;

    case 'container': {
      // Conditional container — evaluate condition and render children
      const containerBlocks = (data.blocks as RequestBlock[]) || [];
      const condVar = data.conditionVariable as string | undefined;
      const condVal = data.conditionValue;
      const condOp = (data.conditionOperator as string) || 'equals';

      // Evaluate condition against current responses
      const actualValue = condVar ? responses[condVar] : undefined;
      let conditionMet: boolean;
      switch (condOp) {
        case 'equals':
          conditionMet = String(actualValue) === String(condVal);
          break;
        case 'not_equals':
          conditionMet = String(actualValue) !== String(condVal);
          break;
        case 'exists':
          conditionMet = actualValue !== undefined && actualValue !== null && actualValue !== '';
          break;
        case 'not_exists':
          conditionMet = actualValue === undefined || actualValue === null || actualValue === '';
          break;
        default:
          conditionMet = true;
      }

      if (!conditionMet) return null;

      return (
        <div className="nwrc-stack">
          <BlockList
            blocks={containerBlocks}
            base={base}
            responses={responses}
            invalidKeys={invalidKeys}
            onChange={onChange}
          />
        </div>
      );
    }

    case 'repeater':
      return <Repeater block={block} base={base} responses={responses} onChange={onChange} />;

    default:
      return null;
  }
}

interface RepeaterProps {
  block: RequestBlock;
  base: string;
  responses: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

/** A table of rows the client can add to, fill in and remove. */
function Repeater({ block, base, responses, onChange }: RepeaterProps) {
  const repData = block.data;
  const variableName = repData.variableName as string;
  const items: Record<string, unknown>[] =
    (responses[variableName] as Record<string, unknown>[]) || [];
  const columns: RepeaterColumn[] = (repData.columns as RepeaterColumn[]) || [];
  const isUserPopulated = !!repData.userPopulated;
  const title = repData.title as string | undefined;
  const emptyMessage = repData.emptyMessage as string | undefined;

  const addRow = () => {
    // Create an empty row with all column keys
    const newRow: Record<string, string> = {};
    columns.forEach((col) => {
      newRow[col.key] = '';
    });
    onChange(variableName, [...items, newRow]);
  };

  const updateCell = (rowIndex: number, colKey: string, value: string) => {
    const updatedItems = items.map((item, i) =>
      i === rowIndex ? { ...item, [colKey]: value } : item,
    );
    onChange(variableName, updatedItems);
  };

  const removeRow = (rowIndex: number) => {
    onChange(
      variableName,
      items.filter((_, i) => i !== rowIndex),
    );
  };

  let body: ReactNode;
  if (items.length === 0 && !isUserPopulated) {
    body = <p className="nwrc-empty">{emptyMessage || 'No items'}</p>;
  } else {
    body = (
      <div className="nwrc-table-wrap">
        <table className="nwrc-table">
          <thead>
            <tr>
              {isUserPopulated ? (
                <th scope="col" className="nwrc-th nwrc-th--num">
                  #
                </th>
              ) : null}
              {columns.map((col, ci) => (
                <th key={ci} scope="col" className="nwrc-th" style={{ width: col.width || 'auto' }}>
                  {col.header}
                </th>
              ))}
              {isUserPopulated ? (
                <th scope="col" className="nwrc-th nwrc-th--act">
                  <span className="nw-sr-only">Remove</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {items.map((item, ri) => (
              <tr key={ri}>
                {isUserPopulated ? <td className="nwrc-td nwrc-td--num">{ri + 1}</td> : null}
                {columns.map((col, ci) => (
                  <td key={ci} className="nwrc-td">
                    {isUserPopulated ? (
                      <input
                        id={`${base}-${ri}-${ci}`}
                        type="text"
                        className="nwrc-input nwrc-cell-input"
                        aria-label={`${col.header}, row ${ri + 1}`}
                        value={String(item[col.key] ?? '')}
                        onChange={(e) => updateCell(ri, col.key, e.target.value)}
                        placeholder={col.header}
                      />
                    ) : (
                      String(item[col.key] ?? '')
                    )}
                  </td>
                ))}
                {isUserPopulated ? (
                  <td className="nwrc-td nwrc-td--act">
                    <button
                      type="button"
                      className="nwrc-remove"
                      onClick={() => removeRow(ri)}
                      title="Remove row"
                      aria-label={`Remove row ${ri + 1}`}
                    >
                      <RequestCompletionIcon name="trash" size={15} />
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
            {items.length === 0 && isUserPopulated ? (
              <tr>
                <td colSpan={columns.length + 2} className="nwrc-td nwrc-td--empty">
                  {emptyMessage || 'No items yet — click "Add Row" below'}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="nwrc-repeater">
      {title ? <h3 className="nwrc-repeater-title">{title}</h3> : null}
      {body}
      {isUserPopulated ? (
        <button type="button" className="nw-outline nwrc-add" onClick={addRow}>
          <RequestCompletionIcon name="plus" size={15} />
          Add Row
        </button>
      ) : null}
    </div>
  );
}
