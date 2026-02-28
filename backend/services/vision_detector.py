import cv2
import time
import json
import numpy as np
import mediapipe as mp
from ultralytics import YOLO
from datetime import datetime

# Toggle for standalone testing:
# Set to 0 for webcam, or a file path like 'assets/collapse_demo.mp4' for a video file
VIDEO_SOURCE = 0

class EmergencyDetector:
    def __init__(self):
        """
        Initializes the EmergencyDetector with YOLOv8 for person detection
        and MediaPipe for pose estimation.
        """
        # Load the YOLOv8 model for basic person detection
        # Using the nano model (yolov8n.pt) for better real-time performance
        self.yolo_model = YOLO("yolov8n.pt")
        
        # Initialize MediaPipe Pose and Drawing Utils
        self.mp_pose = mp.solutions.pose
        self.mp_drawing = mp.solutions.drawing_utils
        self.pose = None
        
        # State tracking for collapse detection
        self.collapse_start_time = None
        self.is_collapsed = False
        
        # Performance optimization: frame skipping and caching
        self.frame_count = 0
        self.skip_frames = 4 # Run inference every 4th frame
        self.last_boxes = [] # Cache YOLO bounding boxes
        self.last_pose_landmarks = None # Cache MediaPipe landmarks
        self.is_horizontal = False # Cache horizontal state
        
    def process_frame(self, frame):
        """
        Processes a single video frame to detect if a person has experienced a sudden collapse.
        Returns a JSON string if an emergency is detected (otherwise None) and the annotated frame.
        """
        self.frame_count += 1
        emergency_event = None
        annotated_frame = frame.copy()
        
        if self.frame_count % self.skip_frames == 0:
            if self.pose is None:
                self.pose = self.mp_pose.Pose(
                    min_detection_confidence=0.5,
                    min_tracking_confidence=0.5
                )
            # 1. Run YOLOv8 to detect persons in the frame (class 0 is person)
            results = self.yolo_model(frame, classes=[0], verbose=False)
            
            # Convert the frame to RGB for MediaPipe processing
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pose_results = self.pose.process(rgb_frame)
            self.last_pose_landmarks = pose_results.pose_landmarks
            
            is_horizontal_yolo = False
            self.last_boxes = []
            
            # 2. Check bounding box ratio using YOLO results
            for r in results:
                for box in r.boxes:
                    x1, y1, x2, y2 = box.xyxy[0].tolist()
                    self.last_boxes.append((int(x1), int(y1), int(x2), int(y2)))
                    width = x2 - x1
                    height = y2 - y1
                    
                    # If width is extremely greater than height (h/w ratio < 0.5), person is likely horizontal
                    if width > 0:
                        hw_ratio = height / width
                        if hw_ratio < 0.5:
                            is_horizontal_yolo = True

            # 3. Check Pose Landmarks with MediaPipe
            is_horizontal_mp = False
            if self.last_pose_landmarks:
                landmarks = self.last_pose_landmarks.landmark
                
                # Extract Y coordinates of shoulders and hips
                left_shoulder_y = landmarks[self.mp_pose.PoseLandmark.LEFT_SHOULDER].y
                right_shoulder_y = landmarks[self.mp_pose.PoseLandmark.RIGHT_SHOULDER].y
                left_hip_y = landmarks[self.mp_pose.PoseLandmark.LEFT_HIP].y
                right_hip_y = landmarks[self.mp_pose.PoseLandmark.RIGHT_HIP].y
                
                # Also extract visibility to ensure we don't guess based on off-screen hips
                left_hip_vis = landmarks[self.mp_pose.PoseLandmark.LEFT_HIP].visibility
                right_hip_vis = landmarks[self.mp_pose.PoseLandmark.RIGHT_HIP].visibility
                
                # Calculate midpoints
                shoulder_mid_y = (left_shoulder_y + right_shoulder_y) / 2
                hip_mid_y = (left_hip_y + right_hip_y) / 2
                
                # Only trigger horizontal if hips are actually visible in the camera frame
                if left_hip_vis > 0.5 or right_hip_vis > 0.5:
                    # In image coordinates, y increases downwards. 
                    # If shoulders and hips have a very small difference in Y, person is horizontal.
                    y_diff = abs(shoulder_mid_y - hip_mid_y)
                    if y_diff < 0.15:
                        is_horizontal_mp = True

            self.is_horizontal = is_horizontal_yolo or is_horizontal_mp

        # Always draw the cached data for smooth visualization
        for (x1, y1, x2, y2) in self.last_boxes:
            cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            
        if self.last_pose_landmarks:
            # Draw skeleton landmarks on the annotated frame
            self.mp_drawing.draw_landmarks(
                annotated_frame, 
                self.last_pose_landmarks, 
                self.mp_pose.POSE_CONNECTIONS,
                self.mp_drawing.DrawingSpec(color=(245,117,66), thickness=2, circle_radius=2), 
                self.mp_drawing.DrawingSpec(color=(245,66,230), thickness=2, circle_radius=2)
            )

        # 4. Collapse Logic Evaluation
        if self.is_horizontal:
            if self.collapse_start_time is None:
                # Potential start of a collapse, record the time
                self.collapse_start_time = time.time()
            else:
                elapsed_time = time.time() - self.collapse_start_time
                # Draw a warning showing horizontal posture is active
                cv2.putText(annotated_frame, f"Horizontal Posture ({elapsed_time:.1f}s)", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 165, 255), 2)
                
                # Check if the person has remained horizontal for 3 seconds
                if elapsed_time >= 3.0 and not self.is_collapsed:
                    self.is_collapsed = True
                    
                    # Trigger emergency JSON event
                    emergency_event = json.dumps({
                        "status": "emergency",
                        "type": "cardiac_arrest_suspected",
                        "confidence": 0.92,
                        "timestamp": datetime.now().isoformat()
                    })
        else:
            # Person is standing/sitting upright; reset collapse tracking
            self.collapse_start_time = None
            self.is_collapsed = False
            cv2.putText(annotated_frame, "Status: Upright/Normal", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            
        if self.is_collapsed:
            cv2.putText(annotated_frame, "EMERGENCY: COLLAPSE DETECTED!", (10, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
            
        return emergency_event, annotated_frame

if __name__ == "__main__":
    detector = EmergencyDetector()
    cap = cv2.VideoCapture(VIDEO_SOURCE)
    
    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            if isinstance(VIDEO_SOURCE, str):
                # Loop video file
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
