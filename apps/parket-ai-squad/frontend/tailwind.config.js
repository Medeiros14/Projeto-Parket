/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        base:    '#0F0F0F',
        card:    '#1A1A1A',
        overlay: '#242424',
        border:  '#2A2A2A',
        accent:  '#D4AF37',
        muted:   '#666666',
      },
      fontSize: {
        'kpi':    ['28px', { fontWeight: '700', lineHeight: '1.2' }],
        'label':  ['11px', { fontWeight: '700', letterSpacing: '0.08em' }],
      },
      borderRadius: {
        card: '10px',
        btn:  '8px',
      },
    },
  },
  plugins: [],
}
