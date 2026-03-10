# Onboarding Gate Implementation Plan

## Objective
Implement an onboarding gate that appears on the initial startup of the application. This gate will ask the user to explicitly choose between running the app in a "Local Only" mode or "Signing In" to sync their data to the cloud. This explicit choice improves UX by setting clear expectations about data storage, preventing accidental data islands, and establishing trust.

## Requirements

1.  **State Tracking for Onboarding:**
    *   We need a way to track whether the user has completed the onboarding choice.
    *   This state should be stored persistently on the local device (e.g., in `localStorage` or IndexedDB alongside settings), independent of the actual sync state, because "Local Only" means there is no sync auth token, but they *have* completed onboarding.
    *   A boolean flag like `hasCompletedOnboarding` or `initialCloudChoiceMade` in the local settings store.

2.  **Onboarding Gate UI Component (`WelcomeGate.tsx`):**
    *   Create a new full-screen component.
    *   The design should be clean and premium, potentially blurring or hiding the main app interface behind it.
    *   It should present a strong value proposition for the app and two clear choices:
        *   **Option A: Local Only.** "Keep everything purely on this device. Privacy first."
        *   **Option B: Cloud Sync / Sign In.** "Back up and use across your phone and web."
    *   If Option B is chosen, it should transition to the sign-in/sign-up flow (reusing logic from `AccountSyncPanel.tsx` but perhaps in a more centered, focused layout).
    *   If Option A is chosen, set `cloudLinked` to `false` (if not already), mark onboarding as complete, and dismiss the gate.

3.  **App Root Logic Update (`App.tsx` or similar root level component):**
    *   During the initial load, check:
        *   Is `authSession` present? (If yes, they are already synced, bypass gate).
        *   Has `hasCompletedOnboarding` been set to `true`? (If yes, they chose local-only previously, bypass gate).
        *   If both are false (and perhaps there's no existing local data to avoid locking out existing users who update to this version), render the `WelcomeGate` instead of the main application layout.

4.  **Handling Existing Users (Migration):**
    *   **Crucial Step:** We must not disrupt users who are already using the app locally before this feature is added.
    *   If the app boots up and sees *existing* tasks or projects in the local database, but `hasCompletedOnboarding` is undefined/false, it should silently mark `hasCompletedOnboarding = true` to prevent showing the gate to existing active users. The gate is strictly for *new* initial startups.

## Implementation Steps

### Step 1: Settings/State Management Update
*   Update the `SyncMeta` or application `Settings` interface to include an `onboardingComplete: boolean` flag.
*   Ensure this flag is saved locally when toggled.

### Step 2: Create `WelcomeGate` Component
*   Create a clean, centered UI.
*   **Card 1 (Local):** Icon: Hard Drive/Device. Action: `setOnboardingComplete(true)`, ensure sync is disabled.
*   **Card 2 (Cloud):** Icon: Cloud. Action: Expand to show auth form (Email/Password + create/login toggle). Upon successful auth, `setOnboardingComplete(true)`.
*   Ensure the Turnstile/captcha logic from `AccountSyncPanel` is accessible or duplicated cleanly for the auth form here if Turnstile is required for sign-up.

### Step 3: Integrate into Main Layout
*   In the main routing or layout wrapper component (e.g., where `Header`, `Sidebar`, `Main` are rendered), add a conditional render:
    ```tsx
    if (!onboardingComplete && !authSession && !hasExistingData) {
      return <WelcomeGate onComplete={() => setOnboardingComplete(true)} />;
    }
    // Render normal app...
    ```

### Step 4: Add Migration Logic
*   On application initialization (where the DB is opened or settings are loaded):
    ```typescript
    // Pseudo-code
    async function initializeApp() {
      const settings = await loadSettings();
      if (settings.onboardingComplete === undefined) {
         const taskCount = await db.tasks.count();
         if (taskCount > 0) {
            // Existing user, grandfather them in
            await saveSettings({ ...settings, onboardingComplete: true });
         }
      }
    }
    ```

## Design Notes
*   **Aesthetics:** Use a dark, slightly translucent backdrop if overlaying the app, or a solid minimal dark background. Use glassmorphism on the selection cards.
*   **Typography:** Large heading (e.g., "Welcome to TooMuchToDo"). Clear, concise subtext.
*   **Animations:** Smooth fade-in for the gate. If they click "Cloud Sync", smoothly transition the cards away to reveal the login form.
