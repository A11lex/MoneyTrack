export type OnboardingState = {
  onboarding_completed: boolean;
};

export function hasCompletedOnboarding<T extends OnboardingState>(setup: T | null | undefined): setup is T {
  return setup?.onboarding_completed === true;
}
