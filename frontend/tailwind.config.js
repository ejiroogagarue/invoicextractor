/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'ogaga-yellow': '#ffc300',
        'ogaga-yellow-dark': '#DBA51C',
        'ogaga-yellow-light': '#FFC325',
        'ogaga-black': '#000000',
        'ogaga-white': '#FFFFFF',
        'status-paid': '#3DAA48',
        'status-pending': '#F3C742',
        'status-past-due': '#E64A3D',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'neumorphic': '0 12px 32px rgba(0,0,0,0.18)',
        'neumorphic-lg': '0 20px 40px rgba(0,0,0,0.25)',
      },
    },
  },
  plugins: [],
}

