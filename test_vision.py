import cv2
import sys
import os

# Ensure the backend folder is in the system path so we can import from it easily
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))

from services.vision_detector import EmergencyDetector

def main():
    print("Initializing EmergencyDetector...")
    detector = EmergencyDetector()
    
    print("Opening webcam...")
    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    
    if not cap.isOpened():
        print("Error: Could not open webcam.")
        return

    print("Starting LifeLine AI - Vision Test.")
    print("Press 'q' to stop the test and close the window.")

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Failed to grab frame. Exiting...")
            break
            
        # Process the frame using our detector
        emergency_event, annotated_frame = detector.process_frame(frame)
        
        # If the class triggered an event, log it to terminal
        if emergency_event:
            print(f"ALERT! EVENT DETECTED:\n{emergency_event}\n")
            
        # Show the live annotated video feed
        cv2.imshow('LifeLine AI - Vision Test', annotated_frame)
        
        # Check if the 'q' key is pressed
        if cv2.waitKey(1) & 0xFF == ord('q'):
            print("Test manually stopped.")
            break

    # Clean up
    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
