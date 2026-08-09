type CommunityPostType = "moment" | "discussion" | "suggestion";

export type CommunityPostStatus =
  | "open"
  | "shortlisted"
  | "planned"
  | "used"
  | "completed"
  | "declined";

export interface CommunityPostV2 {
  id: string;
  channel_id: string;
  channel_slug: string;
  author_id: string;
  author_display_name: string;
  author_avatar_url: string | null;
  type: CommunityPostType;
  title: string;
  body: string | null;
  media_url: string | null;
  session_id: string | null;
  is_pinned: boolean;
  status: CommunityPostStatus;
  creator_response: string | null;
  vote_count: number;
  comment_count: number;
  user_voted: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommunityComment {
  id: string;
  post_id: string;
  author_id: string;
  author_display_name: string;
  author_avatar_url: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface CommunityPostEvent {
  id: string;
  post_id: string;
  actor_id: string;
  actor_display_name: string;
  event_type: "creator_response" | "status_change" | "added_to_rundown" | "used_on_stream";
  from_status: CommunityPostStatus | null;
  to_status: CommunityPostStatus | null;
  session_id: string | null;
  created_at: string;
}

export interface CommunityPostDetail {
  post: CommunityPostV2;
  comments: CommunityComment[];
  events: CommunityPostEvent[];
  is_member: boolean;
  is_owner: boolean;
}

export type CommunityNotificationType =
  | "comment"
  | "creator_response"
  | "status_change"
  | "used_on_stream";

export interface CommunityNotification {
  id: string;
  channel_slug: string;
  channel_display_name: string;
  post_id: string | null;
  type: CommunityNotificationType;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface CommunityRundownItem {
  id: string;
  session_id: string;
  post_id: string;
  position: number;
  state: "planned" | "used" | "skipped";
  title: string;
  author_display_name: string;
  vote_count: number;
  comment_count: number;
  creator_response: string | null;
  added_at: string;
  used_at: string | null;
}
