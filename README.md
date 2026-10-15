# LifeLine AI

LifeLine AI is an AI-powered emergency response system designed to detect incidents in real time, notify responders, and provide immediate first-aid and routing guidance. The project combines live camera analysis, computer vision, geospatial medical lookup, and a responsive dashboard to assist in urgent situations.

## What this project does

The system watches a live camera feed or IP camera stream and uses a combination of:

- YOLOv8 for object detection
- MediaPipe Pose for posture and fall detection
- FastAPI WebSockets for live alert streaming
- Groq AI for emergency guidance generation
- OpenStreetMap/Overpass-based hospital and pharmacy lookup
- A* pathfinding for route suggestions to the nearest medical facility

This makes it useful for emergency monitoring in public spaces, campuses, hospitals, and smart-city or safety infrastructure setups.

## Core idea

When a person appears to collapse or be in a dangerous posture, the system:

1. Detects the person and surrounding environment from the camera stream.
2. Analyzes posture and motion to assess fall risk or emergency conditions.
3. Confirms an emergency event if detection thresholds are met.
4. Broadcasts an alert in real time to the dashboard.
5. Finds nearby hospitals and pharmacies using geospatial data.
6. Generates immediate first-aid steps and route guidance.
7. Displays the incident on a live map and dashboard for dispatch or monitoring teams.

## Project architecture

### Frontend

The frontend is built with Next.js and provides:

- landing page for the product overview
- login screen for dashboard access
- live dispatch dashboard with alert events, map, and response workflow
- WebSocket-driven updates for emergency notifications
- option to use webcam, IP camera, or uploaded video as the input source

### Backend

The backend is built with FastAPI and exposes:

- `/` health root endpoint
- `/api/get-guidance` for emergency first-aid guidance
- `/api/simulate-emergency` for demo event generation
- `/ws/video-stream` for receiving and processing webcam/IP camera frames
- `/ws/emergency-alerts` for broadcasting alert messages to the dashboard

### Vision and detection layer

The detection layer runs inside `backend/services/vision_detector.py` and uses:

- YOLOv8 for person, vehicle, and obstacle detection
- MediaPipe Pose for body posture estimation
- risk scoring and severity logic for incident classification

### AI guidance layer

The `backend/services/ai_guidance.py` module generates emergency response instructions. It uses:

- Groq LLM APIs when an API key is configured
- offline fallback medical guidance when the API is not available
- nearby hospital data and route context to tailor instructions

### Location and routing layer

The `backend/services/location_services.py` module uses Overpass API to:

- find nearby hospitals and pharmacies
- identify the nearest medical facility
- compute a route using A* pathfinding over road geometry

## Tech stack

- Python
- FastAPI
- Next.js
- React
- Tailwind CSS
- OpenCV
- YOLOv8
- MediaPipe
- Groq
- Overpass API
- WebSockets

## Repository structure

```text
Lifeline_AI/
├── backend/
│   ├── app.py
│   ├── services/
│   │   ├── ai_guidance.py
│   │   ├── ambulance_service.py
│   │   ├── location_services.py
│   │   └── vision_detector.py
├── frontend/
│   ├── src/
│   ├── package.json
│   └── README.md
├── requirements.txt
├── yolov8n.pt
├── .gitignore
├── README.md
└── project test scripts
```

## How the project works in practice

A typical flow is:

1. The frontend connects to the backend WebSocket.
2. A webcam or IP camera sends frames.
3. The backend decodes the image and passes it to the detector.
4. YOLO and MediaPipe assess whether a person is lying down, collapsed, or in distress.
5. If risk crosses a threshold, the backend creates an emergency event.
6. The emergency alert is broadcast to all clients.
7. Nearby hospitals and pharmacies are fetched from map data.
8. The AI system produces tailored emergency guidance.
9. The dashboard displays the event with guidance, location, and response timeline.

## Setup instructions

### 1. Python environment

Install the backend dependencies:

```bash
pip install -r requirements.txt
```

### 2. Frontend dependencies

```bash
cd frontend
npm install
```

### 3. Environment variables

Create a `.env.local` file in the project root with your Groq key if you want AI-guided medical responses:

```env
GROQ_API_KEY=your_groq_api_key_here
```

### 4. Run the backend

```bash
uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
```

### 5. Run the frontend

```bash
cd frontend
npm run dev
```

Then open the app in the browser using the local frontend URL (typically `http://localhost:3000`).

## Notes

- `yolov8n.pt` is used by the vision pipeline and should be available in the project root.
- The app can operate in demo mode even without a live camera by simulating emergency events.
- The project is designed as a practical prototype / hackathon-style emergency response system rather than a production-grade clinical system.

## Summary

LifeLine AI is a real-time emergency intelligence and dispatch assistant that merges live video analysis, AI-generated first aid guidance, and geospatial medical assistance into one streamlined response workflow. It is intended to accelerate detection, improve human response speed, and support emergency decision-making in high-risk situations.
