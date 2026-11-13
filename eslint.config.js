/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  {
    files: ["*.rules"],
    plugins: {
      "firebase-rules": require("@firebase/eslint-plugin-security-rules")
    },
    rules: {
      ...require("@firebase/eslint-plugin-security-rules").configs.recommended.rules
    }
  }
];
