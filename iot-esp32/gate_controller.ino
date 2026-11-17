/*
 ======================================================================================
  โครงงาน: Smart Gate Pass AI — ระบบเปิดไม้กั้นอัตโนมัติด้วย AI จดจำใบหน้าและ IoT
  สถานศึกษา: วิทยาลัยการอาชีพองครักษ์ (OICEC)
  สาขางานเทคโนโลยีธุรกิจดิจิทัล ระดับชั้น ปวส. 2 กลุ่ม 1
  คณะผู้จัดทำ: 1. นายอัครชา เปมะวิภาต  2. นายนัฐพล โหยหวล
  ครูที่ปรึกษา: ครูอรรถเมธ ตะโกนา, ครูธนพิสิษฐ์ ทาพา
 ======================================================================================
  เฟิร์มแวร์ควบคุมชุดไม้กั้นจำลอง (ESP32 Barrier Gate Controller)
  บอร์ดไมโครคอนโทรลเลอร์: ESP32 DevKit V1 (30 ขา, ชิป CP2102)
  
  [ผังการต่อขาพินบนบอร์ด ESP32 DevKit V1 - ครบทั้ง 7 ชิ้น]:
    1. เซอร์โวมอเตอร์ TowerPro SG90   -> สายส้ม (PWM) ต่อขา GPIO 13 (VCC 5V, GND)
    2. เซนเซอร์อัลตราโซนิก HC-SR04     -> Trig ต่อขา GPIO 5, Echo ต่อขา GPIO 18 (VCC 5V, GND)
    3. จอ LCD 16x2 I2C (1602A)        -> SDA ต่อขา GPIO 21, SCL ต่อขา GPIO 22 (VCC 5V, GND)
    4. ลำโพง Piezo Buzzer            -> ขาบวก (+) ต่อขา GPIO 19, ขาลบ (-) ต่อ GND
    5. ไฟ LED สถานะสีเขียว (Green)   -> ขาบวก (+) ต่อขา GPIO 25 (ผ่าน R 220 Ohm ลง GND)
    6. ไฟ LED สถานะสีแดง (Red)        -> ขาบวก (+) ต่อขา GPIO 26 (ผ่าน R 220 Ohm ลง GND)
    7. กล้องเว็บแคม USB Full HD      -> ต่อเข้าคอมพิวเตอร์ประมวลผล AI ส่งคำสั่งผ่าน Wi-Fi HTTP
 ======================================================================================
*/

#include <WiFi.h>
#include <WebServer.h>
#include <ESP32Servo.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// --- ตั้งค่าเครือข่าย Wi-Fi ภายในสถานศึกษา / จุดสาธิต ---
const char* ssid     = "OICEC_GATE_DEMO";       // เปลี่ยนเป็นชื่อ Wi-Fi ที่ใช้งาน
const char* password = "password1234";          // รหัสผ่าน Wi-Fi

// --- กำหนดขาพินอุปกรณ์ (Pin Assignment) ---
#define PIN_SERVO         13   // SG90 Servo PWM
#define PIN_TRIG           5   // HC-SR04 Trigger
#define PIN_ECHO          18   // HC-SR04 Echo
#define PIN_BUZZER        19   // Piezo Buzzer
#define PIN_LED_GREEN     25   // LED สีเขียว (ไม้กั้นเปิด)
#define PIN_LED_RED       26   // LED สีแดง (ไม้กั้นปิด)

// --- ตัวแปรและออบเจ็กต์ ---
Servo gateServo;
LiquidCrystal_I2C lcd(0x27, 16, 2); // จอ LCD 16x2 Address I2C มาตรฐาน 0x27
WebServer server(80);

int currentAngle = 0;              // 0 องศา = ปิด, 90 องศา = เปิด
bool isGateOpen = false;
unsigned long openTimestamp = 0;
const unsigned long AUTO_CLOSE_DELAY_MS = 4000; // ปิดอัตโนมัติหลังเปิด 4 วินาที

