import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    "getting-started/quick-start",
    {
      type: "category",
      label: "Configuration",
      items: [
        "configuration/library-config",
        "configuration/groups",
        "configuration/metadata-and-root",
      ],
    },
    {
      type: "category",
      label: "Token values",
      items: [
        "token-values/refs",
        "token-values/recipes",
        "token-values/value-semantics",
      ],
    },
    {
      type: "category",
      label: "Advanced",
      items: [
        "advanced/extending",
        "advanced/subscriptions",
        "advanced/custom-types",
      ],
    },
    {
      type: "category",
      label: "Export",
      items: ["export/css-output"],
    },
  ],
};

export default sidebars;
