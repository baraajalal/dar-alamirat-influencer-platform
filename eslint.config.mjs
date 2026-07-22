import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Temporary exceptions for the legacy SmartSuite implementation.
    // Remove these file-scoped overrides as each route/page is migrated.
    files: [
      "app/api/**/*.{ts,tsx}",
      "app/page.tsx",
      "app/coordinator/**/*.{ts,tsx}",
      "app/content-submit/**/*.{ts,tsx}",
      "scripts/**/*.{js,mjs,ts}",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
    },
  },
]);

export default eslintConfig;
