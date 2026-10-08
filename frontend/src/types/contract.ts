/**
 * TypeScript mirror of the API + WebSocket contract in docs/memory.md §7.
 * Keep field names snake_case to match the wire format exactly.
 */

export type Role = "instructor" | "student" | "admin";

export type StudentState =
  | "attentive"
  | "sleepy"
  | "looking_away"
  | "no_face"
  | "camera_off"
  | "wrong_screen"
  | "uncertain"
  | "connection_problem";

export type SessionStatus = "live" | "ended";
export type AlertStatus = "open" | "acknowledged" | "resolved";
export type NudgeResponse = "i_am_back" | "connection_problem";

// ---------- REST objects ----------

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  roll_no: string | null;
}

export interface ClassSummary {
  id: string;
  name: string;
  course_code: string;
  instructor_id: string;
  created_at: string;
  student_count: number;
  slide_count: number;
  live_session_id: string | null;
}

export interface Session {
  id: string;
  class_id: string;
  status: SessionStatus;
  started_at: string;
  ended_at: string | null;
  current_slide_index: number;
  slide_count: number;
}

export interface Alert {
  id: string;
  session_id: string;
  student_id: string;
  roll_no: string | null;
  full_name: string;
  type: StudentState;
  severity: number;
  confidence: number;
  duration_s: number;
  grouped_count: number;
  status: AlertStatus;
  created_at: string;
  updated_at: string;
}

export interface Nudge {
  id: string;
  session_id: string;
  alert_id: string | null;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at: string;
}

export interface SlideInfo {
  index: number;
  text_preview: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  role: Exclude<Role, "admin">;
  roll_no?: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface EnrolResponse {
  enrolled: User[];
  not_found: string[];
}

export interface SlideUploadResponse {
  slide_count: number;
}

export interface JoinResponse {
  session: Session;
  livekit_url: string | null;
  livekit_token: string | null;
  ws_path: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string };
}

// ---------- WebSocket ----------

export interface Envelope<T extends string = string, P = unknown> {
  type: T;
  payload: P;
  ts: string;
}

/** One aggregated packet per second from the student browser. Numbers are null when unavailable. */
export interface VisionFeaturesPayload {
  ear: number | null;
  blink_rate: number | null;
  perclos: number | null;
  head_yaw: number | null;
  head_pitch: number | null;
  gaze_x: number | null;
  gaze_y: number | null;
  face_present: boolean;
  landmark_conf: number | null;
  camera_on: boolean;
  page_visible: boolean;
  window_focused: boolean;
}

export interface ScreenScorePayload {
  similarity: number;
  changed: boolean;
}

export interface NudgeReplyPayload {
  nudge_id: string;
  response: NudgeResponse;
}

export interface RosterStudent {
  student_id: string;
  roll_no: string | null;
  full_name: string;
  state: StudentState;
  confidence: number | null;
  since: string | null;
  connected: boolean;
}

export interface RosterSnapshotPayload {
  students: RosterStudent[];
}

export interface StatusUpdatePayload {
  student_id: string;
  roll_no: string | null;
  full_name: string;
  state: StudentState;
  confidence: number | null;
  since: string | null;
}

export interface SlideChangedPayload {
  slide_index: number;
}

export interface NudgeDeliverPayload {
  nudge_id: string;
  from: string;
  message: string;
  sound: boolean;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

export type ClientMessage =
  | Envelope<"vision.features", VisionFeaturesPayload>
  | Envelope<"screen.score", ScreenScorePayload>
  | Envelope<"nudge.reply", NudgeReplyPayload>
  | Envelope<"heartbeat", Record<string, never>>;

export type ServerMessage =
  | Envelope<"roster.snapshot", RosterSnapshotPayload>
  | Envelope<"status.update", StatusUpdatePayload>
  | Envelope<"alert.new", Alert>
  | Envelope<"alert.update", Alert>
  | Envelope<"slide.changed", SlideChangedPayload>
  | Envelope<"session.ended", Record<string, never>>
  | Envelope<"nudge.deliver", NudgeDeliverPayload>
  | Envelope<"error", ErrorPayload>
  | Envelope<"heartbeat", Record<string, never>>;

export type ServerMessageType = ServerMessage["type"];
export type ServerPayload<T extends ServerMessageType> = Extract<
  ServerMessage,
  { type: T }
>["payload"];
export type ClientMessageType = ClientMessage["type"];
export type ClientPayload<T extends ClientMessageType> = Extract<
  ClientMessage,
  { type: T }
>["payload"];
