import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ScenarioPicker from './ScenarioPicker';
import { activePack } from '../../packs';

const SCENARIOS = activePack.content.scenarios;

describe('ScenarioPicker', () => {
  it('renders a radio per scenario inside a labelled radiogroup', () => {
    render(<ScenarioPicker scenario={SCENARIOS[0].id} setScenario={() => {}} mobile={false} />);
    expect(screen.getByRole('radiogroup', { name: 'Choose chat scenario' })).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(SCENARIOS.length);
    for (const s of SCENARIOS) {
      expect(screen.getByRole('radio', { name: `${s.name} scenario` })).toBeInTheDocument();
    }
  });

  it('checks exactly the active scenario', () => {
    const active = SCENARIOS[1];
    render(<ScenarioPicker scenario={active.id} setScenario={() => {}} mobile={false} />);
    expect(screen.getByRole('radio', { name: `${active.name} scenario` })).toBeChecked();
    const checked = screen
      .getAllByRole('radio')
      .filter((r) => r.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
  });

  it('calls setScenario with the clicked scenario id', async () => {
    const setScenario = vi.fn();
    const target = SCENARIOS[2];
    render(<ScenarioPicker scenario={SCENARIOS[0].id} setScenario={setScenario} mobile={false} />);
    await userEvent.click(screen.getByRole('radio', { name: `${target.name} scenario` }));
    expect(setScenario).toHaveBeenCalledWith(target.id);
  });

  it('labels the section with the classified CEFR code', () => {
    render(
      <ScenarioPicker scenario={SCENARIOS[0].id} setScenario={() => {}} mobile={false} level="a1" />
    );
    expect(screen.getByText(/Scenario · A1/i)).toBeInTheDocument();
  });

  it('renders only the scenarios it is given', () => {
    render(
      <ScenarioPicker
        scenario="free"
        setScenario={() => {}}
        mobile={false}
        scenarios={[SCENARIOS[0]]}
      />
    );
    expect(screen.getAllByRole('radio')).toHaveLength(1);
    expect(screen.queryByRole('radio', { name: 'Order Coffee scenario' })).not.toBeInTheDocument();
  });

  it('does not render scenario descriptions', () => {
    const withDesc = SCENARIOS.find((s) => s.desc);
    render(<ScenarioPicker scenario={SCENARIOS[0].id} setScenario={() => {}} mobile={false} />);
    expect(screen.queryByText(withDesc.desc)).not.toBeInTheDocument();
  });

  it('does not paint A/B/C section markers', () => {
    render(<ScenarioPicker scenario={SCENARIOS[0].id} setScenario={() => {}} mobile={false} />);
    expect(screen.queryByText(/^A$/)).not.toBeInTheDocument();
  });
});
