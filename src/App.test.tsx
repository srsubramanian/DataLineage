import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import sample from './fixtures/lineage.sample.json';
import type { LineageData } from './lib/types';

const data = sample as LineageData;
const rowNames = () => Array.from(document.querySelectorAll('.matrix-row')).map((r) => r.getAttribute('aria-label'));
const panelTitle = () => document.querySelector('.detail-title')?.textContent;

beforeEach(() => window.history.replaceState(null, '', '/'));
afterEach(cleanup);

describe('Lineage matrix page', () => {
  it('selects Amount by default and shows coverage', () => {
    render(<App data={data} />);
    expect(rowNames()).toHaveLength(11);
    expect(panelTitle()).toBe('Amount');
    expect(screen.getByText('Coverage 82%')).toBeTruthy();
  });

  it('filters by node name anywhere in the chain', () => {
    render(<App data={data} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'MERCHANT_NM' } });
    expect(rowNames()).toEqual(['Merchant']);
    expect(screen.getByText('Showing 1 of 11')).toBeTruthy();
    expect(document.querySelectorAll('.chip.is-hit')).toHaveLength(1);
  });

  it('shows only issue rows under the Issues filter', () => {
    render(<App data={data} />);
    fireEvent.click(within(screen.getByRole('group', { name: 'Coverage' })).getByText('Issues'));
    expect(rowNames()).toEqual(['Settled', 'Dispute reason']);
    fireEvent.click(screen.getByText('Clear'));
    expect(rowNames()).toHaveLength(11);
  });

  it('lists impacted UI fields when an upstream chip is clicked', () => {
    render(<App data={data} />);
    fireEvent.click(screen.getAllByText('TXN_AMT_MINOR')[0]);
    expect(screen.getByText('Feeds 2 UI field(s):')).toBeTruthy();
    expect(window.location.search).toBe('?node=s2');
    fireEvent.click(within(document.querySelector('.detail-impact') as HTMLElement).getByText('Selected total'));
    expect(panelTitle()).toBe('Selected total');
  });

  it('restores state from a deep link and reports issues', () => {
    window.history.replaceState(null, '', '/?field=u12');
    render(<App data={data} />);
    expect(panelTitle()).toBe('Settled');
    expect(screen.getByText(/renamed to SETTLEMENT_DT/, { selector: '.issue-card-detail' })).toBeTruthy();
  });
});
