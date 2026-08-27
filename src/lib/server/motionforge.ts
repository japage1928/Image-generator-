import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

type Env = Record<string, string | undefined>;

function env(name: string): string | undefined {
  return typeof process !== "undefined" ? process.env[name] : undefined;
}

function supabaseUrl() {
  return (env("VITE_SUPABASE_URL") || env("SUPABASE_URL") || "").replace(/\/$/, "");
}

function supabasePublishableKey() {
  return env("VITE_SUPABASE_PUBLISHABLE_KEY") || env("SUPABASE_PUBLISHABLE_KEY") || "";
}

export function serverEnv(): Env {
  return typeof process !== "undefined" ? process.env : {};
}

export function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "private, no-store", "netlify-cdn-cache-control": "no-store" },
  });
}

export function safeError(error: unknown) {
  const value = error as Error & { status?: number; code?: string };
  return json(
    {
      error: value?.message || "Unexpected server error.",
      ...(value?.code ? { code: value.code } : {}),
    },
    value?.status || 500,
  );
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw Object.assign(new Error("Cross-origin request rejected."), {
      status: 403,
      code: "origin_rejected",
    });
  }
}

export async function getAuthenticatedUser(
  request: Request,
): Promise<{ user: User; token: string } | null> {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const url = supabaseUrl();
  const key = supabasePublishableKey();
  if (!token || !url || !key) return null;
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const user = (await response.json()) as User;
  return user?.id ? { user, token } : null;
}

export function getUserDb(token: string): SupabaseClient {
  const url = supabaseUrl();
  const key = supabasePublishableKey();
  if (!url || !key)
    throw Object.assign(new Error("Supabase is not configured."), {
      status: 503,
      code: "supabase_unconfigured",
    });
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { authorization: `Bearer ${token}` } },
  });
}

export function getServiceDb(): SupabaseClient {
  const url = supabaseUrl();
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key)
    throw Object.assign(new Error("The server database credential is not configured."), {
      status: 503,
      code: "service_db_unconfigured",
    });
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function requireUser(user: Awaited<ReturnType<typeof getAuthenticatedUser>>) {
  if (!user)
    throw Object.assign(new Error("Sign in to continue."), {
      status: 401,
      code: "authentication_required",
    });
  return user;
}

export function appUrl(request: Request) {
  return (env("APP_URL") || new URL(request.url).origin).replace(/\/$/, "");
}

export function stripeKey() {
  const key = env("STRIPE_SECRET_KEY")?.trim() || "";
  if (!key.startsWith("sk_") && !key.startsWith("rk_")) {
    throw Object.assign(new Error("Stripe is not configured."), {
      status: 503,
      code: "stripe_unconfigured",
    });
  }
  return key;
}

export function stripeWebhookSecret() {
  const value = env("STRIPE_WEBHOOK_SECRET")?.trim() || "";
  if (!value.startsWith("whsec_"))
    throw Object.assign(new Error("Stripe webhook verification is not configured."), {
      status: 503,
      code: "stripe_webhook_unconfigured",
    });
  return value;
}

export function stripeStarterPriceId() {
  const value = env("STRIPE_STARTER_PRICE_ID")?.trim() || "";
  if (!value.startsWith("price_"))
    throw Object.assign(new Error("Starter Stripe Price ID is not configured."), {
      status: 503,
      code: "stripe_price_unconfigured",
    });
  return value;
}

export function maxDailySpend() {
  const value = Number(env("MOTIONFORGE_MAX_DAILY_SPEND") || 5);
  return Number.isFinite(value) && value > 0 ? value : 5;
}
