import os
os.environ["PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION"] = "python"
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from backend.services.ai_guidance import get_first_aid_guidance
from backend.services.vision_detector import EmergencyDetector
from datetime import datetime
import json
import base64
import random
import cv2
import numpy as np

import concurrent.futures

# Create a dedicated single-thread executor for MediaPipe to prevent thread context crashes
video_processor_executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)

app = FastAPI(title="LifeLine AI", description="Emergency response system backend")

# Make sure CORS is fully enabled for all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        # Convert dict to JSON string before broadcasting
        text_data = json.dumps(message)
        for connection in self.active_connections:
            try:
                await connection.send_text(text_data)
            except Exception:
                pass

manager = ConnectionManager()
detector = EmergencyDetector()

@app.get("/")
async def root():
    return {"message": "Welcome to the LifeLine AI API"}

class EmergencyRequest(BaseModel):
    emergency_type: str
    lat: Optional[float] = None
    lng: Optional[float] = None

@app.post("/api/get-guidance")
async def get_guidance(request: EmergencyRequest):
    """
    Takes an emergency type as input and returns critical first aid guidance via Groq.
    """
    try:
        guidance_data = await asyncio.to_thread(get_first_aid_guidance, request.emergency_type, request.lat, request.lng)
        return guidance_data
    except ValueError as e:
        # e.g., Missing API key
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        # Fallback for API failure or rate limit errors
        import traceback
        error_msg = traceback.format_exc()
        print(f"Failed to fetch guidance: {error_msg}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch guidance: {str(e)}\n\n{error_msg}")

@app.websocket("/ws/video-stream")
async def video_stream_ws(websocket: WebSocket):
    await websocket.accept()
    print("Frontend dashboard connected to video stream for AI vision processing.")
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            
            if payload.get("type") == "frame":
                try:
                    # Decode base64 image
                    image_data = payload.get("image", "").split(",")[1]
                    nparr = np.frombuffer(base64.b64decode(image_data), np.uint8)
                    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                    
                    # Extract lat/lng coordinates if sent from the frontend
                    lat = payload.get("lat")
                    lng = payload.get("lng")
                    
                    # Run YOLO & MediaPipe through our vision detector
                    # DO NOT use asyncio.to_thread default pool as MediaPipe Pose crashes when called from different threads
                    loop = asyncio.get_running_loop()
                    emergency_event_json, annotated_frame_bgr = await loop.run_in_executor(
                        video_processor_executor, detector.process_frame, frame
                    )
                    
                    # Convert BGR back to base64 JPEG to send to frontend
                    _, buffer = cv2.imencode('.jpg', annotated_frame_bgr)
                    base64_img = base64.b64encode(buffer).decode('utf-8')
                    
                    # Send annotated frame back
                    await websocket.send_json({
                        "type": "annotated_frame",
                        "image": f"data:image/jpeg;base64,{base64_img}"
                    })
                    
                    # If vision detector returned an emergency event string, broadcast it
                    if emergency_event_json:
                        event_dict = json.loads(emergency_event_json)
                        event_dict["location"] = "CAM_01 - LOBBY" # Mock location
                        event_dict["lat"] = lat
                        event_dict["lng"] = lng
                        
                        # Fetch guidance from Groq in background thread
                        try:
                            guidance_data = await asyncio.to_thread(get_first_aid_guidance, event_dict["type"], lat, lng)
                            event_dict["guidance"] = guidance_data.get("guidance", "")
                            if "hospital" in guidance_data:
                                event_dict["hospital"] = guidance_data["hospital"]
                            if "pharmacies" in guidance_data:
                                event_dict["pharmacies"] = guidance_data["pharmacies"]
                            if "route" in guidance_data:
                                event_dict["route"] = guidance_data["route"]
                        except Exception as e:
                            print("Failed to get guidance from Groq:", e)
                            
                        # Broadcast to all connected clients on the alerts stream
                        await manager.broadcast(event_dict)
                except Exception as inner_e:
                    import traceback
                    print(f"Error processing frame: {inner_e}")
                    traceback.print_exc()

    except WebSocketDisconnect:
        print("Frontend disconnected from video stream.")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Video stream error: {e}")

