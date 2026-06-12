import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Heatmap, { HeatmapLegend } from './Heatmap';

const day = (date, total, intensity) => ({ date, total, intensity });

describe('Heatmap', () => {
  it('renders one titled cell per day with pluralized tooltips', () => {
    const data = [day('2026-06-01', 1, 1), day('2026-06-02', 5, 2), day('2026-06-03', 0, 0)];
    const { container } = render(<Heatmap data={data} mobile={false} />);
    expect(container.querySelector('[title="2026-06-01 · 1 exercise"]')).not.toBeNull();
    expect(container.querySelector('[title="2026-06-02 · 5 exercises"]')).not.toBeNull();
    expect(container.querySelector('[title="2026-06-03 · 0 exercises"]')).not.toBeNull();
  });

  it('pads the trailing week so the grid stays rectangular', () => {
    // 8 days span 2 weeks → grid should hold 14 cells (8 days + 6 pads)
    const data = Array.from({ length: 8 }, (_, i) => day(`2026-06-0${i + 1}`, i, Math.min(i, 4)));
    const { container } = render(<Heatmap data={data} mobile />);
    expect(container.firstChild.children).toHaveLength(14);
  });

  it('adds no padding when the data is a whole number of weeks', () => {
    const data = Array.from({ length: 7 }, (_, i) => day(`2026-06-0${i + 1}`, 1, 1));
    const { container } = render(<Heatmap data={data} mobile={false} />);
    expect(container.firstChild.children).toHaveLength(7);
  });
});

describe('HeatmapLegend', () => {
  it('renders the LESS → MORE scale with all five intensity swatches', () => {
    const { container, getByText } = render(<HeatmapLegend />);
    expect(getByText('LESS')).toBeInTheDocument();
    expect(getByText('MORE')).toBeInTheDocument();
    // 5 swatches + 2 text spans
    expect(container.querySelectorAll('span')).toHaveLength(7);
  });
});
