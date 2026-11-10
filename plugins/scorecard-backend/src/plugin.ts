import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';
import { createRouter } from './router';

/**
 * Serves the same production-readiness rules as the entity card.
 * Local development allows unauthenticated reads, matching the template's
 * allow-all permission policy. Put these routes behind auth before exposing
 * the portal beyond localhost.
 */
export const scorecardPlugin = createBackendPlugin({
  pluginId: 'scorecard',
  register(env) {
    env.registerInit({
      deps: {
        auth: coreServices.auth,
        catalog: catalogServiceRef,
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
      },
      async init({ auth, catalog, httpRouter, logger }) {
        httpRouter.use(
          await createRouter({
            catalog: {
              async getEntityByRef(entityRef) {
                const credentials = await auth.getOwnServiceCredentials();
                return catalog.getEntityByRef(entityRef, { credentials });
              },
            },
          }),
        );
        httpRouter.addAuthPolicy({
          path: '/health',
          allow: 'unauthenticated',
        });
        httpRouter.addAuthPolicy({
          path: '/evaluate',
          allow: 'unauthenticated',
        });
        httpRouter.addAuthPolicy({
          path: '/entities/:namespace/:kind/:name',
          allow: 'unauthenticated',
        });
        logger.info('Scorecard backend registered');
      },
    });
  },
});

export default scorecardPlugin;
