import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { EmploymentSection } from '../EmploymentSection';

function renderSection(overrides: Partial<Parameters<typeof EmploymentSection>[0]> = {}) {
  const props: Parameters<typeof EmploymentSection>[0] = {
    profileData: {
      employmentStatus: 'employed',
      employers: [
        {
          id: 'a',
          employerName: 'Acme',
          jobTitle: 'Engineer',
          industry: 'Mining',
          isPrimary: true,
        },
        {
          id: 'b',
          employerName: 'Side Gig',
          jobTitle: 'Tutor',
          industry: 'Education',
          isPrimary: false,
          occupationalDuties: { admin: 50, travel: 50, supervision: 0, manual: 0 },
        },
      ],
    },
    employersInEditMode: new Set(),
    selfEmployedInEditMode: false,
    employerToDelete: null,
    handleInputChange: vi.fn(),
    addEmployer: vi.fn(),
    editEmployer: vi.fn(),
    saveEmployer: vi.fn(),
    cancelEditEmployer: vi.fn(),
    confirmDeleteEmployer: vi.fn(),
    removeEmployer: vi.fn(),
    updateEmployer: vi.fn(),
    setPrimaryEmployer: vi.fn(),
    editSelfEmployed: vi.fn(),
    saveSelfEmployed: vi.fn(),
    cancelEditSelfEmployed: vi.fn(),
    setEmployerToDelete: vi.fn(),
    ...overrides,
  };
  render(<EmploymentSection {...props} />);
  return props;
}

describe('admin EmploymentSection — primary and secondary employers', () => {
  it('groups the employers and labels each one', () => {
    renderSection();
    expect(screen.getByText('Primary employer')).toBeTruthy();
    expect(screen.getByText('Secondary employer')).toBeTruthy();
    expect(screen.getByText('Primary')).toBeTruthy();
    expect(screen.getByText('Secondary')).toBeTruthy();
    expect(screen.getByText('1 primary and 1 secondary employer on record')).toBeTruthy();
    expect(screen.getByText('Admin 50% · Travel 50%')).toBeTruthy();
  });

  it('offers "Make primary" only on a secondary employer', () => {
    const props = renderSection();
    const buttons = screen.getAllByRole('button', { name: /make primary/i });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(props.setPrimaryEmployer).toHaveBeenCalledWith('b');
  });

  it('blocks saving an employer whose duties do not add up to 100%', () => {
    renderSection({
      employersInEditMode: new Set(['a']),
      profileData: {
        employmentStatus: 'employed',
        employers: [
          {
            id: 'a',
            employerName: 'Acme',
            jobTitle: 'Engineer',
            industry: 'Mining',
            occupationalDuties: { admin: 40, travel: 0, supervision: 0, manual: 0 },
          },
        ],
      },
    });
    expect((screen.getByRole('button', { name: /save/i }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(
      screen.getByText('Occupational duties must add up to 100% (currently 40%)'),
    ).toBeTruthy();
  });
});
