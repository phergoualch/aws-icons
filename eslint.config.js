import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist", "node_modules", "eslint.config.js", "scripts/**"]
  },
  {
    files: ["src/**/*.{ts,tsx}", "vite.config.ts"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      },
      globals: {
        console: "readonly",
        document: "readonly",
        Event: "readonly",
        globalThis: "readonly",
        HTMLElement: "readonly",
        HTMLAnchorElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLSelectElement: "readonly",
        localStorage: "readonly",
        MouseEvent: "readonly",
        navigator: "readonly",
        ResizeObserver: "readonly",
        window: "readonly"
      }
    },
    rules: {
      "no-undef": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }
      ]
    }
  }
);
