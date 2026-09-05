import type * as Preset from '@docusaurus/preset-classic';
import type { Config } from '@docusaurus/types';
import { themes as prismThemes } from 'prism-react-renderer';

const GITHUB_REPO = 'https://github.com/marmotz/kurotako';

const config: Config = {
  title: 'kurotako',
  tagline:
    'Synchronize TypeScript schemas from the data model down to frontend forms, through one validation layer.',
  favicon: 'img/favicon.svg',

  // Default deployment: GitHub Pages project site.
  // When the custom domain is decided (see docs-site/technical.md "Open
  // points"), flip `url` to the domain, set `baseUrl: '/'`, add
  // `static/CNAME`, and enable "Enforce HTTPS" in repo settings.
  url: 'https://marmotz.github.io',
  baseUrl: '/kurotako/',
  // baseUrl: '/',

  organizationName: 'marmotz',
  projectName: 'kurotako',

  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          editUrl: `${GITHUB_REPO}/tree/develop/apps/docs/`,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    './plugins/webpack-symlinks/index.cjs',
    [
      'docusaurus-plugin-typedoc',
      {
        // Generated API reference, frozen with each docs version. Regenerated
        // on every build for `next`; `docs/api/` is git-ignored (see root
        // .gitignore). Frozen copies under versioned_docs/ are committed.
        entryPointStrategy: 'packages',
        entryPoints: [
          '../../packages/ir',
          '../../packages/core',
          '../../packages/config',
          '../../packages/cli',
        ],
        out: 'docs/api',
        readme: 'none',
        // typedoc-plugin-markdown output tuned for Docusaurus.
        hidePageHeader: true,
        hideBreadcrumbs: true,
        useCodeBlocks: true,
        expandObjects: true,
        parametersFormat: 'table',
        // Missing TSDoc on a public export is a warning, not a build failure.
        validation: {
          notDocumented: true,
          invalidLink: true,
          notExported: false,
        },
        treatWarningsAsErrors: false,
        sidebar: {
          autoConfiguration: true,
          pretty: true,
        },
      },
    ],
  ],

  themes: [
    [
      '@easyops-cn/docusaurus-search-local',
      {
        // Self-contained local search — no external service for launch.
        hashed: true,
        indexDocs: true,
        indexBlog: false,
        docsRouteBasePath: '/',
      },
    ],
  ],

  themeConfig: {
    navbar: {
      title: 'kurotako',
      logo: {
        alt: 'kurotako',
        src: 'img/favicon.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'guide',
          position: 'left',
          label: 'Docs',
        },
        {
          // Hidden until versions.json is non-empty (first `tako` release).
          type: 'docsVersionDropdown',
          position: 'right',
        },
        {
          href: GITHUB_REPO,
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Quick start', to: '/getting-started/quick-start' },
            { label: 'Concepts', to: '/concepts/parsers-and-generators' },
            { label: 'Configuration', to: '/reference/tako-config' },
          ],
        },
        {
          title: 'Project',
          items: [
            { label: 'GitHub', href: GITHUB_REPO },
            { label: 'Issues', href: `${GITHUB_REPO}/issues` },
            {
              label: 'Architecture (design docs)',
              href: `${GITHUB_REPO}/blob/develop/docs/architecture.md`,
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} kurotako contributors.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'typescript'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
