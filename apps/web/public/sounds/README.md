# Sound System Setup - Chainbook

This directory is set up for the Chainbook sound system using Howler.js and react-sounds.

## Installation Required

You need to install the react-sounds package with Howler.js:

```bash
pnpm add react-sounds howler
# or
npm install react-sounds howler
# or
yarn add react-sounds howler
```

## Sound Directory Structure

Place your sound files in the appropriate directories:

```
public/sounds/
├── ui/
│   ├── click.mp3          (Click/tap sound)
│   ├── hover.mp3          (Hover effect sound)
│   ├── success.mp3        (Success notification)
│   ├── error.mp3          (Error notification)
│   └── notification.mp3   (Generic notification)
├── social/
│   ├── like.mp3           (Like/upvote sound)
│   ├── comment.mp3        (Comment posted)
│   ├── follow.mp3         (User followed)
│   ├── unfollow.mp3       (User unfollowed)
│   └── repost.mp3         (Post reposted)
├── alert/
│   ├── whale.mp3          (Whale movement alert)
│   ├── price_change.mp3   (Price change alert)
│   ├── large_trade.mp3    (Large trade alert)
│   └── contract_event.mp3 (Smart contract event)
└── notification/
    ├── new.mp3            (New notification)
    └── badge.mp3          (Badge earned)
```

## Sound Files Recommended

For the best UX, here are recommended sound characteristics:

### UI Sounds
- **click.mp3**: Short, crisp tone (100-200ms) - ~0.3 volume
- **hover.mp3**: Very subtle whoosh (50-100ms) - ~0.2 volume
- **success.mp3**: Positive chime (300-400ms) - ~0.4 volume
- **error.mp3**: Warning tone (300-400ms) - ~0.4 volume
- **notification.mp3**: Gentle bell (200-300ms) - ~0.5 volume

### Social Sounds
- **like.mp3**: Cheerful ping (150-250ms) - ~0.4 volume
- **comment.mp3**: Notification chime (200-300ms) - ~0.4 volume
- **follow.mp3**: Positive tone (200-300ms) - ~0.4 volume
- **unfollow.mp3**: Subtle tone (200-300ms) - ~0.3 volume
- **repost.mp3**: Forward whoosh (150-250ms) - ~0.4 volume

### Alert Sounds
- **whale.mp3**: Distinctive alert (400-600ms) - ~0.6 volume
- **price_change.mp3**: Quick beep (200-300ms) - ~0.5 volume
- **large_trade.mp3**: Alert tone (300-400ms) - ~0.6 volume
- **contract_event.mp3**: Event chime (300-400ms) - ~0.5 volume

### Notification Sounds
- **new.mp3**: Notification pop (200-300ms) - ~0.5 volume
- **badge.mp3**: Achievement sound (400-500ms) - ~0.5 volume

## Sound File Formats

Recommended: **MP3** format for best browser compatibility
- Bitrate: 128-192 kbps
- Sample Rate: 44.1 kHz
- Keep files under 50KB each

## How to Add Sounds

1. Create your audio files (use tools like Audacity, GarageBand, or online generators)
2. Convert to MP3 format
3. Place them in the appropriate `public/sounds/` subdirectories
4. The Chainbook app will automatically load and use them

## Usage in Components

```typescript
import { useSoundContext } from '@/components/providers/SoundProvider'

export function MyComponent() {
  const { play, isEnabled } = useSoundContext()
  
  const handleClick = async () => {
    await play('ui/click')
    // Do something
  }
  
  return <button onClick={handleClick}>Click me</button>
}
```

## Volume Levels

Volumes are automatically set based on sound category:
- UI: 0.3 (subtle)
- Social: 0.4 (noticeable)
- Alert: 0.6 (important)
- Notification: 0.5 (moderate)

Users can toggle sounds on/off in settings (preference saved to localStorage).

## Testing

To test if sounds are working:
1. Run the dev server
2. Open DevTools console
3. Check if sounds load without 404 errors
4. Test triggering various actions that should produce sounds

## Recommended Sound Resources

- **Freesound.org**: Free, creative commons sounds
- **Zapsplat.com**: Free sound effects
- **sfxr**: Online 8-bit sound generator
- **Bfxr**: Bit-reduction sound engine
- **Audacity**: Free audio editor for custom sounds
