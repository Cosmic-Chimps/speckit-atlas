"use strict";

const tseslint = require("typescript-eslint");

module.exports = tseslint.config(
  {
    ignores: ["dist/**", "out/**", "media/webview.js", "node_modules/**"],
  },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts", "test/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-ignore": true, "ts-expect-error": "allow-with-description" },
      ],
    },
  },
  {
    // Principle I: the pure domain core must not import the editor API or leak
    // Node/DOM/webview dependencies through its imports.
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "vscode", message: "core/ must stay free of the vscode API (Principle I)." },
          ],
          patterns: [
            {
              group: ["vscode", "node:*", "../extension/*", "../webview/*"],
              message: "core/ must not import editor, Node, or webview modules (Principle I).",
            },
          ],
        },
      ],
    },
  },
);
