# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```

## Firebase configuration (required for Google Sign-In)

Follow these steps to configure Firebase Auth for local development and production.

- **Add env file**: create a `.env.local` (or set environment variables in your host) using `.env.example` as a template.

- **Required variables** (`VITE_FIREBASE_*`):

  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_STORAGE_BUCKET` (optional for auth, recommended)
  - `VITE_FIREBASE_MESSAGING_SENDER_ID` (optional)
  - `VITE_FIREBASE_APP_ID`

- **Enable Google provider**:

  1. Open Firebase Console → Authentication → Sign-in method.
  2. Enable **Google** sign-in and save.

- **Authorized domains**:

  1. Open Firebase Console → Authentication → Authorized domains.
  2. Add `localhost:5173` (or the port your dev server uses) and your production domain (e.g. `your-app.vercel.app`).

- **Check config consistency**: make sure `authDomain`, `projectId` and `appId` in `.env.local` match the values shown in Firebase Console → Project settings → Your apps.

Troubleshooting

- Error `CONFIGURATION_NOT_FOUND` or `auth/configuration-not-found` usually means the Firebase Auth configuration doesn't match the project (wrong `authDomain`/`appId`) or Google provider/authorized domain isn't enabled.
- Steps to debug:

  1. Restart dev server after editing `.env.local`:

     ```bash
     npm run dev
     ```

  2. Open browser DevTools → Console and Network. Our app logs the current `authDomain`, `projectId`, and `appId` on configuration errors to help compare values.
  3. Verify Google Sign-In is enabled and the domain is authorized (see steps above).

If you want, paste the console error and the logged firebase config here and I will help verify the mismatch.

## Firestore rules (permission-denied fix)

If you see `Missing or insufficient permissions` in logs for `onSnapshot` or `addDoc`, publish Firestore rules that allow each user to access only their own workouts.

Use this in Firebase Console → Firestore Database → Rules:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/workouts/{workoutId} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

After publishing rules:

1. Sign out and sign in again.
2. Restart dev server.
3. Retry import and verify list loads without `permission-denied`.

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from "eslint-plugin-react-x";
import reactDom from "eslint-plugin-react-dom";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs["recommended-typescript"],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json", "./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```
