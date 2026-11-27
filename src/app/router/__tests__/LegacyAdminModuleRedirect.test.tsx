import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { LegacyAdminModuleRedirect } from '../LegacyAdminModuleRedirect';

function Where() {
  const { pathname, search } = useLocation();
  return <div data-testid="where">{`${pathname}${search}`}</div>;
}

function renderAt(url: string) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/admin" element={<Where />} />
        <Route path="/admin/:module" element={<LegacyAdminModuleRedirect />} />
      </Routes>
    </MemoryRouter>,
  );
  return screen.getByTestId('where').textContent;
}

describe('LegacyAdminModuleRedirect', () => {
  it('turns the path segment the calendar digest linked to into ?module=', () => {
    expect(renderAt('/admin/calendar')).toBe('/admin?module=calendar');
  });

  it('keeps a deep-link query string', () => {
    expect(renderAt('/admin/esign?envelope=env-1')).toBe('/admin?envelope=env-1&module=esign');
  });
});
