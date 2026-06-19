# CLAUDE.md — React Native Stack Context

> Append this to the universal `skills/CLAUDE.md` when working on a React Native / Expo project.

---

## Stack

- **Framework:** React Native with Expo (SDK 51+)
- **Router:** Expo Router (file-based, App Router style)
- **Language:** TypeScript (strict)
- **State:** Zustand (global) + React Query (server state)
- **Styling:** NativeWind (Tailwind for RN) or StyleSheet
- **Forms:** React Hook Form + Zod
- **Testing:** Jest + React Native Testing Library + Detox (E2E)
- **Backend:** [Your API — Supabase / Laravel / Django]

---

## Project Structure

```
app/                         ← Expo Router pages (file-based routing)
├── (auth)/                  ← Auth screens (login, register, forgot)
├── (tabs)/                  ← Tab navigator screens
└── _layout.tsx              ← Root layout
src/
├── components/
│   ├── ui/                  ← Primitive components (Button, Input, Card)
│   └── [feature]/           ← Feature-specific components
├── hooks/                   ← Custom hooks
├── lib/
│   ├── api/                 ← API client and query functions
│   └── validations/         ← Zod schemas
├── store/                   ← Zustand stores
├── types/                   ← Global types
└── constants/               ← App-wide constants (colors, sizes, routes)
assets/
├── images/
└── fonts/
```

---

## Architecture Rules

### Platform Handling
```typescript
// ✅ Use Platform API for platform differences
import { Platform } from 'react-native'

const shadowStyle = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.1 },
  android: { elevation: 4 },
})

// ✅ Platform-specific files — automatically resolved by Metro
// Button.ios.tsx + Button.android.tsx
```

### Navigation
- Use Expo Router — file-based routing, no manual navigator config
- Navigation types must be defined — no untyped `useNavigation()`
- Deep linking must be configured in `app.json` for all navigable screens

### State Management
- **Server state** (API data) → React Query (`useQuery`, `useMutation`)
- **Global UI state** (auth, theme, preferences) → Zustand
- **Local component state** → `useState`
- Never store API response data in Zustand — that's React Query's job

### Performance
- Always specify `keyExtractor` in `FlatList`
- Use `useCallback` and `useMemo` at list boundaries — not everywhere
- Images must use `expo-image` (not `Image` from RN) for caching
- Avoid `StyleSheet.create` inside component bodies

---

## Coding Conventions

```typescript
// ✅ Correct component structure
interface ProfileCardProps {
  userId: string
  compact?: boolean
}

export function ProfileCard({ userId, compact = false }: ProfileCardProps) {
  const { data: user, isLoading } = useUser(userId)

  if (isLoading) return <ProfileCardSkeleton />
  if (!user) return null

  return (
    <View style={styles.container}>
      {/* ... */}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    // ...
  },
})
```

---

## Forbidden Patterns

```typescript
// ❌ Inline styles on performance-critical components
<View style={{ padding: 16, margin: 8 }}>

// ❌ Anonymous functions in FlatList renderItem
<FlatList renderItem={({ item }) => <Card item={item} />} />
// Use: const renderItem = useCallback(...)

// ❌ Nested ScrollViews without justification
// ❌ Direct state mutation
// ❌ Using AsyncStorage for sensitive data — use expo-secure-store
// ❌ console.log in production builds — use conditional logging
```

---

## Testing

```bash
npx jest                       # Unit tests
npx jest --coverage            # Coverage
npx detox test -c ios.sim.debug  # E2E on iOS simulator
```

---

## Build & Deployment

```bash
# Development build
npx expo start

# Production build (EAS)
eas build --platform ios --profile production
eas build --platform android --profile production

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

## Environment Variables

```bash
# .env (Expo uses EXPO_PUBLIC_ prefix for client-accessible vars)
EXPO_PUBLIC_API_URL=
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=

# Server-side only (never prefixed with EXPO_PUBLIC_)
SUPABASE_SERVICE_ROLE_KEY=
```