@app.websocket("/ws/emergency-alerts")
async def emergency_alerts_ws(websocket: WebSocket):
    """
    WebSocket endpoint to stream real-time JSON alerts to a frontend dashboard.
    """
    await manager.connect(websocket)
    print("Frontend dashboard connected to emergency alerts stream.")
    try:
        # Acknowledge or process any incoming messages
        await websocket.send_json({
            "status": "connected",
            "message": "Alert system standing by."
        })
        while True:
            data = await websocket.receive_text()
            # If front-end pings us, just respond
            await websocket.send_json({"status": "ping_received"})
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print("Frontend dashboard disconnected from emergency alerts stream.")

@app.post("/api/simulate-emergency")
async def simulate_emergency(request: EmergencyRequest):
    """
    Simulates a sudden collapse that triggers an emergency system broadcast.
    Used for pitch demos without relying on the physical webcam.
    """
    try:
        # 1. Generate the emergency event payload
        alert_event = {
            "status": "emergency",
            "type": request.emergency_type,
            "confidence": 0.99,
            "severity": "HIGH",
            "timestamp": datetime.now().isoformat()
        }
        
        # 2. Get the AI guidance in background thread
        guidance_data = await asyncio.to_thread(get_first_aid_guidance, request.emergency_type, request.lat, request.lng)
        alert_event["guidance"] = guidance_data.get("guidance", "")
        if "hospital" in guidance_data:
            alert_event["hospital"] = guidance_data["hospital"]
        if "pharmacies" in guidance_data:
            alert_event["pharmacies"] = guidance_data["pharmacies"]
        if "route" in guidance_data:
            alert_event["route"] = guidance_data["route"]

        # 3. Broadcast to all connected frontends
        await manager.broadcast(alert_event)

        return {"message": "Emergency broadcast successfully pushed."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from typing import Optional

class TriggerAlertPayload(BaseModel):
    status: str
    type: str
    confidence: float
    location: str
    incident_id: Optional[str] = None
    risk_score: Optional[int] = None
    severity: Optional[str] = "HIGH"
    victims_detected: Optional[int] = 1
    vehicles_involved: Optional[int] = 0
    lat: Optional[float] = None
    lng: Optional[float] = None

class IPCameraRequest(BaseModel):
    url: str
    lat: Optional[float] = None
    lng: Optional[float] = None

active_ip_camera_url = None
active_ip_camera_task = None

async def ip_camera_worker(url: str, lat: Optional[float] = None, lng: Optional[float] = None):
    global active_ip_camera_url
    print(f"Starting IP Camera AI vision worker for: {url}")
    cap = cv2.VideoCapture(url)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1) # Force buffer size to 1 to avoid frame accumulation lag
    loop = asyncio.get_running_loop()
    
    while active_ip_camera_url == url and cap.isOpened():
        # Retrieve the latest frame by clearing the buffer queue
        for _ in range(5):
            cap.grab()
        ret, frame = cap.retrieve()
        
        if not ret or frame is None:
            await asyncio.sleep(0.1)
            continue
            
        try:
            emergency_event_json, annotated_frame_bgr = await loop.run_in_executor(
                video_processor_executor, detector.process_frame, frame
            )
            
            _, buffer = cv2.imencode('.jpg', annotated_frame_bgr)
            base64_img = base64.b64encode(buffer).decode('utf-8')
            
            # Send annotated frame to frontend
            await manager.broadcast({
                "type": "annotated_frame",
                "image": f"data:image/jpeg;base64,{base64_img}"
            })
            
            if emergency_event_json:
                event_dict = json.loads(emergency_event_json)
                event_dict["location"] = "MOBILE IP CAMERA"
                event_dict["lat"] = lat
                event_dict["lng"] = lng
                
                try:
                    guidance_data = await asyncio.to_thread(get_first_aid_guidance, event_dict["type"], lat, lng)
                    event_dict["guidance"] = guidance_data.get("guidance", "")
                    if "hospital" in guidance_data:
                        event_dict["hospital"] = guidance_data["hospital"]
                    if "pharmacies" in guidance_data:
                        event_dict["pharmacies"] = guidance_data["pharmacies"]
                    if "route" in guidance_data:
                        event_dict["route"] = guidance_data["route"]
                except Exception as e:
                    print("Failed to get guidance:", e)
                await manager.broadcast(event_dict)
                
            await asyncio.sleep(0.04) # ~25 FPS
        except Exception as e:
            print("IP Camera worker error:", e)
            await asyncio.sleep(0.5)
            
    cap.release()
    print("IP Camera AI vision worker stopped.")

