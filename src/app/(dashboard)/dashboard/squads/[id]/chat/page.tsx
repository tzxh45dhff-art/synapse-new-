import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { api } from "@/lib/api-client";
import { SquadTabs } from "@/components/squads/squad-tabs";
import { SquadChat } from "@/components/squads/chat/squad-chat";
import type { SquadDetail, SquadMemberItem, MemberProfile } from "@/types/squad";
import type { MessagePage } from "@/types/squad-chat";

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata = { title: "Chat — Bunker" };

export default async function SquadChatPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return notFound();

  const token = session.access_token;
  const [squadRes, membersRes, messagesRes] = await Promise.all([
    api.get<SquadDetail>(`/api/v1/squads/${id}`, { token }),
    api.get<SquadMemberItem[]>(`/api/v1/squads/${id}/members`, { token }),
    api.get<MessagePage>(`/api/v1/squads/${id}/messages`, { token }),
  ]);

  if (!squadRes.data) return notFound();

  const squad = squadRes.data;
  const userId = session.user.id;
  const myMembership = (membersRes.data ?? []).find((m) => m.user_id === userId);

  const currentUser: MemberProfile = myMembership?.profile ?? {
    id: userId,
    email: session.user.email ?? "",
    display_name: null,
    full_name: null,
    avatar_url: null,
  };

  const role = squad.current_user_role;
  const canSend = role !== "viewer";
  const canModerate = role === "owner" || role === "admin";

  const initialPage: MessagePage = messagesRes.data ?? {
    messages: [],
    has_more: false,
    next_before: null,
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-11rem)] max-w-4xl flex-col gap-4">
      <SquadTabs squadId={id} />
      <div className="min-h-0 flex-1">
        <SquadChat
          squadId={id}
          currentUser={currentUser}
          canSend={canSend}
          canModerate={canModerate}
          initialPage={initialPage}
        />
      </div>
    </div>
  );
}
