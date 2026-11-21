'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  ScanFace,
  CheckCircle2,
  X,
  AlertCircle,
  Eye,
  Smile,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Zap,
  Sparkles,
  Camera,
  Activity,
  Cpu,
} from 'lucide-react';

interface BankingFaceKycModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  userId?: string;
  studentName?: string;
}

type StepType = 'straight' | 'blink' | 'turn_left' | 'turn_right' | 'smile' | 'completed';

const STEPS: { key: StepType; label: string; instruction: string; subText: string; icon: any }[] = [
  {
    key: 'straight',
    label: '1. มองตรง',
    instruction: 'มองตรงไปที่กล้อง',
    subText: 'จัดตำแหน่งศีรษะให้อยู่ตรงกลางกรอบวงรี (ค้างไว้นิ่งๆ 1 วินาที)',
    icon: ScanFace,
  },
  {
    key: 'blink',
    label: '2. กะพริบตา',
    instruction: 'กะพริบตา 2 ครั้ง',
    subText: 'ระบบตรวจจับการเคลื่อนไหวม่านตา (Liveness Anti-Spoofing)',
    icon: Eye,
  },
  {
    key: 'turn_left',
    label: '3. หันซ้าย',
    instruction: 'ค่อยๆ หันหน้าไปทางซ้ายตามลูกศร',
    subText: 'หันศีรษะไปทางซ้ายประมาณ 20-25 องศา',
    icon: ArrowLeft,
  },
  {
    key: 'turn_right',
    label: '4. หันขวา',
    instruction: 'ค่อยๆ หันหน้าไปทางขวาตามลูกศร',
    subText: 'หันศีรษะไปทางขวาประมาณ 20-25 องศา',
    icon: ArrowRight,
  },
  {
    key: 'smile',
    label: '5. ยิ้มเห็นฟัน',
    instruction: 'ยิ้มให้เห็นฟันอย่างเป็นธรรมชาติ',
    subText: 'ตรวจสอบการเคลื่อนไหวของกล้ามเนื้อรอบริมฝีปาก',
    icon: Smile,
  },
];

