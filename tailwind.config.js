/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: "#0f1117",
        darkCard: "#191c24",
        darkPanel: "#212530",
        primaryOrange: "#ff6a1f",
        primaryOrangeHover: "#ff7f38",
        wrongRed: "#ff3b30",
        correctBlue: "#2563eb",
      },
    },
  },
  plugins: [],
};
