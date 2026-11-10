import { Entity } from '@backstage/catalog-model';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { lightTheme } from '@backstage/theme';
import { evaluateScorecard } from '@internal/plugin-scorecard-common';
import { ThemeProvider } from '@material-ui/core/styles';
import { render, screen } from '@testing-library/react';
import { ReactElement } from 'react';
import { ScorecardCard, ScorecardContent } from './ScorecardCard';

function renderThemed(ui: ReactElement) {
  return render(<ThemeProvider theme={lightTheme}>{ui}</ThemeProvider>);
}

const service: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'checkout-api',
    description: 'Accepts checkout requests and records payment attempts.',
    annotations: {
      'backstage.io/source-location':
        'url:https://github.com/marlow-labs/checkout-api',
      'backstage.io/techdocs-ref': 'dir:.',
      'marlow.dev/oncall': 'checkout-primary',
      'marlow.dev/runbook': 'https://marlow.example/runbooks/checkout-api',
      'marlow.dev/slo': '99.9%',
      'marlow.dev/has-tests': 'true',
    },
  },
  spec: {
    type: 'service',
    lifecycle: 'production',
    owner: 'group:default/checkout',
    system: 'checkout',
    providesApis: ['checkout-openapi'],
  },
};

describe('ScorecardContent', () => {
  it('renders the score, grade, and a failed check', () => {
    const incomplete: Entity = {
      ...service,
      metadata: {
        ...service.metadata,
        annotations: {
          'backstage.io/techdocs-ref': 'dir:.',
        },
      },
    };
    renderThemed(<ScorecardContent result={evaluateScorecard(incomplete)} />);

    expect(screen.getByTestId('scorecard-score').textContent).toBe('58');
    expect(screen.getByTestId('scorecard-grade').textContent).toContain('D');
    expect(screen.getByText(/Failed: Source location/)).toBeTruthy();
    expect(screen.getByText(/Passed: TechDocs/)).toBeTruthy();
  });

  it('renders a perfect score for a ready service', () => {
    renderThemed(<ScorecardContent result={evaluateScorecard(service)} />);

    expect(screen.getByTestId('scorecard-score').textContent).toBe('100');
    expect(screen.getByTestId('scorecard-grade').textContent).toContain('A');
    expect(screen.getByText(/Passed: Service level objective/)).toBeTruthy();
  });
});

describe('ScorecardCard', () => {
  it('reads the entity from catalog context', () => {
    renderThemed(
      <EntityProvider entity={service}>
        <ScorecardCard />
      </EntityProvider>,
    );

    expect(screen.getByTestId('scorecard-score').textContent).toBe('100');
    expect(screen.getByText(/Owned by group:default\/checkout/)).toBeTruthy();
  });
});
