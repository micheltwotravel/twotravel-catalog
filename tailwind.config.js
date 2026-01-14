import lineClamp from '@tailwindcss/line-clamp';

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        tt: { black:"#1C1C1C", gold:"#D9C178", beige:"#F4E7CC", teal:"#009C8C", ink:"#111827" }
      },
      fontFamily: {
        brand: ["'Caviar Dreams'", "sans-serif"],
        ui: ["'Mont'", "sans-serif"],
      },
    },
  },
  plugins: [lineClamp],
};
