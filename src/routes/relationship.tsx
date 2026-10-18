// Brief 5, screen three: relationship to the continent (SPEC sections 1, 6, 7). Its write is the
// only path that sets onboarded_at (ruling 307); the client then goes to the Feed and nothing
// follows (ruling 259). The six cards are vocabularies().stances, read at runtime in
// public.member_stances' position order and never held in a component (187, 1859).
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { RelationshipScreen } from "@/components/dna/OnboardingSurface";
import { useAuth } from "@/lib/auth";
import { onboardRelationship } from "@/lib/onboarding";
import { useOnboardingState, useRefreshOnboarding } from "@/lib/onboarding-hooks";
import { useTheme } from "@/lib/tier";
import { loadVocabularies } from "@/lib/vocabularies";

export const Route = createFileRoute("/relationship")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: Relationship,
});

function Relationship() {
  useTheme();
  const navigate = useNavigate();
  const { ready, member } = useAuth();
  const { data: state } = useOnboardingState(member?.id);
  const refresh = useRefreshOnboarding(member?.id);
  const vocab = useQuery({
    queryKey: ["vocabularies"],
    queryFn: loadVocabularies,
    enabled: ready && !!member,
    staleTime: Infinity,
  });
  useEffect(() => {
    if (ready && !member) void navigate({ to: "/sign-in" });
  }, [ready, member, navigate]);
  if (!ready || !member || !state) return null;
  return (
    <RelationshipScreen
      state={state}
      stances={vocab.data?.stances ?? []}
      onBack={() => void navigate({ to: "/where" })}
      onSubmit={async (input) => {
        try {
          const r = await onboardRelationship(input);
          if (r.status !== "ok") return "failed";
          await refresh();
          await navigate({ to: "/feed", search: {} });
          return "ok";
        } catch {
          return "failed";
        }
      }}
    />
  );
}