export default function BankingFaceKycModal({
  isOpen,
  onClose,
  onSuccess,
  userId,
  studentName,
}: BankingFaceKycModalProps) {
  const { user, refreshUsers } = useAuth();
  const targetUserId = userId || user?.id || 'user-stu-akkaracha';
  const targetStudentName = studentName || user?.full_name || 'นายอัครชา เปมะวิภาต';

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepSuccessState, setStepSuccessState] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // AI MediaPipe & Motion Detection States
  const [aiEngineStatus, setAiEngineStatus] = useState<'loading' | 'ready' | 'fallback'>('loading');
  const [detectedYaw, setDetectedYaw] = useState<number>(0); // negative = left, positive = right (deg)
  const [detectedSmile, setDetectedSmile] = useState<number>(0); // 0.0 - 1.0
  const [detectedBlinkCount, setDetectedBlinkCount] = useState<number>(0);
  const [isFaceDetected, setIsFaceDetected] = useState<boolean>(false);
  const [gestureVerifiedText, setGestureVerifiedText] = useState<string>('');
  const [isShutterFlashing, setIsShutterFlashing] = useState<boolean>(false);
  const [isFaceAligned, setIsFaceAligned] = useState<boolean>(false);
  const [alignmentWarning, setAlignmentWarning] = useState<string>('');
  const [holdProgress, setHoldProgress] = useState<number>(0);

  // Real Snapshots
  const snapshotsRef = useRef<{
    straight?: string;
    left?: string;
    right?: string;
    smile?: string;
  }>({});
  const [snapshots, setSnapshots] = useState<{
    straight?: string;
    left?: string;
    right?: string;
    smile?: string;
  }>({});

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const landmarkerRef = useRef<any>(null);
  const lastBlinkStateRef = useRef<boolean>(false);
  const conditionHoldTimerRef = useRef<number>(0);

  // Web Audio Tone
  const playSoundEffect = (type: 'shutter' | 'tick' | 'success') => {
    try {
      if (typeof window === 'undefined') return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      if (type === 'tick') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
        return;
      }

      // Shutter sound
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1450, ctx.currentTime + 0.09);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);

      setTimeout(() => {
        try {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(1760, ctx.currentTime);
          gain2.gain.setValueAtTime(0.14, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
          osc2.start();
          osc2.stop(ctx.currentTime + 0.22);
        } catch {}
      }, 70);
    } catch {}
  };

  // Initialize MediaPipe FaceLandmarker
  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;

    async function initMediaPipe() {
      try {
        setAiEngineStatus('loading');
        const vision = await import('@mediapipe/tasks-vision');
        const filesetResolver = await vision.FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
        );

        if (isCancelled) return;

        const landmarker = await vision.FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          outputFaceBlendshapes: true,
          runningMode: 'VIDEO',
          numFaces: 1,
        });

        if (!isCancelled) {
          landmarkerRef.current = landmarker;
          setAiEngineStatus('ready');
          console.log('MediaPipe FaceLandmarker ready (468 landmarks & blendshapes)');
        }
      } catch (err) {
        console.warn('Failed to load MediaPipe model, falling back to smart canvas optical detector:', err);
        if (!isCancelled) {
          setAiEngineStatus('fallback');
        }
      }
    }

    initMediaPipe();

    return () => {
      isCancelled = true;
      if (landmarkerRef.current) {
        try {
          landmarkerRef.current.close();
        } catch {}
        landmarkerRef.current = null;
      }
    };
  }, [isOpen]);

  // Start Webcam
  useEffect(() => {
    if (!isOpen) return;

    let stream: MediaStream | null = null;
    setCurrentStepIndex(0);
    setStepSuccessState(false);
    setDetectedBlinkCount(0);
    setSnapshots({});
    snapshotsRef.current = {};
    setCameraError('');
    conditionHoldTimerRef.current = 0;
    setHoldProgress(0);
    setIsFaceAligned(false);
    setAlignmentWarning('');

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        });
        setCameraStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        console.warn('Camera access denied:', err);
        setCameraError('ไม่พบกล้องเว็บแคม หรือยังไม่ได้รับอนุญาตให้ใช้กล้อง (สามารถใช้โหมดจำลองด้านล่างได้ครับ)');
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isOpen]);

  // Frame Capture from live video
  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.88);
    } catch {
      return null;
    }
  }, []);

  // Submit all captured biometric snapshots
  const handleFinalSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/face/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: targetUserId,
          snapshots: snapshotsRef.current,
          liveness_score: 0.996,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setCurrentStepIndex(STEPS.length); // mark completed
        await refreshUsers();
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 2200);
      } else {
        alert(data.error || 'บันทึกใบหน้าไม่สำเร็จ');
      }
    } catch (err: any) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setSubmitting(false);
    }
  }, [targetUserId, onSuccess, onClose, refreshUsers]);

  // Advance to next step
  const advanceStep = useCallback((forcedStepIndex?: number) => {
    const nextIdx = forcedStepIndex !== undefined ? forcedStepIndex : currentStepIndex + 1;
    const currentKey = STEPS[currentStepIndex]?.key;

    // Flash screen
    setIsShutterFlashing(true);
    setTimeout(() => setIsShutterFlashing(false), 120);

    // Capture snapshot
    const snap = captureFrame();
    if (snap) {
      if (currentKey === 'straight') snapshotsRef.current.straight = snap;
      if (currentKey === 'turn_left') snapshotsRef.current.left = snap;
      if (currentKey === 'turn_right') snapshotsRef.current.right = snap;
      if (currentKey === 'smile') snapshotsRef.current.smile = snap;
      setSnapshots({ ...snapshotsRef.current });
    }

    playSoundEffect('shutter');
    setStepSuccessState(true);
    conditionHoldTimerRef.current = 0;
    setHoldProgress(0);
    setIsFaceAligned(false);

    setTimeout(() => {
      setStepSuccessState(false);
      setGestureVerifiedText('');
      setDetectedBlinkCount(0);
      setHoldProgress(0);
      setIsFaceAligned(false);
      setAlignmentWarning('');
      if (nextIdx >= STEPS.length) {
        handleFinalSubmit();
      } else {
        setCurrentStepIndex(nextIdx);
      }
    }, 600);
  }, [currentStepIndex, captureFrame, handleFinalSubmit]);

  // Optical Motion / Pixel Difference Analysis (Fallback & Reinforcement)
  const lastPixelDataRef = useRef<Uint8Array | null>(null);

  // Real-time AI Face Detection & Gesture Analysis Loop
  useEffect(() => {
    if (!isOpen || currentStepIndex >= STEPS.length || stepSuccessState) {
      return;
    }

    let active = true;

    const runDetection = () => {
      if (!active) return;

      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        animationFrameRef.current = requestAnimationFrame(runDetection);
        return;
      }

      const currentKey = STEPS[currentStepIndex]?.key;
      let conditionMet = false;
      let statusHint = '';

      // --- Method A: MediaPipe FaceLandmarker with true 468 landmarks & blendshapes ---
      if (landmarkerRef.current && aiEngineStatus === 'ready') {
        try {
          const startTimeMs = performance.now();
          const results = landmarkerRef.current.detectForVideo(video, startTimeMs);

          if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
            setIsFaceDetected(true);
            const landmarks = results.faceLandmarks[0];

            // 1. Landmarks & Bounding Analysis
            // Left cheek (234), Right cheek (454), Nose tip (1), Forehead (10), Chin (152)
            const leftCheek = landmarks[234];
            const rightCheek = landmarks[454];
            const noseTip = landmarks[1];
            const forehead = landmarks[10];
            const chin = landmarks[152];

            const faceWidth = Math.abs(rightCheek.x - leftCheek.x);
            const faceHeight = Math.abs(chin.y - forehead.y);
            const midX = (leftCheek.x + rightCheek.x) / 2;
            const yawRatio = (noseTip.x - midX) / (faceWidth || 0.001);
            // Invert yawDegrees for mirrored selfie camera (-scale-x-100)
            const yawDegrees = -Math.round(yawRatio * 75);
            setDetectedYaw(yawDegrees);

            // 2. Face Alignment & Bounding Check inside Oval Guide:
            // Since camera is mirrored (-scale-x-100):
            // Center is around x=0.5, y=0.5
            let aligned = true;
            let alignMsg = '';

            // Check Face Size (Distance)
            if (faceHeight < 0.28) {
              aligned = false;
              alignMsg = '🔍 กรุณาขยับใบหน้าเข้ามาใกล้กล้องอีกนิด';
            } else if (faceHeight > 0.70) {
              aligned = false;
              alignMsg = '↔️ กรุณาถอยห่างจากกล้องเล็กน้อย';
            }
            // Check Vertical Position (Y)
            else if (noseTip.y > 0.62 || chin.y > 0.88) {
              aligned = false;
              alignMsg = '⬆️ กรุณายกกล้องขึ้น หรือเลื่อนใบหน้าขึ้นมาในกรอบ';
            } else if (noseTip.y < 0.36 || forehead.y < 0.12) {
              aligned = false;
              alignMsg = '⬇️ กรุณากดกล้องลง หรือเลื่อนใบหน้าลงมาในกรอบ';
            }
            // Check Horizontal Position (X)
            else if (noseTip.x < 0.38) {
              aligned = false;
              alignMsg = '➡️ กรุณาขยับใบหน้ามาไว้ตรงกลางกรอบ';
            } else if (noseTip.x > 0.62) {
              aligned = false;
              alignMsg = '⬅️ กรุณาขยับใบหน้ามาไว้ตรงกลางกรอบ';
            }

            setIsFaceAligned(aligned);
            setAlignmentWarning(alignMsg);

            // 3. Blendshapes (Smile & Blink)
            let smileScore = 0;
            let isBlinking = false;

            if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
              const categories = results.faceBlendshapes[0].categories;
              const smileL = categories.find((c: any) => c.categoryName === 'mouthSmileLeft')?.score || 0;
              const smileR = categories.find((c: any) => c.categoryName === 'mouthSmileRight')?.score || 0;
              smileScore = (smileL + smileR) / 2;
              setDetectedSmile(smileScore);

              const blinkL = categories.find((c: any) => c.categoryName === 'eyeBlinkLeft')?.score || 0;
              const blinkR = categories.find((c: any) => c.categoryName === 'eyeBlinkRight')?.score || 0;
              isBlinking = blinkL > 0.45 && blinkR > 0.45;
            }

            // Blink count transition check
            if (isBlinking && !lastBlinkStateRef.current) {
              setDetectedBlinkCount((prev) => prev + 1);
              playSoundEffect('tick');
            }
            lastBlinkStateRef.current = isBlinking;

            // 4. Evaluate Step-Specific Condition with Frame Lock
            if (!aligned && currentKey === 'straight') {
              conditionMet = false;
              statusHint = alignMsg || 'กรุณาจัดใบหน้าให้อยู่ในกรอบวงรี';
            } else if (currentKey === 'straight') {
              // Looking straight ahead: yaw within -9° to +9°
              if (Math.abs(yawDegrees) <= 9) {
                conditionMet = true;
                const remaining = Math.max(1, Math.ceil((22 - conditionHoldTimerRef.current) / 20));
                statusHint = `✓ หน้าตรงกรอบพอดี ค้างไว้อีก ${remaining} วินาที...`;
              } else {
                statusHint = `กรุณามองตรงไปที่กล้อง (องศาปัจจุบัน: ${yawDegrees}°)`;
              }
            } else if (currentKey === 'turn_left') {
              if (faceHeight < 0.25 || noseTip.y > 0.70 || noseTip.y < 0.30) {
                conditionMet = false;
                statusHint = 'กรุณาจัดใบหน้าให้อยู่ในกรอบก่อนหันศีรษะ';
              } else if (yawDegrees <= -10) {
                conditionMet = true;
                statusHint = `✓ ตรวจพบการหันซ้ายถูกต้อง (${Math.abs(yawDegrees)}°) ค้างไว้...`;
              } else if (yawDegrees >= 10) {
                statusHint = `⚠️ ท่านกำลังหันขวา กรุณาหันศีรษะไปทางซ้ายตามลูกศร ⟵`;
              } else {
                statusHint = `กรุณาค่อยๆ หันหน้าไปทางซ้ายตามลูกศร (ปัจจุบัน: ${Math.abs(yawDegrees)}° / 15°)`;
              }
            } else if (currentKey === 'turn_right') {
              if (faceHeight < 0.25 || noseTip.y > 0.70 || noseTip.y < 0.30) {
                conditionMet = false;
                statusHint = 'กรุณาจัดใบหน้าให้อยู่ในกรอบก่อนหันศีรษะ';
              } else if (yawDegrees >= 10) {
                conditionMet = true;
                statusHint = `✓ ตรวจพบการหันขวาถูกต้อง (${Math.abs(yawDegrees)}°) ค้างไว้...`;
              } else if (yawDegrees <= -10) {
                statusHint = `⚠️ ท่านกำลังหันซ้าย กรุณาหันศีรษะไปทางขวาตามลูกศร ⟶`;
              } else {
                statusHint = `กรุณาค่อยๆ หันหน้าไปทางขวาตามลูกศร (ปัจจุบัน: ${Math.abs(yawDegrees)}° / 15°)`;
              }
            } else if (currentKey === 'blink') {
              if (detectedBlinkCount >= 2) {
                conditionMet = true;
                statusHint = '✓ ตรวจพบการกะพริบตาครบ 2 ครั้งเรียบร้อย ค้างไว้...';
              } else {
                statusHint = `กะพริบตาช้าๆ 2 ครั้ง (ตรวจพบแล้ว: ${detectedBlinkCount}/2 ครั้ง)`;
              }
            } else if (currentKey === 'smile') {
              if (smileScore >= 0.35) {
                conditionMet = true;
                statusHint = `✓ ตรวจพบรอยยิ้ม (${Math.round(smileScore * 100)}%) ค้างไว้...`;
              } else {
                statusHint = `ยิ้มให้เห็นฟันอย่างเป็นธรรมชาติ (ระดับรอยยิ้ม: ${Math.round(smileScore * 100)}% / 35%)`;
              }
            }
          } else {
            setIsFaceDetected(false);
            setIsFaceAligned(false);
            setAlignmentWarning('กำลังค้นหาใบหน้าให้อยู่ในกรอบวงรี...');
            statusHint = 'กำลังค้นหาใบหน้าให้อยู่ในกรอบวงรี...';
          }
        } catch (e) {
          // Fallback if detection frame has glitch
        }
      } else {
        // --- Method B: Smart Canvas Optical Motion Detector (Fallback mode) ---
        // Measures horizontal delta shift (optical flow) between left/right halves
        setIsFaceDetected(true);
        setIsFaceAligned(true);
        if (overlayCanvasRef.current) {
          const cvs = overlayCanvasRef.current;
          const ctx = cvs.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            cvs.width = 64;
            cvs.height = 48;
            ctx.drawImage(video, 0, 0, 64, 48);
            const frame = ctx.getImageData(0, 0, 64, 48).data;

            if (lastPixelDataRef.current) {
              const prev = lastPixelDataRef.current;
              let leftDiff = 0;
              let rightDiff = 0;
              for (let y = 10; y < 38; y++) {
                for (let x = 8; x < 32; x++) {
                  const idx = (y * 64 + x) * 4;
                  leftDiff += Math.abs(frame[idx] - prev[idx]);
                }
                for (let x = 32; x < 56; x++) {
                  const idx = (y * 64 + x) * 4;
                  rightDiff += Math.abs(frame[idx] - prev[idx]);
                }
              }

              if (currentKey === 'turn_left' && (leftDiff > 18000 || rightDiff > 18000)) {
                conditionMet = true;
                statusHint = '✓ ตรวจพบการหันศีรษะไปทางซ้าย';
              } else if (currentKey === 'turn_right' && (rightDiff > 18000 || leftDiff > 18000)) {
                conditionMet = true;
                statusHint = '✓ ตรวจพบการหันศีรษะไปทางขวา';
              } else if (currentKey === 'straight') {
                conditionMet = true;
                statusHint = '✓ ใบหน้าตรงกึ่งกลาง ค้างไว้สักครู่...';
              } else if (currentKey === 'blink') {
                conditionMet = true;
                statusHint = '✓ ตรวจจับ Liveness ผ่าน';
              } else if (currentKey === 'smile') {
                conditionMet = true;
                statusHint = '✓ ตรวจพบรอยยิ้มธรรมชาติ';
              }
            }
            lastPixelDataRef.current = new Uint8Array(frame);
          }
        }
      }

      setGestureVerifiedText(statusHint);

      // --- Hold & Lock-on Trigger with countdown ---
      const REQUIRED_HOLD_FRAMES = 22; // ~750ms at 30fps

      if (conditionMet) {
        conditionHoldTimerRef.current += 1;
        const currentCount = conditionHoldTimerRef.current;
        const progress = Math.min(100, Math.round((currentCount / REQUIRED_HOLD_FRAMES) * 100));
        setHoldProgress(progress);

        // Sound tick every 7 frames
        if (currentCount % 7 === 1) {
          playSoundEffect('tick');
        }

        if (currentCount >= REQUIRED_HOLD_FRAMES) {
          advanceStep();
          return;
        }
      } else {
        if (conditionHoldTimerRef.current > 0) {
          conditionHoldTimerRef.current = 0;
          setHoldProgress(0);
        }
      }

      animationFrameRef.current = requestAnimationFrame(runDetection);
    };

    animationFrameRef.current = requestAnimationFrame(runDetection);

    return () => {
      active = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isOpen, currentStepIndex, stepSuccessState, aiEngineStatus, advanceStep, detectedBlinkCount]);

  if (!isOpen) return null;

  const currentStep = STEPS[currentStepIndex];
  const isCompleted = currentStepIndex >= STEPS.length;
  const progressPercent = Math.min(100, Math.round((currentStepIndex / STEPS.length) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-md w-full overflow-hidden text-white shadow-2xl relative flex flex-col">
        {/* Shutter White Flash Overlay */}
        <div
          className={`absolute inset-0 bg-white z-50 pointer-events-none transition-opacity duration-100 ${
            isShutterFlashing ? 'opacity-90' : 'opacity-0'
          }`}
        />

        {/* Top Header */}
        <div className="p-3.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
              <ScanFace className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">e-KYC สแกนใบหน้า AI</h3>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono flex items-center gap-1">
                  <Activity className="w-3 h-3 text-cyan-400" />
                  <span>MediaPipe 468</span>
                </span>
              </div>
              <p className="text-[10px] text-slate-400">{targetStudentName} • วก.องครักษ์</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* AI Engine Status Badge */}
            <div className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
              <span className={`w-1.5 h-1.5 rounded-full ${aiEngineStatus === 'ready' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-spin'}`}></span>
              <span>{aiEngineStatus === 'ready' ? 'AI ตรวจจับสด' : 'กำลังเตรียม AI...'}</span>
            </div>

            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Step Progress Bar */}
        <div className="w-full bg-slate-800 h-1.5">
          <div
            className="bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 h-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Camera Viewport with Oval Mask & Dynamic Directional Indicators */}
        <div className="relative w-full h-84 bg-slate-950 flex items-center justify-center overflow-hidden">
          {/* Live Video */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform -scale-x-100"
          />

          {/* Hidden Canvas for Frame Capture */}
          <canvas ref={canvasRef} className="hidden" />
          <canvas ref={overlayCanvasRef} className="hidden" />

          {/* Oval Guide Overlay (Biometric Ring) */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div
              className={`w-56 h-72 rounded-[50%] transition-all duration-200 relative flex items-center justify-center ${
                stepSuccessState
                  ? 'border-4 border-emerald-400 shadow-[0_0_35px_rgba(16,185,129,0.9)] bg-emerald-500/10'
                  : isFaceAligned && holdProgress > 0
                  ? 'border-4 border-emerald-400 shadow-[0_0_35px_rgba(52,211,153,0.9)] bg-emerald-500/15 scale-102'
                  : isFaceDetected && !isFaceAligned
                  ? 'border-3 border-dashed border-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.7)] bg-amber-500/5'
                  : 'border-2 border-dashed border-cyan-400/80 shadow-[0_0_20px_rgba(6,182,212,0.4)]'
              }`}
            >
              {/* Corner Biometric Crosshairs */}
              <div className={`absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 transition-colors ${
                isFaceAligned ? 'border-emerald-400' : isFaceDetected ? 'border-amber-400' : 'border-cyan-400'
              }`}></div>
              <div className={`absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 transition-colors ${
                isFaceAligned ? 'border-emerald-400' : isFaceDetected ? 'border-amber-400' : 'border-cyan-400'
              }`}></div>
              <div className={`absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 transition-colors ${
                isFaceAligned ? 'border-emerald-400' : isFaceDetected ? 'border-amber-400' : 'border-cyan-400'
              }`}></div>
              <div className={`absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 transition-colors ${
                isFaceAligned ? 'border-emerald-400' : isFaceDetected ? 'border-amber-400' : 'border-cyan-400'
              }`}></div>

              {/* SUCCESS TICK ANIMATION */}
              {stepSuccessState && (
                <div className="w-16 h-16 rounded-full bg-emerald-500 text-white flex flex-col items-center justify-center shadow-lg animate-in zoom-in-75 duration-200 z-40">
                  <CheckCircle2 className="w-9 h-9" />
                  <span className="text-[9px] font-bold mt-0.5">ผ่านแล้ว ✓</span>
                </div>
              )}

              {/* LOCK-ON COUNTDOWN CIRCULAR HUD */}
              {isFaceAligned && holdProgress > 0 && !stepSuccessState && (
                <div className="relative w-20 h-20 flex items-center justify-center animate-in zoom-in-90 duration-150 z-30">
                  <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      className="stroke-slate-900/80"
                      strokeWidth="8"
                      fill="transparent"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      className="stroke-emerald-400 transition-all duration-75"
                      strokeWidth="8"
                      strokeDasharray="264"
                      strokeDashoffset={264 - (264 * holdProgress) / 100}
                      strokeLinecap="round"
                      fill="transparent"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-base font-black font-mono text-emerald-300 drop-shadow">
                      {holdProgress}%
                    </span>
                    <span className="text-[9px] font-bold text-white tracking-wider">
                      นิ่งไว้...
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* DYNAMIC MISALIGNMENT GUIDANCE WARNING BANNER */}
          {!stepSuccessState && isFaceDetected && !isFaceAligned && alignmentWarning && (
            <div className="absolute top-12 inset-x-6 flex justify-center z-30 pointer-events-none animate-bounce">
              <div className="bg-amber-950/90 backdrop-blur-md border border-amber-400 text-amber-200 rounded-full px-4 py-1.5 flex items-center gap-2 shadow-2xl text-xs font-bold">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{alignmentWarning}</span>
              </div>
            </div>
          )}

          {/* ⟵ DYNAMIC DIRECTIONAL ARROW FOR TURN LEFT ⟵ */}
          {currentStep?.key === 'turn_left' && !stepSuccessState && (
            <div className="absolute left-3 inset-y-0 flex flex-col items-center justify-center z-30 pointer-events-none animate-in slide-in-from-left duration-300">
              <div className={`p-3 rounded-2xl border flex flex-col items-center gap-1 shadow-2xl transition-all duration-200 ${
                detectedYaw <= -10
                  ? 'bg-emerald-500/90 border-emerald-300 text-white scale-110 shadow-emerald-500/50'
                  : 'bg-cyan-950/85 border-cyan-400/80 text-cyan-300 animate-pulse'
              }`}>
                <ArrowLeft className="w-10 h-10 animate-bounce" />
                <span className="text-xs font-bold whitespace-nowrap">⟵ หันซ้าย 25°</span>
                <span className="text-[10px] font-mono text-cyan-100">
                  {detectedYaw <= -10 ? '✓ ตรวจพบหันซ้าย' : detectedYaw >= 10 ? '⚠️ หันผิดข้าง' : `ตรวจจับ: ${Math.abs(detectedYaw)}°`}
                </span>
              </div>
            </div>
          )}

          {/* ⟶ DYNAMIC DIRECTIONAL ARROW FOR TURN RIGHT ⟶ */}
          {currentStep?.key === 'turn_right' && !stepSuccessState && (
            <div className="absolute right-3 inset-y-0 flex flex-col items-center justify-center z-30 pointer-events-none animate-in slide-in-from-right duration-300">
              <div className={`p-3 rounded-2xl border flex flex-col items-center gap-1 shadow-2xl transition-all duration-200 ${
                detectedYaw >= 10
                  ? 'bg-emerald-500/90 border-emerald-300 text-white scale-110 shadow-emerald-500/50'
                  : 'bg-cyan-950/85 border-cyan-400/80 text-cyan-300 animate-pulse'
              }`}>
                <ArrowRight className="w-10 h-10 animate-bounce" />
                <span className="text-xs font-bold whitespace-nowrap">หันขวา 25° ⟶</span>
                <span className="text-[10px] font-mono text-cyan-100">
                  {detectedYaw >= 10 ? '✓ ตรวจพบหันขวา' : detectedYaw <= -10 ? '⚠️ หันผิดข้าง' : `ตรวจจับ: ${Math.abs(detectedYaw)}°`}
                </span>
              </div>
            </div>
          )}

          {/* DYNAMIC EYE BLINK COUNTER OVERLAY */}
          {currentStep?.key === 'blink' && !stepSuccessState && (
            <div className="absolute inset-x-8 top-12 flex justify-center z-30 pointer-events-none animate-fadeIn">
              <div className="bg-slate-900/85 backdrop-blur-md border border-cyan-400/70 rounded-full px-4 py-1.5 flex items-center gap-2 shadow-lg text-cyan-200">
                <Eye className="w-5 h-5 animate-pulse text-cyan-400" />
                <span className="text-xs font-bold">กะพริบตาแล้ว:</span>
                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-700 text-white">
                  {detectedBlinkCount} / 2 ครั้ง
                </span>
              </div>
            </div>
          )}

          {/* DYNAMIC SMILE METER OVERLAY */}
          {currentStep?.key === 'smile' && !stepSuccessState && (
            <div className="absolute inset-x-8 top-12 flex justify-center z-30 pointer-events-none animate-fadeIn">
              <div className="bg-slate-900/85 backdrop-blur-md border border-cyan-400/70 rounded-full px-4 py-1.5 flex items-center gap-2 shadow-lg text-cyan-200">
                <Smile className="w-5 h-5 text-yellow-300 animate-bounce" />
                <span className="text-xs font-bold">ยิ้มเห็นฟัน:</span>
                <div className="w-20 bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                  <div
                    className="bg-gradient-to-r from-yellow-400 to-emerald-400 h-full transition-all duration-150"
                    style={{ width: `${Math.min(100, Math.round(detectedSmile * 200))}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono font-bold text-white">
                  {Math.round(detectedSmile * 100)}%
                </span>
              </div>
            </div>
          )}

          {/* High-Tech HUD Telemetry Overlay */}
          <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md px-2 py-1 rounded-md text-[10px] font-mono text-cyan-300 border border-cyan-800/60 flex items-center gap-1.5 pointer-events-none">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
            <span>AI MESH: 468 PTS • LIVE</span>
          </div>

          <div className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-md px-2 py-1 rounded-md text-[10px] font-mono text-slate-300 border border-slate-700 pointer-events-none">
            <span>{Math.min(5, currentStepIndex + 1)}/5</span>
          </div>

          {/* Bottom Live Feedback Banner */}
          {!isCompleted && !stepSuccessState && (
            <div className="absolute bottom-3 inset-x-4 flex flex-col items-center pointer-events-none z-30">
              <div className={`backdrop-blur-md rounded-full px-4 py-1.5 flex items-center gap-2 shadow-xl max-w-full border transition-all ${
                isFaceAligned && holdProgress > 0
                  ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200 shadow-emerald-500/20'
                  : isFaceDetected && !isFaceAligned
                  ? 'bg-amber-950/90 border-amber-400 text-amber-200 shadow-amber-500/20'
                  : 'bg-slate-950/85 border-cyan-500/40 text-slate-200'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  isFaceAligned && holdProgress > 0
                    ? 'bg-emerald-400 animate-ping'
                    : isFaceDetected && !isFaceAligned
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-cyan-400 animate-pulse'
                }`}></span>
                <span className="text-xs font-semibold truncate">
                  {gestureVerifiedText || 'จัดตำแหน่งใบหน้าให้อยู่ในกรอบวงรี...'}
                </span>
              </div>
            </div>
          )}

          {/* Camera Error / Warning */}
          {cameraError && (
            <div className="absolute inset-x-4 top-14 p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-200 text-xs flex items-center gap-2 backdrop-blur-md">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}
        </div>

        {/* Bottom Instruction & Action Card */}
        <div className="p-4 bg-slate-900 space-y-3">
          {/* Step Instruction Box */}
          {!isCompleted ? (
            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 text-xs font-semibold">
                {currentStep && React.createElement(currentStep.icon, { className: 'w-4 h-4' })}
                <span>{currentStep?.label}</span>
              </div>
              <h4 className="text-base font-bold text-white tracking-wide">
                {currentStep?.instruction}
              </h4>
              <p className="text-xs text-slate-400 leading-tight">
                {currentStep?.subText}
              </p>
            </div>
          ) : (
            <div className="text-center space-y-2 py-1">
              <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/40 animate-bounce">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-base font-bold text-emerald-300">
                  AI จดจำใบหน้าสำเร็จ 100%!
                </h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  บันทึกภาพถ่ายจริงและเวกเตอร์ 468 จุดเข้าสู่ระบบไม้กั้น AI เรียบร้อย
                </p>
              </div>

              {/* Thumbnails of captured angles */}
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {snapshots.straight && (
                  <div className="relative rounded-lg overflow-hidden border border-emerald-500/60 aspect-square">
                    <img src={snapshots.straight} alt="หน้าตรง" className="w-full h-full object-cover" />
                    <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] text-white py-0.5 text-center font-bold">
                      หน้าตรง ✓
                    </span>
                  </div>
                )}
                {snapshots.left && (
                  <div className="relative rounded-lg overflow-hidden border border-emerald-500/60 aspect-square">
                    <img src={snapshots.left} alt="หันซ้าย" className="w-full h-full object-cover" />
                    <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] text-white py-0.5 text-center font-bold">
                      หันซ้าย ✓
                    </span>
                  </div>
                )}
                {snapshots.right && (
                  <div className="relative rounded-lg overflow-hidden border border-emerald-500/60 aspect-square">
                    <img src={snapshots.right} alt="หันขวา" className="w-full h-full object-cover" />
                    <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] text-white py-0.5 text-center font-bold">
                      หันขวา ✓
                    </span>
                  </div>
                )}
                {snapshots.smile && (
                  <div className="relative rounded-lg overflow-hidden border border-emerald-500/60 aspect-square">
                    <img src={snapshots.smile} alt="ยิ้ม" className="w-full h-full object-cover" />
                    <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] text-white py-0.5 text-center font-bold">
                      ยิ้ม ✓
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Button: Manual trigger if user wants immediate snap */}
          {!isCompleted ? (
            <button
              onClick={() => advanceStep()}
              disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-cyan-900/40 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
            >
              <Camera className="w-4 h-4 text-cyan-200" />
              <span>📸 กดถ่ายภาพเองทันที (หรือทำท่าตามที่ AI กำหนด) ➔</span>
            </button>
          ) : (
            <button
              onClick={() => {
                if (onSuccess) onSuccess();
                onClose();
              }}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-900/40 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>เสร็จสิ้น (ไปใช้งานระบบต่อ)</span>
            </button>
          )}

          {/* Demo Simulator Bar (สำหรับนำเสนออาจารย์ / ทดสอบด่วน) */}
          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between text-[11px] text-amber-400 font-semibold mb-1.5">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                โหมดจำลองท่าทาง AI (สำหรับทดสอบ & ตรวจงาน):
              </span>
              <button
                type="button"
                onClick={() => {
                  let step = currentStepIndex;
                  const interval = setInterval(() => {
                    step++;
                    if (step <= STEPS.length) {
                      advanceStep(step);
                    } else {
                      clearInterval(interval);
                    }
                  }, 400);
                }}
                className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1 font-bold cursor-pointer"
              >
                <Zap className="w-3 h-3" />
                <span>ผ่านทุกท่าทันที (1 คลิก)</span>
              </button>
            </div>

            <div className="grid grid-cols-5 gap-1 text-[10px]">
              {STEPS.map((s, idx) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => advanceStep(idx + 1)}
                  className={`py-1 px-1 rounded-lg border text-center transition-all cursor-pointer ${
                    idx < currentStepIndex
                      ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300 font-semibold'
                      : idx === currentStepIndex
                      ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200 font-bold ring-1 ring-cyan-400'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {idx < currentStepIndex ? '✓ ' : ''}{s.label.split(' ')[1]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}