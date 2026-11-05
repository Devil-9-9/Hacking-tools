/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./pages/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    screens: {
      xs: "375px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      colors: {
        base: {
          950: "#11161C",
          900: "#171D25",
          800: "#1F2733",
          700: "#2B3542",
          600: "#3A4552",
          500: "#5A6672",
          400: "#88919A",
          200: "#C9CFD6",
          100: "#E6E9EC",
        },
        pass: { DEFAULT: "#3FA796", dim: "#2A5F57" },
        warn: { DEFAULT: "#E8A33D", dim: "#6B5027" },
        fail: { DEFAULT: "#E0584F", dim: "#6B2E2A" },
        info: { DEFAULT: "#5B8DEF", dim: "#2C3D63" },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      maxWidth: {
        measure: "72ch",
      },
    },
  },
  plugins: [],
};
