/**
 * Frontend-specific types for the squad system.
 * Extends the base model types with UI-specific fields.
 */

export interface SquadListItem {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  is_personal: boolean;
  member_count: number;
  current_user_role: string | null;
  created_at: string;
}

export interface SquadDetail {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  invite_code: string;
  is_personal: boolean;
  max_members: number;
  member_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  current_user_role: string | null;
}

export interface MemberProfile {
  id: string;
  email: string;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export interface SquadMemberItem {
  id: string;
  squad_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profile: MemberProfile | null;
}

export interface InvitationDetail {
  id: string;
  squad_id: string;
  squad_name: string | null;
  invited_by: string;
  inviter_name: string | null;
  token: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
}

export interface InvitationPublic {
  squad_name: string;
  squad_avatar_url: string | null;
  squad_member_count: number;
  role: string;
  status: string;
  expires_at: string;
  inviter_name: string | null;
  is_expired: boolean;
}

export interface SidebarUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
}
