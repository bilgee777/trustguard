import { analyze } from '@/features/analysis/engine';
import { DEMO_SCENARIOS } from './scenarios';

describe('demo scenarios (calibration corpus)', () => {
  it.each(DEMO_SCENARIOS)('$title is rated $expectedLevel', (scenario) => {
    const result = analyze({ contentType: scenario.contentType, text: scenario.text });
    expect(result.level).toBe(scenario.expectedLevel);
  });


  it('runs every scenario through the live engine with no AI output', () => {
    for (const s of DEMO_SCENARIOS) {
      expect(analyze({ contentType: s.contentType, text: s.text }).aiSummary).toBeNull();
    }
  });
});
