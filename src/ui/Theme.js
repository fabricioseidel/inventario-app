// src/ui/Theme.js
export const theme = {
  colors: {
    bg: '#f7f7fb',
    background: '#f7f7fb',
    backgroundSecondary: '#efefef',
    text: '#111',
    textSecondary: '#666',
    textMuted: '#666',
    primary: '#111',
    tabActive: '#111',
    tabInactive: '#9aa',
    divider: '#ececec',
    border: '#ececec',
    successBg: '#e8faf0',
    success: '#107a4e',
    dangerBg: '#fde7ea',
    danger: '#b00020',
    warning: '#ff6b35',
  },
  radius: { sm: 8, md: 12, lg: 16, xl: 20 },
  shadow: {
    sm: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
    md: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  }
};

// Export adicional para compatibilidad
export const Theme = theme.colors;