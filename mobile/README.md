# TaskFlow Mobile (React Native / Expo)

## Setup

```bash
cd mobile
npm install
```

## Run

```bash
# Start dev server (scan QR code with Expo Go app)
npm start

# iOS simulator
npm run ios

# Android emulator
npm run android
```

## Configuration

Set your backend URL in `.env`:
```
EXPO_PUBLIC_API_URL=https://your-backend.railway.app/api
```

## Screens

- **Login** — JWT auth, token stored in SecureStore
- **Dashboard** — portfolio overview, active projects with progress bars
- **Projects** — full project list with search
- **My Tasks** — tasks assigned to the current user, filterable by status
- **Project Tasks** — tasks within a specific project
- **Profile** — user info + sign out

## Building for production

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure project (first time)
eas build:configure

# Build for iOS / Android
eas build --platform ios
eas build --platform android
```
