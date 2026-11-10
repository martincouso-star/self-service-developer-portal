import { createElement } from 'react';
import { createFrontendPlugin } from '@backstage/frontend-plugin-api';
import { EntityCardBlueprint } from '@backstage/plugin-catalog-react/alpha';

const scorecardCard = EntityCardBlueprint.make({
  name: 'readiness',
  params: {
    filter: 'kind:component',
    loader: () =>
      import('./components/ScorecardCard').then(m =>
        createElement(m.ScorecardCard),
      ),
  },
});

/** Catalog overview card for production readiness. */
export const scorecardPlugin = createFrontendPlugin({
  pluginId: 'scorecard',
  extensions: [scorecardCard],
});

export default scorecardPlugin;
