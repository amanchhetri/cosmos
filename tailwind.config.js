/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        space: { 0: "#05060a", 1: "#0a0d16", 2: "#121726" },
        instrument: "#5eead4",
      },
      fontFamily: { mono: ["ui-monospace", "SFMono-Regular", "monospace"] },
    },
  },
  plugins: [],
};