@app.post("/api/connect-ip-camera")
async def connect_ip_camera(payload: IPCameraRequest):
    """
    Validates connection to a mobile IP camera stream and launches backend AI vision processing.
    """
    global active_ip_camera_url, active_ip_camera_task
    stream_url = payload.url.strip()
    if not stream_url:
        raise HTTPException(status_code=400, detail="Stream URL cannot be empty")
        
    def test_stream(url: str):
        cap = cv2.VideoCapture(url)
        if not cap.isOpened():
            cap.release()
            return False, "Could not open IP camera stream. Ensure phone & PC are on the same Wi-Fi."
        ret, frame = cap.read()
        cap.release()
        if not ret or frame is None:
            return False, "Connected to IP camera but failed to grab video frame."
        return True, "IP Camera connection verified successfully!"

    try:
        success, msg = await asyncio.to_thread(test_stream, stream_url)
        if not success:
            raise HTTPException(status_code=400, detail=msg)
            
        active_ip_camera_url = stream_url
        if active_ip_camera_task and not active_ip_camera_task.done():
            active_ip_camera_task.cancel()
        active_ip_camera_task = asyncio.create_task(ip_camera_worker(stream_url, payload.lat, payload.lng))
        
        return {"success": True, "message": msg, "stream_url": stream_url}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"IP Camera Connection Error: {str(e)}")

@app.post("/api/trigger-alert")
async def trigger_alert(payload: TriggerAlertPayload):
    """
    Externally triggerable endpoint to broadcast an incident to the Next.js UI over WebSocket.
    Includes full incident output details matching PDF hackathon spec.
    """
    try:
        inc_id = payload.incident_id or f"INC-2026-{random.randint(1000, 9999)}"
        alert_event = {
            "status": payload.status,
            "incident_id": inc_id,
            "type": payload.type,
            "location": payload.location,
            "confidence": payload.confidence,
            "risk_score": payload.risk_score if payload.risk_score is not None else 92,
            "severity": payload.severity or "HIGH",
            "victims_detected": payload.victims_detected or 1,
            "vehicles_involved": payload.vehicles_involved or 0,
            "timestamp": datetime.now().isoformat(),
            "lat": payload.lat,
            "lng": payload.lng
        }
        
        # Get AI guidance asynchronously
        guidance_data = await asyncio.to_thread(get_first_aid_guidance, payload.type, payload.lat, payload.lng)
        alert_event["guidance"] = guidance_data.get("guidance", "")
        if "hospital" in guidance_data:
            alert_event["hospital"] = guidance_data["hospital"]
        if "pharmacies" in guidance_data:
            alert_event["pharmacies"] = guidance_data["pharmacies"]
        if "route" in guidance_data:
            alert_event["route"] = guidance_data["route"]

        # Send it to all connected frontend clients
        await manager.broadcast(alert_event)

        return {"success": True, "message": "Alert triggered and broadcast.", "incident_id": inc_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

