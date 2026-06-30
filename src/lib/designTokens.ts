/**
 * Neumorphism + Glassmorphism Design Token System
 * Defines the unified visual system used throughout the Pulse application.
 */

export const DESIGN_TOKENS = {
  // Base background surface colors
  bg: {
    light: 'bg-[#e6ebf2]',
    dark: 'bg-[#1a1d24]',
  },
  
  // Base text color
  text: {
    light: 'text-gray-800',
    dark: 'text-gray-100',
  },

  // Neumorphic shadows
  shadows: {
    // Raised surface (light highlight on top-left, dark shadow on bottom-right)
    raised: {
      light: 'shadow-[6px_6px_12px_#b5c1d4,_-6px_-6px_12px_#ffffff]',
      dark: 'shadow-[6px_6px_12px_#0e1014,_-6px_-6px_12px_#262b34]',
    },
    // Inset surface (concave depth)
    inset: {
      light: 'shadow-[inset_6px_6px_12px_#b5c1d4,_inset_-6px_-6px_12px_#ffffff]',
      dark: 'shadow-[inset_6px_6px_12px_#0e1014,_inset_-6px_-6px_12px_#262b34]',
    },
    // Pressed surface (compressed depth for button clicks or active statuses)
    pressed: {
      light: 'shadow-[inset_3px_3px_6px_#b5c1d4,_inset_-3px_-3px_6px_#ffffff]',
      dark: 'shadow-[inset_3px_3px_6px_#0e1014,_inset_-3px_-3px_6px_#262b34]',
    },
  },

  // Border radius scale
  borderRadius: {
    small: 'rounded-[16px]', // For small controls, buttons, inputs, switches
    large: 'rounded-[24px]', // For cards, panels, containers
  },

  // Brand Accent Color (Deep Teal) for primary actions and active states
  accent: {
    primary: '#0d9488', // Deep Teal
    hover: '#0f766e',   // Hover variant
    active: '#0f766e',  // Pressed variant
    classes: {
      bg: 'bg-[#0d9488] hover:bg-[#0f766e]',
      text: 'text-[#0d9488]',
      border: 'border-[#0d9488]',
      ring: 'focus:ring-[#0d9488]/30',
    },
  },

  // Glassmorphism overlays (background opacity, blur, thin light-catching borders)
  glass: {
    light: 'bg-white/45 backdrop-blur-md border border-white/40 shadow-lg',
    dark: 'bg-[#1a1d24]/55 backdrop-blur-md border border-white/10 shadow-2xl',
  },
};

/**
 * Utility helper to get the respective tokens based on the current mode
 */
export const getDesignTokens = (darkMode: boolean) => {
  const mode = darkMode ? 'dark' : 'light';
  return {
    baseBg: DESIGN_TOKENS.bg[mode],
    baseText: DESIGN_TOKENS.text[mode],
    raised: DESIGN_TOKENS.shadows.raised[mode],
    inset: DESIGN_TOKENS.shadows.inset[mode],
    pressed: DESIGN_TOKENS.shadows.pressed[mode],
    smallRadius: DESIGN_TOKENS.borderRadius.small,
    largeRadius: DESIGN_TOKENS.borderRadius.large,
    glass: DESIGN_TOKENS.glass[mode],
    accent: DESIGN_TOKENS.accent,
  };
};
