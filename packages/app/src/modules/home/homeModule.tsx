import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { HomePageWidgetBlueprint } from '@backstage/plugin-home-react/alpha';
import { MarkdownContent } from '@backstage/core-components';

const content = `
## Marlow Developer Portal

This portal is the catalog, template, and docs front door for Marlow, a
fictional commerce company. Sign in as Guest. Nothing here calls an external
service unless you set \`GITHUB_TOKEN\`.

### Start here

- **Catalog** — open [Checkout API](/catalog/default/component/checkout-api)
  and read the production-readiness card
- **Templates** — scaffold a [FastAPI](/create/templates/default/fastapi-service)
  or [Node.js](/create/templates/default/node-service) service
- **Docs** — read the [portal guide](/docs/default/component/developer-portal)

The scorecard reads catalog spec fields and \`marlow.dev/*\` annotations. The
same rules are served by the scorecard backend.
`;

const gettingStartedWidget = HomePageWidgetBlueprint.make({
  name: 'getting-started',
  params: {
    name: 'GettingStarted',
    title: 'Getting Started',
    description: 'How to browse the Marlow catalog, templates, and scorecard',
    components: async () => ({
      Content: () => <MarkdownContent content={content} />,
    }),
  },
});

export const homeModule = createFrontendModule({
  pluginId: 'home',
  extensions: [gettingStartedWidget],
});
