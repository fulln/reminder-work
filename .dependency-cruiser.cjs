module.exports = {
  forbidden: [
    {
      name: "ARCH-CYCLE-001",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "ARCH-DOMAIN-001",
      severity: "error",
      from: { path: "^src/domain" },
      to: {
        path: "^(src/(presentation|application|infrastructure)|react|@react-router)",
      },
    },
    {
      name: "ARCH-APPLICATION-001",
      severity: "error",
      from: { path: "^src/application" },
      to: { path: "^src/(presentation|infrastructure)" },
    },
    {
      name: "ARCH-PRESENTATION-001",
      severity: "error",
      from: { path: "^src/presentation" },
      to: { path: "^src/infrastructure" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "types", "default"],
    },
    reporterOptions: { dot: { collapsePattern: "node_modules/[^/]+" } },
  },
};
