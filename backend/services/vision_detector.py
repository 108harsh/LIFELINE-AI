import cv2
import time
import json
import random
import numpy as np
import mediapipe as mp
from ultralytics import YOLO
from datetime import datetime

# Toggle for standalone testing:
VIDEO_SOURCE = 0

class EmergencyDetector:
    def __init__(self):
        """
        Initializes the EmergencyDetector with YOLOv8 for multi-class detection
        (person, car, motorcycle, bus, truck) and MediaPipe for pose estimation.
        """
        # Load the YOLOv8 model for object detection
        self.yolo_model = YOLO("yolov8n.pt")
        
        # Target COCO classes: 0: person, 2: car, 3: motorcycle, 5: bus, 7: truck
        self.target_classes = [0, 2, 3, 5, 7]
        
        # Initialize MediaPipe Pose and Drawing Utils
        self.mp_pose = mp.solutions.pose
        self.mp_drawing = mp.solutions.drawing_utils
        self.pose = None
        
        # State tracking for collapse / incident detection
        self.collapse_start_time = None
        self.is_collapsed = False
        self.state = "NORMAL" # NORMAL | VERIFYING | EMERGENCY_CONFIRMED
        
        # Performance optimization: frame skipping and caching
        self.frame_count = 0
        self.skip_frames = 1 # Run inference on EVERY frame for max responsiveness
        self.last_boxes = [] # Cache YOLO bounding boxes with class info
        self.last_pose_landmarks = None # Cache MediaPipe landmarks
        self.is_horizontal = False # Cache horizontal state
        self.last_person_count = 0
        self.last_vehicle_count = 0
        self.last_risk_score = 0
        self.last_severity = "NORMAL"
        
    def calculate_risk_score(self, is_fallen: bool, immobility_seconds: float, person_count: int, vehicle_count: int) -> tuple[int, str]:
        """
        Calculates Risk Score (0-100) and Severity:
        - Fallen person: +40 (High risk base)
        - Immobility >= 3s: +25
        - Vehicle present & Fallen person: +50 (Accident scenario)
        - Multiple vehicles (>= 2): +10
        Severity thresholds: 0-30 Normal, 30-60 Suspicious, 60-80 High, 80-100 Critical
        """
        score = 0
        if is_fallen:
            score += 40
            if vehicle_count > 0:
                score += 50
        if immobility_seconds >= 3.0:
            score += 25
        if vehicle_count >= 2:
            score += 10
            
        score = min(score, 100)
        
        if score >= 80:
            severity = "CRITICAL"
        elif score >= 60:
            severity = "HIGH"
        elif score >= 30:
            severity = "SUSPICIOUS"
        else:
            severity = "NORMAL"
            
        return score, severity

    def process_frame(self, frame):
        """
        Processes a single video frame to detect persons, vehicles, and sudden collapses.
        Returns a JSON string if an emergency incident occurs and the annotated frame.
        """
        self.frame_count += 1
        emergency_event = None
        annotated_frame = frame.copy()
        
        if self.pose is None:
            self.pose = self.mp_pose.Pose(
                min_detection_confidence=0.4,
                min_tracking_confidence=0.4
            )
        # 1. Run YOLOv8 for multi-class detection (person, car, motorcycle, bus, truck) with conf=0.25
        results = self.yolo_model(frame, classes=self.target_classes, conf=0.25, verbose=False)
        
        # Convert frame to RGB for MediaPipe
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pose_results = self.pose.process(rgb_frame)
        self.last_pose_landmarks = pose_results.pose_landmarks
        
        is_horizontal_yolo = False
        self.last_boxes = []
        person_count = 0
        vehicle_count = 0
        
        # Parse YOLO results
        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls[0].item())
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                conf = float(box.conf[0].item())
                
                if cls_id == 0:
                    person_count += 1
                    width = x2 - x1
                    height = y2 - y1
                    # A ratio < 0.9 means the box is wider than tall or square-ish, typical of a fallen person
                    if width > 0 and (height / width) < 0.9 and conf > 0.4:
                        is_horizontal_yolo = True
                else:
                    vehicle_count += 1
                    
                self.last_boxes.append((int(x1), int(y1), int(x2), int(y2), cls_id, conf))
                
        self.last_person_count = person_count
        self.last_vehicle_count = vehicle_count

        # 2. Check Pose Landmarks with MediaPipe
        is_horizontal_mp = False
        if self.last_pose_landmarks:
            landmarks = self.last_pose_landmarks.landmark
            
            # Check visibility of key landmarks to avoid false positives (e.g. sitting at desk with lower body cut off)
            left_shoulder = landmarks[self.mp_pose.PoseLandmark.LEFT_SHOULDER]
            right_shoulder = landmarks[self.mp_pose.PoseLandmark.RIGHT_SHOULDER]
            left_hip = landmarks[self.mp_pose.PoseLandmark.LEFT_HIP]
            right_hip = landmarks[self.mp_pose.PoseLandmark.RIGHT_HIP]
            
            min_visibility = 0.5
            if (left_shoulder.visibility > min_visibility and 
                right_shoulder.visibility > min_visibility and 
                left_hip.visibility > min_visibility and 
                right_hip.visibility > min_visibility):
                
                left_shoulder_y = left_shoulder.y
                right_shoulder_y = right_shoulder.y
                left_hip_y = left_hip.y
                right_hip_y = right_hip.y
                
                left_shoulder_x = left_shoulder.x
                right_shoulder_x = right_shoulder.x
                left_hip_x = left_hip.x
                right_hip_x = right_hip.x
                
                shoulder_mid_y = (left_shoulder_y + right_shoulder_y) / 2
                hip_mid_y = (left_hip_y + right_hip_y) / 2
                
                shoulder_mid_x = (left_shoulder_x + right_shoulder_x) / 2
                hip_mid_x = (left_hip_x + right_hip_x) / 2
                
                dy = abs(shoulder_mid_y - hip_mid_y)
                dx = abs(shoulder_mid_x - hip_mid_x)
                
                # If dy is small, the shoulders and hips are aligned horizontally in the frame.
                # Threshold: dy < 0.15 and dy < dx * 1.2 (horizontal slope)
                if dy < 0.15 and dy < (dx * 1.2):
                    is_horizontal_mp = True

        self.is_horizontal = is_horizontal_yolo or is_horizontal_mp

        # Draw bounding boxes on annotated frame
        for (x1, y1, x2, y2, cls_id, conf) in self.last_boxes:
            if cls_id == 0:
                if self.is_horizontal:
                    color = (0, 0, 255) # Red for Fallen / Lie Down
                    label = f"Person (LIE DOWN) {int(conf*100)}%"
                else:
                    color = (0, 255, 0) # Green for Standing
                    label = f"Person (STANDING) {int(conf*100)}%"
            else:
                color = (255, 255, 0) # Cyan for Vehicles
                label = f"Vehicle {int(conf*100)}%"
                
            cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 2)
            cv2.putText(annotated_frame, label, (x1, max(y1 - 5, 15)), cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2)
            
        if self.last_pose_landmarks:
            self.mp_drawing.draw_landmarks(
                annotated_frame, 
                self.last_pose_landmarks, 
                self.mp_pose.POSE_CONNECTIONS,
                self.mp_drawing.DrawingSpec(color=(245,117,66), thickness=2, circle_radius=3), 
                self.mp_drawing.DrawingSpec(color=(245,66,230), thickness=2, circle_radius=2)
            )

        # 3. Dynamic Risk Engine & Incident Logic
        immobility_secs = 0.0
        if self.is_horizontal:
            if self.collapse_start_time is None:
                self.collapse_start_time = time.time()
                self.state = "NORMAL"
            else:
                immobility_secs = time.time() - self.collapse_start_time
                cv2.putText(annotated_frame, f"POSTURE: LIE DOWN / FALLEN ({immobility_secs:.1f}s)", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                
                # Check transitions
                # 1. Normal -> Verifying (after 2 seconds of horizontal posture)
                if self.state == "NORMAL" and immobility_secs >= 2.0:
                    self.state = "VERIFYING"
                
                # 2. Verifying -> Confirming (after 8 seconds of verifying, i.e., total 10 seconds)
                if self.state == "VERIFYING":
                    remaining_secs = max(0.0, 8.0 - (immobility_secs - 2.0))
                    
                    if remaining_secs <= 0.0:
                        self.state = "EMERGENCY_CONFIRMED"
                        self.is_collapsed = True
                        
                        risk_score, severity = self.calculate_risk_score(
                            is_fallen=True,
                            immobility_seconds=immobility_secs,
                            person_count=self.last_person_count,
                            vehicle_count=self.last_vehicle_count
                        )
                        inc_id = f"INC-2026-{random.randint(1000, 9999)}"
                        incident_type = "Road Traffic Accident" if self.last_vehicle_count > 0 else "Fallen Person / Collapse Suspected"
                        
                        emergency_event = json.dumps({
                            "status": "emergency",
                            "incident_id": inc_id,
                            "type": incident_type,
                            "risk_score": risk_score,
                            "severity": severity,
                            "confidence": 0.95,
                            "victims_detected": max(self.last_person_count, 1),
                            "vehicles_involved": self.last_vehicle_count,
                            "timestamp": datetime.now().isoformat()
                        })
                    else:
                        # Broadcast verification countdown progress to frontend
                        emergency_event = json.dumps({
                            "status": "verifying",
                            "remaining_seconds": round(remaining_secs, 1),
                            "type": "Possible Fall / Collapse",
                            "confidence": 0.92,
                            "timestamp": datetime.now().isoformat()
                        })
                elif self.state == "EMERGENCY_CONFIRMED":
                    self.is_collapsed = True
        else:
            # If they were verifying or confirmed and stood up -> transition to recovered
            if self.state in ["VERIFYING", "EMERGENCY_CONFIRMED"]:
                self.state = "NORMAL"
                self.is_collapsed = False
                emergency_event = json.dumps({
                    "status": "recovered",
                    "type": "Possible Fall / Collapse",
                    "timestamp": datetime.now().isoformat()
                })
            else:
                self.state = "NORMAL"
                self.is_collapsed = False
                
            self.collapse_start_time = None
            cv2.putText(annotated_frame, "POSTURE: STANDING (NORMAL)", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            
        if self.is_collapsed:
            cv2.putText(annotated_frame, "CRITICAL INCIDENT DETECTED!", (10, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
            
        return emergency_event, annotated_frame

if __name__ == "__main__":
    detector = EmergencyDetector()
    cap = cv2.VideoCapture(VIDEO_SOURCE)
    
    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            if isinstance(VIDEO_SOURCE, str):
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue
            else:
                break
                
        event, annotated = detector.process_frame(frame)
        
        cv2.imshow("Lifeline AI Vision Demo", annotated)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
            
    cap.release()
    cv2.destroyAllWindows()

