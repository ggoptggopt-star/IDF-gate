-- ====================================================================
-- Smart Gate Pass AI — Database Schema (SQLite)
-- วิทยาลัยการอาชีพองครักษ์ (OICEC)
-- ====================================================================

-- 1. แผนกวิชา
CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    head_teacher_id TEXT
);

-- 2. กลุ่มเรียน / ห้องเรียน
CREATE TABLE IF NOT EXISTS class_groups (
    id TEXT PRIMARY KEY,
    department_id TEXT NOT NULL REFERENCES departments(id),
    group_code TEXT NOT NULL UNIQUE,
    level TEXT NOT NULL,
    advisor_teacher_id TEXT
);

-- 3. ผู้ใช้งานทุกบทบาท
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('student', 'subject_teacher', 'advisor', 'dept_head', 'discipline', 'deputy_director', 'guard', 'admin')),
    class_group_id TEXT REFERENCES class_groups(id),
    department_id TEXT REFERENCES departments(id),
    phone TEXT,
    email TEXT,
    avatar_url TEXT,
    push_subscription TEXT,
    pdpa_consented INTEGER NOT NULL DEFAULT 0,
    pdpa_consented_at TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 4. รายวิชาและตารางสอน
CREATE TABLE IF NOT EXISTS courses_schedule (
    id TEXT PRIMARY KEY,
    course_code TEXT NOT NULL,
    course_name TEXT NOT NULL,
    class_group_id TEXT NOT NULL REFERENCES class_groups(id),
    teacher_id TEXT NOT NULL REFERENCES users(id),
    room TEXT,
    day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 1 AND 7),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL
);

-- 5. ข้อมูลคุณลักษณะใบหน้า AI
CREATE TABLE IF NOT EXISTS face_embeddings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    embedding_vector TEXT,
    sample_image_path TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 6. ใบคำร้องขออนุญาตออกนอกสถานศึกษา (5 ขั้นตอน + พิกัด GPS Destination Check-in)
CREATE TABLE IF NOT EXISTS leave_requests (
    id TEXT PRIMARY KEY,
    request_code TEXT NOT NULL UNIQUE,
    student_id TEXT NOT NULL REFERENCES users(id),
    course_id TEXT REFERENCES courses_schedule(id),
    category TEXT NOT NULL CHECK(category IN ('medical', 'personal', 'department', 'parent_pickup')),
    reason TEXT NOT NULL,
    destination_name TEXT,
    destination_lat REAL,
    destination_lng REAL,
    attachment_path TEXT,
    leave_date TEXT NOT NULL,
    allowed_start_time TEXT NOT NULL,
    allowed_end_time TEXT NOT NULL,
    current_step INTEGER NOT NULL DEFAULT 1 CHECK(current_step BETWEEN 1 AND 6),
    overall_status TEXT NOT NULL DEFAULT 'pending' CHECK(overall_status IN ('pending', 'approved', 'rejected', 'completed_exit', 'returned', 'expired')),
    
    -- GPS Destination Check-in
    checkin_lat REAL,
    checkin_lng REAL,
    checkin_at TEXT,
    checkin_distance_m REAL,
    checkin_verified INTEGER NOT NULL DEFAULT 0,

    -- 5-Tier Approval Steps
    step1_teacher_id TEXT REFERENCES users(id),
    step1_status TEXT DEFAULT 'pending' CHECK(step1_status IN ('pending', 'approved', 'rejected')),
    step1_remark TEXT,
    step1_acted_at TEXT,
    
    step2_advisor_id TEXT REFERENCES users(id),
    step2_status TEXT DEFAULT 'pending' CHECK(step2_status IN ('pending', 'approved', 'rejected')),
    step2_remark TEXT,
    step2_acted_at TEXT,
    
    step3_dept_head_id TEXT REFERENCES users(id),
    step3_status TEXT DEFAULT 'pending' CHECK(step3_status IN ('pending', 'approved', 'rejected')),
    step3_remark TEXT,
    step3_acted_at TEXT,
    
    step4_discipline_id TEXT REFERENCES users(id),
    step4_status TEXT DEFAULT 'pending' CHECK(step4_status IN ('pending', 'approved', 'rejected')),
    step4_remark TEXT,
    step4_acted_at TEXT,
    
    step5_deputy_id TEXT REFERENCES users(id),
    step5_status TEXT DEFAULT 'pending' CHECK(step5_status IN ('pending', 'approved', 'rejected')),
    step5_remark TEXT,
    step5_acted_at TEXT,
    
    synced_to_gate INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 7. บันทึกประวัติการผ่านไม้กั้นหน้าประตู
CREATE TABLE IF NOT EXISTS gate_exit_logs (
    id TEXT PRIMARY KEY,
    request_id TEXT REFERENCES leave_requests(id),
    student_id TEXT REFERENCES users(id),
    direction TEXT NOT NULL CHECK(direction IN ('exit', 'return')),
    gps_lat REAL,
    gps_lng REAL,
    similarity_score REAL,
    snapshot_image_path TEXT,
    trigger_type TEXT NOT NULL DEFAULT 'ai_auto' CHECK(trigger_type IN ('ai_auto', 'guard_manual')),
    triggered_by_guard_id TEXT REFERENCES users(id),
    gate_opened_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Index เพื่อความรวดเร็วในการ Query
CREATE INDEX IF NOT EXISTS idx_requests_student ON leave_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON leave_requests(overall_status);
CREATE INDEX IF NOT EXISTS idx_schedule_group ON courses_schedule(class_group_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_logs_student ON gate_exit_logs(student_id);
