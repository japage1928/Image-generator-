import { Link, useRouterState } from "@tanstack/react-router";
import {
  CircleHelp,
  CreditCard,
  Film,
  LifeBuoy,
  Menu,
  Plus,
  Sparkles,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useMotionForge } from "@/lib/motionforge/store";
import { generationService } from "@/lib/motionforge/generation-service";
import { useAuth } from "@/lib/auth/AuthProvider";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { to: "/", label: "Studio", icon: Sparkles },
  { to: "/projects", label: "Projects", icon: Film },
  { to: "/usage", label: "Usage & Credits", icon: Wallet },
  { to: "/billing", label: "Billing", icon: CreditCard },
  { to: "/support", label: "Support", icon: LifeBuoy },
];

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded-md" aria-label="MotionForge home">
      <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
        <Film className="size-4" aria-hidden />
      </span>
      <span className="text-[15px] font-semibold tracking-tight">MotionForge</span>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {NAV.map(({ to, label, icon: Icon }) => {
        const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-sidebar-accent text-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
            )}
          >
            <Icon className={cn("size-4", active && "text-primary")} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { usage } = useMotionForge();
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const remaining = Math.max(0, usage.creditsTotal - usage.creditsUsed);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 bg-sidebar p-4">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="mb-6 mt-1">
                <Logo />
              </div>
              <NavLinks onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="hidden lg:block">
            <Logo />
          </div>
          <div className="lg:hidden">
            <Logo />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button asChild size="sm" variant="secondary" className="hidden sm:inline-flex">
              <Link to="/">
                <Plus className="size-4" aria-hidden />
                New project
              </Link>
            </Button>
            <Link
              to="/usage"
              className="hidden items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground sm:flex"
            >
              <Wallet className="size-3.5 text-cyan" aria-hidden />
              <span className="text-foreground font-medium">{remaining}</span> credits left
            </Link>
            <Button asChild variant="ghost" size="icon" aria-label="Help and support">
              <Link to="/support">
                <CircleHelp className="size-5" />
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="rounded-full ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Account menu"
                >
                  <Avatar className="size-8">
                    <AvatarFallback className="bg-primary/20 text-xs text-primary">
                      {user ? (user.email || "U").slice(0, 2).toUpperCase() : "?"}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <span className="block truncate text-sm">{user?.email || "Guest"}</span>
                  <span className="block text-xs font-normal text-muted-foreground">
                    {user ? `${usage.plan} plan` : "Sign in to save your work"}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user ? (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to="/account">Account settings</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/usage">Usage & credits</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/billing">Billing</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/support">Support</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => void signOut()}>Sign out</DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem asChild>
                    <Link to="/login">Sign in</Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 border-r border-border bg-sidebar p-4 lg:block">
          <NavLinks />
          <div className="mt-6 rounded-xl border border-border bg-surface p-3">
            <p className="text-xs font-medium text-foreground">
              {generationService.isDemo ? "Demo mode" : "Live generation"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {generationService.isDemo
                ? "Renders are produced locally. Connect n8n for real video output."
                : "Jobs are sent to the configured image-to-video workflow."}
            </p>
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
