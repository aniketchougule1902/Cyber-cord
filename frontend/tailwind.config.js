/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'cyber-green': '#00ff41',
        'cyber-cyan': '#00d4ff',
        'cyber-purple': '#7b2fff',
        'cyber-dark': '#0a0a0f',
        'cyber-surface': '#12121a',
        'cyber-border': '#1e1e2e',
        'cyber-text': '#e0e0e0',
        'cyber-warning': '#ff6b35',
        'cyber-danger': '#ff2d55',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'cyber-grid': "linear-gradient(rgba(0,255,65,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,65,0.03) 1px, transparent 1px)",
        'cyber-gradient': 'linear-gradient(135deg, #0a0a0f 0%, #12121a 50%, #0a0a0f 100%)',
      },
      backgroundSize: {
        'cyber-grid': '40px 40px',
      },
      boxShadow: {
        'cyber-green': '0 0 20px rgba(0,255,65,0.3)',
        'cyber-cyan': '0 0 20px rgba(0,212,255,0.3)',
        'cyber-purple': '0 0 20px rgba(123,47,255,0.3)',
        'cyber-danger': '0 0 20px rgba(255,45,85,0.3)',
        'cyber-warning': '0 0 20px rgba(255,107,53,0.3)',
      },
      animation: {
        'pulse-green': 'pulse-green 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scan-line': 'scan-line 3s linear infinite',
        'flicker': 'flicker 0.15s infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        'pulse-green': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5', boxShadow: '0 0 30px rgba(0,255,65,0.6)' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'flicker': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        'glow': {
          'from': { textShadow: '0 0 5px rgba(0,255,65,0.5), 0 0 10px rgba(0,255,65,0.3)' },
          'to': { textShadow: '0 0 10px rgba(0,255,65,0.8), 0 0 20px rgba(0,255,65,0.5), 0 0 30px rgba(0,255,65,0.3)' },
        },
      },
      borderRadius: {
        'cyber': '2px',
      },
    },
  },
  plugins: [],
}