// ฟังก์ชันวัดระยะทางด้วยเซนเซอร์ HC-SR04 (หน่วย: เซนติเมตร)
long readUltrasonicDistanceCm() {
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);
  
  long duration = pulseIn(PIN_ECHO, HIGH, 30000); // Timeout 30ms
  if (duration == 0) return 999; // หากไม่พบการสะท้อนกลับ
  return duration * 0.034 / 2;
}

// ฟังก์ชันส่งเสียงบี๊บแจ้งเตือน
void beep(int count, int delayMs) {
  for (int i = 0; i < count; i++) {
    digitalWrite(PIN_BUZZER, HIGH);
    delay(delayMs);
    digitalWrite(PIN_BUZZER, LOW);
    if (i < count - 1) delay(delayMs);
  }
}

// ฟังก์ชันสั่งเปิดไม้กั้น (ยกขึ้น 90 องศา)
void openGate(String studentName, String requestCode) {
  if (isGateOpen) return;

  Serial.println("[GATE] Command Received: OPEN GATE");
  isGateOpen = true;
  openTimestamp = millis();

  // 1. ควบคุมไฟสถานะ: แดงดับ, เขียวติด
  digitalWrite(PIN_LED_RED, LOW);
  digitalWrite(PIN_LED_GREEN, HIGH);

  // 2. ส่งเสียงบี๊บ 1 ครั้ง
  beep(1, 100);

  // 3. ขับเซอร์โวมอเตอร์ยกแขนกั้นขึ้น 90 องศา
  gateServo.write(90);
  currentAngle = 90;

  // 4. แสดงผลบนจอ LCD 16x2
  lcd.clear();
  lcd.setCursor(0, 0);
  if (studentName.length() > 0) {
    lcd.print("PASS: " + studentName.substring(0, 10));
  } else {
    lcd.print("PASS: GATE OPEN");
  }
  lcd.setCursor(0, 1);
  if (requestCode.length() > 0) {
    lcd.print(requestCode + " 90 DEG");
  } else {
    lcd.print("#GP-2569 ACTIVE");
  }
}

// ฟังก์ชันสั่งปิดไม้กั้น (พับลง 0 องศา)
void closeGate() {
  // ตรวจสอบ Safety Sensor (HC-SR04) ป้องกันไม้กั้นตีสิ่งกีดขวาง
  long dist = readUltrasonicDistanceCm();
  if (dist < 12) {
    Serial.println("[SAFETY HOLD] Object detected under gate (" + String(dist) + " cm) - Hold open!");
    openTimestamp = millis(); // หน่วงเวลาต่อไปอีก
    return;
  }

  Serial.println("[GATE] Closing gate...");
  isGateOpen = false;

  // 1. ขับเซอร์โวมอเตอร์พับแขนกั้นลง 0 องศา
  gateServo.write(0);
  currentAngle = 0;

  // 2. ควบคุมไฟสถานะ: เขียวดับ, แดงติด
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_RED, HIGH);

  // 3. แสดงผลบนจอ LCD สถานะพร้อม
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("SMART GATE PASS");
  lcd.setCursor(0, 1);
  lcd.print("GATE 1: READY");
}

// --- HTTP API Handlers ---
void handleRoot() {
  String html = "<html><head><meta charset='utf-8'><title>Smart Gate Pass AI - ESP32</title></head>";
  html += "<body style='font-family:sans-serif; text-align:center; padding:20px;'>";
  html += "<h2>วิทยาลัยการอาชีพองครักษ์ (OICEC)</h2>";
  html += "<h3>ESP32 Barrier Gate Controller</h3>";
  html += "<p>สถานะไม้กั้น: <b>" + String(isGateOpen ? "OPEN (90°)" : "CLOSED (0°)") + "</b></p>";
  html += "<p>ระยะอัลตราโซนิก: <b>" + String(readUltrasonicDistanceCm()) + " cm</b></p>";
  html += "<p><button onclick=\"fetch('/gate/open',{method:'POST'}).then(()=>location.reload())\" style='padding:10px 20px; font-size:16px;'>ทดสอบเปิดไม้กั้น</button></p>";
  html += "</body></html>";
  server.send(200, "text/html", html);
}

