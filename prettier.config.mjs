/**
 * @see https://prettier.io/docs/configuration
 * @type {import("prettier").Config}
 */
const config = {
  tabWidth: 2,
  semi: true,
  singleQuote: true,
  plugins: ['prettier-plugin-astro'],
  // overrides: [
  //         {
  //                 files: "*.astro",
  //                 options: {
  //                         parser: "astro",
  //                 },
  //         },
  // ],
};

export default config;
