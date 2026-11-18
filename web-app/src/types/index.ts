export type UserRole =
  | 'student'
  | 'subject_teacher'
  | 'advisor'
  | 'dept_head'
  | 'discipline'
  | 'deputy_director'
  | 'guard'
  | 'admin';

export interface User {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  class_group_id?: string | null;
  department_id?: string | null;
  phone?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  group_code?: string | null;
  level?: string | null;
  department_name?: string | null;
  home_lat?: number | null;
  home_lng?: number | null;
  home_address?: string | null;
  is_face_enrolled?: number;
  face_enrolled_at?: string | null;
  pdpa_consented?: number;
  pdpa_consented_at?: string | null;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  head_teacher_id?: string | null;
}

export interface ClassGroup {
  id: string;
  department_id: string;
  group_code: string;
  level: string;
  advisor_teacher_id?: string | null;
}

export interface CourseSchedule {
  id: string;
  course_code: string;
  course_name: string;
  class_group_id: string;
  teacher_id: string;
  teacher_name?: string;
  room: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export type LeaveCategory = 'medical' | 'personal' | 'department' | 'parent_pickup';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'completed_exit' | 'returned' | 'expired';

export interface LeaveRequest {
  id: string;
  request_code: string;
  student_id: string;
  student_name?: string;
  student_code?: string;
  group_code?: string;
  course_id?: string | null;
  course_name?: string | null;
  category: LeaveCategory;
  reason: string;
  destination_name?: string | null;
  destination_lat?: number | null;
  destination_lng?: number | null;
  attachment_path?: string | null;
  leave_date: string;
  allowed_start_time: string;
  allowed_end_time: string;
  current_step: number;
  overall_status: LeaveStatus;
  
  // GPS Destination Check-in
  checkin_lat?: number | null;
  checkin_lng?: number | null;
  checkin_at?: string | null;
  checkin_distance_m?: number | null;
  checkin_verified?: number;

  // Rider-Style Trip Tracking
  is_return_required?: number;
  trip_stage?: 'not_started' | 'heading_to_dest' | 'at_dest' | 'heading_back' | 'completed';
  dest_arrived_at?: string | null;
  return_arrived_at?: string | null;
  current_lat?: number | null;
  current_lng?: number | null;

  step1_teacher_id?: string | null;
  step1_status?: string | null;
  step1_remark?: string | null;
  step1_acted_at?: string | null;

  step2_advisor_id?: string | null;
  step2_status?: string | null;
  step2_remark?: string | null;
  step2_acted_at?: string | null;

  step3_dept_head_id?: string | null;
  step3_status?: string | null;
  step3_remark?: string | null;
  step3_acted_at?: string | null;

  step4_discipline_id?: string | null;
  step4_status?: string | null;
  step4_remark?: string | null;
  step4_acted_at?: string | null;

  step5_deputy_id?: string | null;
  step5_status?: string | null;
  step5_remark?: string | null;
  step5_acted_at?: string | null;

  synced_to_gate: number;
  created_at: string;
  updated_at: string;
}

export interface GateExitLog {
  id: string;
  request_id?: string | null;
  request_code?: string | null;
  student_id?: string | null;
  student_name?: string | null;
  direction: 'exit' | 'return';
  gps_lat?: number | null;
  gps_lng?: number | null;
  similarity_score?: number | null;
  snapshot_image_path?: string | null;
  trigger_type: 'ai_auto' | 'guard_manual';
  triggered_by_guard_id?: string | null;
  gate_opened_at: string;
}
