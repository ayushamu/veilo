const E2E_USER_COOKIE = "veilo-e2e-user-id";
const E2E_SECRET_COOKIE = "veilo-e2e-auth-secret";

type CookieReader = {
  get(name: string): { value?: string } | undefined;
};

function isE2EAuthEnabled() {
  const explicitE2E = process.env.VEILO_E2E_AUTH_ENABLED === "true";
  const testRuntime = process.env.NODE_ENV === "test" || explicitE2E;
  return (
    process.env.NODE_ENV !== "production" &&
    testRuntime &&
    Boolean(process.env.VEILO_E2E_AUTH_SECRET)
  );
}

export function getE2EMockUserId(cookieStore: CookieReader) {
  if (!isE2EAuthEnabled()) return null;

  const expectedSecret = process.env.VEILO_E2E_AUTH_SECRET;
  const suppliedSecret = cookieStore.get(E2E_SECRET_COOKIE)?.value;
  if (!expectedSecret || suppliedSecret !== expectedSecret) return null;

  return cookieStore.get(E2E_USER_COOKIE)?.value || null;
}
