import js from "@eslint/js";

export default [
    js.configs.recommended,
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                // Browser globals
                window: "readonly",
                document: "readonly",
                fetch: "readonly",
                console: "readonly",
                navigator: "readonly",
                self: "readonly",
                caches: "readonly",
                
                // Node globals
                process: "readonly",
                __dirname: "readonly",
                __filename: "readonly",
            }
        },
        rules: {
            "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
            "no-undef": "error"
        }
    }
];
