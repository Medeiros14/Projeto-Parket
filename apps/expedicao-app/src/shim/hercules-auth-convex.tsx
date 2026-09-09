// Shim "@usehercules/auth/convex-react": provider vira passthrough.
export function ConvexProviderWithHerculesAuth({ children }: { children: React.ReactNode; client?: unknown }) {
  return <>{children}</>;
}
