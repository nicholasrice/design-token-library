import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "Design Token Library",
  tagline: "A TypeScript library for managing Design Token Libraries",
  favicon: "img/favicon.ico",

  // Set the production url of your site here
  url: "https://nicholasrice.github.io",
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: "/design-token-library/",

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "nicholasrice", // Usually your GitHub org/user name.
  projectName: "design-token-library", // Usually your repo name.

  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          routeBasePath: "/",
          sidebarPath: "./sidebars.ts",
        },
        theme: {
          customCss: "./src/css/custom.css",
        },
        blog: false,
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    navbar: {
      title: "Design Token Library",
      items: [
        {
          type: "docSidebar",
          sidebarId: "tutorialSidebar",
          position: "left",
          label: "Docs",
        },
        {
          sidebarId: "apiSidebar",
          position: "left",
          label: "API Reference",
          to: "api-reference/design-token-library",
        },
        {
          href: "https://github.com/nicholasrice/design-token-library",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      copyright: `Copyright © ${new Date().getFullYear()}. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
