import scorecardPlugin from './plugin';

describe('scorecardPlugin', () => {
  it('is installed under the scorecard plugin id', () => {
    expect(scorecardPlugin.id).toBe('scorecard');
  });
});
