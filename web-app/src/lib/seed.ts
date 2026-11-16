import { getDb } from './db';

export function seedDatabase() {
  const db = getDb();

  // 1. Departments
  const deptStmt = db.prepare(`
    INSERT OR REPLACE INTO departments (id, code, name, head_teacher_id)
    VALUES (?, ?, ?, ?)
  `);
  deptStmt.run('dept-dbt', 'DBT', 'แผนกวิชาเทคโนโลยีธุรกิจดิจิทัล', 'user-head-pattana');

  // 2. Class Groups
  const groupStmt = db.prepare(`
    INSERT OR REPLACE INTO class_groups (id, department_id, group_code, level, advisor_teacher_id)
    VALUES (?, ?, ?, ?, ?)
  `);
  groupStmt.run('grp-vc1', 'dept-dbt', 'ปวช.1/1', 'ปวช.', 'user-t-thanaphisit');
  groupStmt.run('grp-vc2', 'dept-dbt', 'ปวช.2/1', 'ปวช.', 'user-t-arunee');
  groupStmt.run('grp-vc3', 'dept-dbt', 'ปวช.3/1', 'ปวช.', 'user-t-rattanawadee');
  groupStmt.run('grp-hvc1', 'dept-dbt', 'ปวส.1/1', 'ปวส.', 'user-head-pattana');
  groupStmt.run('grp-hvc2', 'dept-dbt', 'ปวส.2/1', 'ปวส.', 'user-t-atthamed');

  // 3. Users (8 Roles)
  const userStmt = db.prepare(`
    INSERT OR REPLACE INTO users (id, username, password_hash, full_name, role, class_group_id, department_id, phone, email, avatar_url, pdpa_consented, pdpa_consented_at, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

  // บุคลากรและครู
  userStmt.run(
    'user-head-pattana', 'teacher_pattana', '123456', 'ครูพัฒนา กลมพันธ์', 'dept_head',
    null, 'dept-dbt', '081-111-1111', 'pattana@oicec.ac.th',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    1, nowStr
  );
  userStmt.run(
    'user-t-atthamed', 'teacher_atthamed', '123456', 'ครูอรรถเมธ ตะโกนา', 'subject_teacher',
    null, 'dept-dbt', '082-222-2222', 'atthamed@oicec.ac.th',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    1, nowStr
  );
  userStmt.run(
    'user-t-thanaphisit', 'teacher_thanaphisit', '123456', 'ครูธนพิสิษฐ์ ทาพา', 'subject_teacher',
    null, 'dept-dbt', '083-333-3333', 'thanaphisit@oicec.ac.th',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    1, nowStr
  );
  userStmt.run(
    'user-t-arunee', 'teacher_arunee', '123456', 'ครูอรุณี สุนทรมณี', 'subject_teacher',
    null, 'dept-dbt', '084-444-4444', 'arunee@oicec.ac.th',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    1, nowStr
  );
  userStmt.run(
    'user-t-rattanawadee', 'teacher_rattanawadee', '123456', 'ครูรัตนาวดี อ่ำเจริญ', 'subject_teacher',
    null, 'dept-dbt', '085-555-5555', 'rattanawadee@oicec.ac.th',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
    1, nowStr
  );

  // ฝ่ายปกครอง & รอง ผอ. & รปภ. & แอดมิน
  userStmt.run(
    'user-discipline-01', 'discipline_01', '123456', 'เจ้าหน้าที่งานปกครอง วก.องครักษ์', 'discipline',
    null, null, '086-666-6666', 'discipline@oicec.ac.th',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    1, nowStr
  );
  userStmt.run(
    'user-deputy-chaiyot', 'deputy_dir_01', '123456', 'นายชัยยศ มีสวัสดิ์', 'deputy_director',
    null, null, '087-777-7777', 'chaiyot@oicec.ac.th',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
    1, nowStr
  );
  userStmt.run(
    'user-guard-gate1', 'guard_gate1', '123456', 'เจ้าหน้าที่ รปภ. ป้อมยามประตู 1', 'guard',
    null, null, '088-888-8888', 'guard1@oicec.ac.th',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150',
    1, nowStr
  );
  userStmt.run(
    'user-admin', 'admin_sys', '123456', 'ผู้ดูแลระบบกลาง วก.องครักษ์', 'admin',
    null, null, '080-000-0000', 'admin@oicec.ac.th',
    'https://images.unsplash.com/photo-1463453091185-61582044d556?w=150',
    1, nowStr
  );

  // นักศึกษา
  userStmt.run(
    'user-stu-akkaracha', '6731901001', '123456', 'นายอัครชา เปมะวิภาต', 'student',
    'grp-hvc2', 'dept-dbt', '089-999-9991', 'akkaracha@student.oicec.ac.th',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150',
    1, nowStr
  );
  userStmt.run(
    'user-stu-nattaphon', '6731901002', '123456', 'นายนัฐพล โหยหวล', 'student',
    'grp-hvc2', 'dept-dbt', '089-999-9992', 'nattaphon@student.oicec.ac.th',
    'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150',
    1, nowStr
  );
  userStmt.run(
    'user-stu-vc3-demo', '6521901001', '123456', 'นายสมชาย รักเรียน', 'student',
    'grp-vc3', 'dept-dbt', '089-999-9993', 'somchai@student.oicec.ac.th',
    'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=150',
    0, null
  );

  // 4. Courses Schedule
  const courseStmt = db.prepare(`
    INSERT OR REPLACE INTO courses_schedule (id, course_code, course_name, class_group_id, teacher_id, room, day_of_week, start_time, end_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  // ปวส.2/1
  courseStmt.run('cs-hvc2-wed-am', '31910-1003', 'การวิเคราะห์ข้อมูล', 'grp-hvc2', 'user-t-atthamed', 'ห้องปฏิบัติการ อวท.', 3, '08:00', '12:00');
  courseStmt.run('cs-hvc2-thu-pm', '31910-2023', 'การบำรุงรักษาคอมพิวเตอร์และอุปกรณ์พกพา', 'grp-hvc2', 'user-head-pattana', 'ห้องคอม 4', 4, '13:00', '17:00');
  courseStmt.run('cs-hvc2-fri-pm', '31910-2018', 'การผลิตสื่อมัลติมีเดียสำหรับธุรกิจดิจิทัล', 'grp-hvc2', 'user-t-arunee', 'ห้องคอม 3', 5, '13:00', '17:00');
  courseStmt.run('cs-hvc2-tue-am', '31910-2017', 'เทคโนโลยีความจริงเสริม', 'grp-hvc2', 'user-t-thanaphisit', 'ห้องคอม 2', 2, '08:00', '12:00');

  // ปวช.3/1
  courseStmt.run('cs-vc3-mon-am', '21910-2017', 'การพัฒนาโปรแกรมบนอุปกรณ์พกพาเบื้องต้น', 'grp-vc3', 'user-t-atthamed', 'ห้องคอม 1', 1, '08:00', '12:00');
  courseStmt.run('cs-vc3-tue-am', '21910-2019', 'การติดตั้งและงานบริการคอมพิวเตอร์', 'grp-vc3', 'user-t-rattanawadee', 'ห้องคอม 1', 2, '08:00', '12:00');

  // 5. Face Embeddings (Demo Embeddings)
  const faceStmt = db.prepare(`
    INSERT OR REPLACE INTO face_embeddings (id, user_id, embedding_vector, sample_image_path, is_active)
    VALUES (?, ?, ?, ?, 1)
  `);
  faceStmt.run(
    'face-akkaracha',
    'user-stu-akkaracha',
    JSON.stringify(new Array(512).fill(0).map((_, i) => Math.sin(i * 0.1))),
    '/uploads/faces/akkaracha.jpg'
  );
  faceStmt.run(
    'face-nattaphon',
    'user-stu-nattaphon',
    JSON.stringify(new Array(512).fill(0).map((_, i) => Math.cos(i * 0.1))),
    '/uploads/faces/nattaphon.jpg'
  );

  // 6. 4 Demo Scenarios (Leave Requests)
  const reqStmt = db.prepare(`
    INSERT OR REPLACE INTO leave_requests (
      id, request_code, student_id, course_id, category, reason, destination_name, destination_lat, destination_lng, attachment_path,
      leave_date, allowed_start_time, allowed_end_time, current_step, overall_status,
      checkin_lat, checkin_lng, checkin_at, checkin_distance_m, checkin_verified,
      step1_teacher_id, step1_status, step1_remark, step1_acted_at,
      step2_advisor_id, step2_status, step2_remark, step2_acted_at,
      step3_dept_head_id, step3_status, step3_remark, step3_acted_at,
      step4_discipline_id, step4_status, step4_remark, step4_acted_at,
      step5_deputy_id, step5_status, step5_remark, step5_acted_at,
      synced_to_gate
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?
    )
  `);

  const today = new Date().toISOString().split('T')[0];

  // Scenario A: #GP-2569-084 (อนุมัติครบ 5 ขั้นแล้ว อยู่ในช่วงเวลา Active -> สแกนเปิดไม้กั้นได้ทันที)
  reqStmt.run(
    'req-scenario-a',
    '#GP-2569-084',
    'user-stu-akkaracha',
    'cs-hvc2-wed-am',
    'medical',
    'มีนัดตรวจทันตกรรมตามนัด รพ.องครักษ์',
    'โรงพยาบาลองครักษ์',
    14.1350,
    100.9920,
    '/attachments/dental_appointment.pdf',
    today,
    '08:00',
    '23:59', // ครอบคลุมทั้งวันเพื่อให้ทดสอบสแกนไม้กั้นได้ตลอดเวลา
    6,
    'approved',
    14.1348, // เช็คอิน GPS แล้ว
    100.9922,
    `${today} 09:15:20`,
    28.4, // ห่าง 28.4 เมตร (อยู่ในเกณฑ์)
    1,
    'user-t-atthamed', 'approved', 'รับทราบ ไม่มีงานค้างในคาบ', nowStr,
    'user-t-atthamed', 'approved', 'ผู้ปกครองแจ้งประสานงานเรียบร้อย', nowStr,
    'user-head-pattana', 'approved', 'อนุมัติตามระเบียบแผนก', nowStr,
    'user-discipline-01', 'approved', 'ตรวจสอบประวัติเรียบร้อย', nowStr,
    'user-deputy-chaiyot', 'approved', 'อนุญาตให้ออกนอกสถานศึกษาได้', nowStr,
    1
  );

  // Scenario B: #GP-2569-085 (ผ่านขั้น 1-4 รอ รอง ผอ. ขั้นที่ 5 อนุมัติ 1 คลิกเพื่อดูการซิงค์สิทธิ์ Real-time)
  reqStmt.run(
    'req-scenario-b',
    '#GP-2569-085',
    'user-stu-nattaphon',
    'cs-hvc2-wed-am',
    'personal',
    'ไปทำบัตรประชาชนใหม่ที่ว่าการอำเภอองครักษ์ เนื่องจากบัตรชำรุด',
    'ที่ว่าการอำเภอองครักษ์',
    14.1205,
    100.9902,
    null,
    today,
    '13:00',
    '16:30',
    5,
    'pending',
    null, null, null, null, 0,
    'user-t-atthamed', 'approved', 'อนุญาตให้ออกหลังส่งงาน', nowStr,
    'user-t-atthamed', 'approved', 'ประสานงานผู้ปกครองแล้ว', nowStr,
    'user-head-pattana', 'approved', 'เห็นควรอนุญาต', nowStr,
    'user-discipline-01', 'approved', 'เอกสารถูกต้องตามระเบียบ', nowStr,
    'user-deputy-chaiyot', 'pending', null, null,
    0
  );

  // Scenario C: #GP-2569-086 (เพิ่งยื่นใหม่ในคาบเรียน รอขั้นที่ 1 ครูประจำวิชา)
  reqStmt.run(
    'req-scenario-c',
    '#GP-2569-086',
    'user-stu-akkaracha',
    'cs-hvc2-thu-pm',
    'department',
    'ไปจัดเตรียมสถานที่และอุปกรณ์นำเสนอโครงงานที่หอประชุมใหญ่',
    'หอประชุมใหญ่วิทยาลัยการอาชีพองครักษ์',
    14.1288,
    100.9980,
    null,
    today,
    '13:30',
    '16:30',
    1,
    'pending',
    null, null, null, null, 0,
    'user-head-pattana', 'pending', null, null,
    'user-t-atthamed', 'pending', null, null,
    'user-head-pattana', 'pending', null, null,
    'user-discipline-01', 'pending', null, null,
    'user-deputy-chaiyot', 'pending', null, null,
    0
  );

  // Scenario D: #GP-2569-080 (ไม่อนุมัติ / หมดอายุ สำหรับทดสอบกรณีสแกนแล้วไม่เปิดไม้กั้น)
  reqStmt.run(
    'req-scenario-d',
    '#GP-2569-080',
    'user-stu-vc3-demo',
    'cs-vc3-mon-am',
    'personal',
    'ขอออกไปซื้ออุปกรณ์ทำโครงงานนอกวิทยาลัย',
    'ร้านเครื่องเขียนองครักษ์',
    14.1250,
    100.9950,
    null,
    '2026-11-10',
    '09:00',
    '11:00',
    1,
    'rejected',
    null, null, null, null, 0,
    'user-t-atthamed', 'rejected', 'ไม่อนุญาตเนื่องจากมีสอบเก็บคะแนนปฏิบัติ', nowStr,
    null, 'pending', null, null,
    null, 'pending', null, null,
    null, 'pending', null, null,
    null, 'pending', null, null,
    0
  );

  // 7. Gate Exit Logs (ประวัติตัวอย่าง)
  const logStmt = db.prepare(`
    INSERT OR REPLACE INTO gate_exit_logs (id, request_id, student_id, direction, gps_lat, gps_lng, similarity_score, trigger_type, gate_opened_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  logStmt.run('log-demo-01', 'req-scenario-a', 'user-stu-akkaracha', 'exit', 14.1285, 100.9985, 0.942, 'ai_auto', `${today} 08:35:10`);

  return { success: true, message: 'Database seeded successfully with DBT master data & 4 scenarios' };
}
