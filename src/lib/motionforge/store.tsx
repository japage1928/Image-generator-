import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CreditTransaction, Project, UsageState } from "./types";
import { generationService } from "./generation-service";
import { motionforgeFetch, projectFromApi } from "./api-client";
import { useAuth } from "@/lib/auth/AuthProvider";

const STORAGE_KEY = "motionforge.state.v2";

interface StoredState {
  projects: Project[];
  usage: UsageState;
}

function iso(daysAgo: number, hour = 12): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function defaultState(): StoredState {
  return {
    projects: [
      {
        id: "demo-1",
        title: "Neon alley pan",
        prompt: "Slow dolly forward through a rain-slick neon alley, gentle steam drift.",
        status: "completed",
        duration: 5,
        aspectRatio: "16:9",
        quality: "standard",
        motionStrength: 55,
        credits: 1,
        createdAt: iso(1, 21),
        demo: true,
      },
      {
        id: "demo-2",
        title: "Product turntable",
        prompt: "Subtle orbit around the product with soft studio light sweep.",
        status: "completed",
        duration: 10,
        aspectRatio: "1:1",
        quality: "high",
        motionStrength: 35,
        credits: 4,
        createdAt: iso(3, 15),
        demo: true,
      },
      {
        id: "demo-3",
        title: "Portrait breeze",
        prompt: "Hair and scarf move in a light breeze, camera holds steady.",
        status: "failed",
        duration: 5,
        aspectRatio: "9:16",
        quality: "standard",
        motionStrength: 70,
        credits: 0,
        createdAt: iso(6, 9),
        demo: true,
        error: "Demo render stopped before completion.",
      },
    ],
    usage: {
      plan: "Free",
      creditsTotal: 2,
      creditsUsed: 0,
      transactions: [
        { id: "tx-1", label: "Free plan — 2 video credits", amount: 2, createdAt: iso(8, 10) },
      ],
    },
  };
}

interface StoreValue extends StoredState {
  ready: boolean;
  addProject: (project: Project) => void;
  updateProject: (id: string, patch: Partial<Project>) => void;
  removeProject: (id: string) => void;
  spendCredits: (amount: number, label: string) => void;
  resetDemoData: () => void;
  refreshRemote: () => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function MotionForgeProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<StoredState>(() => defaultState());
  const [ready, setReady] = useState(generationService.isDemo ? false : !authLoading);

  useEffect(() => {
    if (!generationService.isDemo) return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredState;
        if (parsed?.projects && parsed?.usage) setState(parsed);
      }
    } catch {
      /* corrupted storage — fall back to defaults */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !generationService.isDemo) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* quota exceeded — keep the session working in memory */
    }
  }, [state, ready]);

  const refreshRemote = useCallback(async () => {
    if (generationService.isDemo || !user) return;
    const [account, projectRows] = await Promise.all([
      motionforgeFetch<{
        plan: string;
        credits: number;
        usage?: { creditsGranted?: number; creditsUsed?: number };
        transactions?: Array<{
          id: string;
          amount: number;
          transaction_type: string;
          created_at: string;
        }>;
      }>("/api/account"),
      motionforgeFetch<{ projects: Array<Record<string, unknown>> }>("/api/projects"),
    ]);
    const transactions = (account.transactions || []).map((item) => ({
      id: item.id,
      amount: item.amount,
      label: item.transaction_type.replaceAll("_", " "),
      createdAt: item.created_at,
    }));
    setState({
      projects: (projectRows.projects || []).map((project) => projectFromApi(project)),
      usage: {
        plan: account.plan,
        creditsTotal: Number(account.usage?.creditsGranted || 0),
        creditsUsed: Number(account.usage?.creditsUsed || 0),
        transactions,
      },
    });
    setReady(true);
  }, [user]);

  useEffect(() => {
    if (generationService.isDemo) return;
    if (authLoading) return;
    if (!user) {
      setState({
        projects: [],
        usage: { plan: "Free", creditsTotal: 0, creditsUsed: 0, transactions: [] },
      });
      setReady(true);
      return;
    }
    setReady(false);
    void refreshRemote().catch(() => setReady(true));
  }, [authLoading, user, refreshRemote]);

  const addProject = useCallback((project: Project) => {
    setState((s) => ({ ...s, projects: [project, ...s.projects].slice(0, 24) }));
  }, []);

  const updateProject = useCallback((id: string, patch: Partial<Project>) => {
    setState((s) => ({
      ...s,
      projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }, []);

  const removeProject = useCallback((id: string) => {
    setState((s) => ({ ...s, projects: s.projects.filter((p) => p.id !== id) }));
  }, []);

  const spendCredits = useCallback((amount: number, label: string) => {
    if (!generationService.isDemo) return;
    setState((s) => {
      const tx: CreditTransaction = {
        id: `tx-${Date.now()}`,
        label,
        amount: -amount,
        createdAt: new Date().toISOString(),
      };
      return {
        ...s,
        usage: {
          ...s.usage,
          creditsUsed: Math.min(s.usage.creditsTotal, s.usage.creditsUsed + amount),
          transactions: [tx, ...s.usage.transactions].slice(0, 25),
        },
      };
    });
  }, []);

  const resetDemoData = useCallback(() => {
    if (generationService.isDemo) setState(defaultState());
  }, []);

  const value = useMemo<StoreValue>(
    () => ({
      ...state,
      ready,
      addProject,
      updateProject,
      removeProject,
      spendCredits,
      resetDemoData,
      refreshRemote,
    }),
    [
      state,
      ready,
      addProject,
      updateProject,
      removeProject,
      spendCredits,
      resetDemoData,
      refreshRemote,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useMotionForge(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useMotionForge must be used inside MotionForgeProvider");
  return ctx;
}

/** Downscale an uploaded image so it fits comfortably in localStorage. */
export function readImageFile(file: File, maxSize = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file is not a readable image."));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Image processing is unavailable."));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.86));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
