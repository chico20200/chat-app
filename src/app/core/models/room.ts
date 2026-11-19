export type RoomType = 'group' | 'direct';
export type MemberRole = 'owner' | 'member';

export interface Room {
  id: string;
  type: RoomType;
  name: string | null;
  description: string;
  is_private: boolean;
  dm_key: string | null;
  created_by: string;
  created_at: string;
}

export interface MemberProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export interface RoomMember {
  room_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string;
  profile: MemberProfile | null;
}