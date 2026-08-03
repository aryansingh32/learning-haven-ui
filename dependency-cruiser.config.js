/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    /* RULES FROM THE AUDIT */

    // 1. Monorepo Structural Rules
    {
      name: 'no-circular',
      severity: 'error',
      comment:
        'This dependency is part of a circular relationship. You might want to revise ' +
        'your solution (i.e. use dependency inversion, or move the modules to a common area).',
      from: {},
      to: {
        circular: true
      }
    },
    {
      name: 'apps-cant-depend-on-apps',
      comment: 'Apps should not depend on other apps.',
      severity: 'error',
      from: { path: '^apps/([^/]+)/' },
      to: { path: '^apps/([^/]+)/', pathNot: '^apps/$1/' }
    },
    {
      name: 'packages-cant-depend-on-apps',
      comment: 'Packages should be agnostic and not depend on specific apps.',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^apps/' }
    },
    
    // 2. Domain Module Boundaries (Backend)
    {
      name: 'strict-module-boundaries',
      comment: 'Modules must not import internal files from other modules. Only public events/contracts allowed.',
      severity: 'warn', // Setting to warn initially to avoid breaking everything immediately
      from: { path: '^apps/api/src/modules/([^/]+)/' },
      to: { 
        path: '^apps/api/src/modules/([^/]+)/',
        pathNot: [
          '^apps/api/src/modules/$1/', // Can import from itself
          '^apps/api/src/modules/core/' // Everyone can import from core (for now)
        ]
      }
    },

    // 3. Frontend Feature Isolation
    {
      name: 'strict-feature-boundaries',
      comment: 'Features should not directly import other features. Use shared contracts or app services.',
      severity: 'warn',
      from: { path: '^apps/web/src/features/([^/]+)/' },
      to: { 
        path: '^apps/web/src/features/([^/]+)/',
        pathNot: '^apps/web/src/features/$1/'
      }
    }
  ],
  options: {
    doNotFollow: {
      path: 'node_modules'
    },
    includeOnly: '^(apps|packages)',
    tsPreCompilationDeps: true,
    reporterOptions: {
      archi: {
        collapsePattern: '^(packages|apps/[^/]+)/'
      }
    }
  }
};