void handleGateOpenApi() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");

  String name = server.hasArg("name") ? server.arg("name") : "STUDENT";
  String code = server.hasArg("code") ? server.arg("code") : "#GP-2569";

  openGate(name, code);
  server.send(200, "application/json", "{\"success\":true,\"state\":\"open\",\"angle\":90}");
}

void handleGateCloseApi() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  closeGate();
  server.send(200, "application/json", "{\"success\":true,\"state\":\"closed\",\"angle\":0}");
}

void handleGateStatusApi() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  long dist = readUltrasonicDistanceCm();
  String json = "{\"is_open\":" + String(isGateOpen ? "true" : "false") +
                ",\"angle\":" + String(currentAngle) +
                ",\"distance_cm\":" + String(dist) +
                ",\"ip\":\"" + WiFi.localIP().toString() + "\"}";
  server.send(200, "application/json", json);
}

// --- ฟังก์ชัน Setup ---
void setup() {
  Serial.begin(115200);
  Serial.println("\n--- Smart Gate Pass AI - OICEC ESP32 Starting ---");

  // กำหนดโหมดขาพิน
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);

  // สถานะเริ่มต้น: ไฟแดงติด, ไฟเขียวดับ, บัซเซอร์เงียบ
  digitalWrite(PIN_LED_RED, HIGH);
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_BUZZER, LOW);

  // ตั้งค่าเซอร์โวมอเตอร์ SG90
  gateServo.setPeriodHertz(50); // มาตรฐาน Servo 50Hz
  gateServo.attach(PIN_SERVO, 500, 2400); // 500us - 2400us pulse
  gateServo.write(0); // ปิดไม้กั้นแนวนอน

  // ตั้งค่าจอ LCD 16x2 I2C
  Wire.begin(21, 22); // SDA = GPIO 21, SCL = GPIO 22
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("SMART GATE PASS");
  lcd.setCursor(0, 1);
  lcd.print("CONNECTING WIFI");

  // เชื่อมต่อ Wi-Fi
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 20) {
    delay(500);
    Serial.print(".");
    retry++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WIFI] Connected! IP Address: " + WiFi.localIP().toString());
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("IP: " + WiFi.localIP().toString().substring(0, 12));
    lcd.setCursor(0, 1);
    lcd.print("GATE 1: READY");
    beep(2, 80); // เสียงพร้อมทำงาน
  } else {
    Serial.println("\n[WIFI] Connect Failed. Running in Standalone AP mode.");
    WiFi.softAP("OICEC_GATE_AP", "12345678");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("AP: OICEC_GATE");
    lcd.setCursor(0, 1);
    lcd.print("IP: 192.168.4.1");
  }

  // กำหนด Web Server Endpoints
  server.on("/", HTTP_GET, handleRoot);
  server.on("/gate/open", HTTP_POST, handleGateOpenApi);
  server.on("/gate/close", HTTP_POST, handleGateCloseApi);
  server.on("/gate/status", HTTP_GET, handleGateStatusApi);
  server.begin();
  Serial.println("[SERVER] HTTP REST Server started on port 80");
}

// --- ฟังก์ชัน Loop ---
void loop() {
  server.handleClient();

  // ตรวจสอบระบบนับถอยหลังปิดไม้กั้นอัตโนมัติ (Auto-close timer)
  if (isGateOpen && (millis() - openTimestamp >= AUTO_CLOSE_DELAY_MS)) {
    closeGate();
  }

  delay(10);
}
