import defaultTheme from "tailwindcss/defaultTheme";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", ...defaultTheme.fontFamily.sans],
        display: ["Plus Jakarta Sans", ...defaultTheme.fontFamily.sans],
      },
      colors: {
        primary: {
          50:  "#E9EEFD",
          100: "#B3C5FA",
          200: "#759DF6",
          300: "#2D77E3",
          400: "#1E55A5",
          500: "#10356B",
          600: "#041736",
        },
        brand: {
          50:  "#FCFDFF",
          100: "#BDD6FF",
          200: "#6EB0FF",
          300: "#008CE5",
          400: "#0067AB",
          500: "#004474",
          600: "#002441",
        },
        surface: {
          50:  "#E7EAEF",
          100: "#B9C3D1",
          200: "#8C9DB4",
          300: "#6B778A",
          400: "#4B5462",
          500: "#2D333C",
          600: "#12161A",
        },
        neutral: {
          50:  "#EEEEEF",
          100: "#C4C6CA",
          200: "#9D9FA6",
          300: "#777A81",
          400: "#55575C",
          500: "#35363A",
          600: "#18181A",
        },
      },
    },
  },
  plugins: [],
};