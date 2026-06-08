import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageBreakBlock } from '../PageBreakBlock';

describe('PageBreakBlock', () => {
  it('has type page_break', () => {
    expect(PageBreakBlock.type).toBe('page_break');
  });

  it('has label Page Break', () => {
    expect(PageBreakBlock.label).toBe('Page Break');
  });

  it('render returns null (handled structurally by FormCanvas)', () => {
    expect(PageBreakBlock.render()).toBeNull();
  });

  it('editor renders page-break description text', () => {
    const Editor = PageBreakBlock.editor as React.ComponentType;
    render(<Editor />);
    expect(screen.getByText(/forces a new page/i)).toBeDefined();
  });
});
