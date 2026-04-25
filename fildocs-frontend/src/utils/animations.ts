/**
 * FilDOCS Design System - Unified Animation Tokens
 * 
 * Our core easing curve is a strong ease-out that starts fast and decelerates smoothly,
 * providing instant feedback to user actions.
 */

// Custom curve: cubic-bezier(0.16, 1, 0.3, 1)
export const TRANSITION_EASE_OUT = [0.16, 1, 0.3, 1];

export const TRANSITION_DURATIONS = {
  FAST: 0.15,    // Hover, micro-interactions
  NORMAL: 0.25,  // Modals, drawers
  SLOW: 0.45,    // Complex page transitions
};

/**
 * Hardware-accelerated transform templates for Framer Motion
 * Usage: animate={{ transform: TRANSFORM_VARIANTS.scaleIn }}
 */
export const TRANSFORM_VARIANTS = {
  scaleIn: "scale(1)",
  scaleOut: "scale(0.95)",
  slideInFromBottom: "translateY(0)",
  slideOutToBottom: "translateY(12px)",
};

export const SPRING_CONFIG = {
  stiffness: 100,
  damping: 10,
  mass: 1,
};
