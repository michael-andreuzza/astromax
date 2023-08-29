/** @type {import('tailwindcss').Config} */
const defaultTheme = require("tailwindcss/defaultTheme");
const colors = require("tailwindcss/colors");
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    screens: {
      sm: "540px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    fontSize: {
      xs: [
        "0.75rem",
        {
          lineHeight: "1rem",
        },
      ],
      sm: [
        "0.875rem",
        {
          lineHeight: "1.5rem",
        },
      ],
      base: [
        "1rem",
        {
          lineHeight: "1.75rem",
        },
      ],
      lg: [
        "1.125rem",
        {
          lineHeight: "2rem",
        },
      ],
      xl: [
        "1.25rem",
        {
          lineHeight: "2rem",
        },
      ],
      "2xl": [
        "1.5rem",
        {
          lineHeight: "2rem",
        },
      ],
      "3xl": [
        "2rem",
        {
          lineHeight: "2.5rem",
        },
      ],
      "4xl": [
        "2.5rem",
        {
          lineHeight: "3.5rem",
        },
      ],
      "5xl": [
        "3rem",
        {
          lineHeight: "3.5rem",
        },
      ],
      "6xl": [
        "3.75rem",
        {
          lineHeight: "1",
        },
      ],
      "7xl": [
        "4.5rem",
        {
          lineHeight: "1.1",
        },
      ],
      "8xl": [
        "6rem",
        {
          lineHeight: "1",
        },
      ],
      "9xl": [
        "8rem",
        {
          lineHeight: "1",
        },
      ],
    },
    extend: {

      colors: {

        blue: {
         50: "#EBEBFF",
      100: "#D2D2FE",
      200: "#A6A4FE",
      300: "#7E7CFD",
      400: "#524FFD",
      500: "#2522FC",
      600: "#0703E2",
      700: "#0502AB",
      800: "#03026F",
      900: "#020137",
      950: "#01001E"
        },
      },
      fontFamily: {
        sans: ["Inter", ...defaultTheme.fontFamily.sans],
        mono: ["JetBrains Mono", ...defaultTheme.fontFamily.mono],
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
    require('@tailwindcss/aspect-ratio'),
  ],
}
