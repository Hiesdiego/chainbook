/**
 * Sound Manager for Chainbook
 * Centralized sound configuration and management using react-sounds/howler
 */

export const SOUNDS = {
  UI: {
    click: '/sounds/notification/notification.wav',
    hover: '/sounds/notification/notification.wav',
    success: '/sounds/notification/notification.wav',
    error: '/sounds/alert/progress_loop.wav',
    notification: '/sounds/notification/notification.wav',
  },
  SOCIAL: {
    like: '/sounds/social/like.wav',
    comment: '/sounds/notification/notification.wav',
    follow: '/sounds/notification/notification.wav',
    unfollow: '/sounds/alert/progress_loop.wav',
    repost: '/sounds/notification/notification.wav',
  },
  ALERT: {
    whale: '/sounds/alert/progress_loop.wav',
    price_change: '/sounds/alert/progress_loop.wav',
    large_trade: '/sounds/alert/progress_loop.wav',
    contract_event: '/sounds/alert/progress_loop.wav',
  },
  NOTIFICATION: {
    new_notification: '/sounds/notification/notification.wav',
    badge_earn: '/sounds/notification/notification.wav',
  },
} as const;

export type SoundKey = typeof SOUNDS[keyof typeof SOUNDS][keyof typeof SOUNDS[keyof typeof SOUNDS]];

// Sound volumes for different categories
export const SOUND_VOLUMES = {
  UI: 0.3,
  SOCIAL: 0.4,
  ALERT: 0.6,
  NOTIFICATION: 0.5,
} as const;

// List of sounds to preload for better performance
export const PRELOAD_SOUNDS = [
  SOUNDS.UI.click,
  SOUNDS.SOCIAL.like,
  SOUNDS.ALERT.whale,
  SOUNDS.NOTIFICATION.new_notification,
] as const;
