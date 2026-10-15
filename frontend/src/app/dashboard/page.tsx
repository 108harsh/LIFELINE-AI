/* eslint-disable */
"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  AlertCircle,
  Activity,
  HeartPulse,
  Video,
  ShieldAlert,
  FileText,
  ChevronRight,
  CameraOff,
  Volume2,
  VolumeX,
  Smartphone,
  Wifi,
  Upload,
  Radio,
  HelpCircle,
  CheckCircle2,
  Clock,
  Truck,
  User,
  Car,
  MapPin,
  Sparkles,
  X,
  RefreshCw,
  Send
} from "lucide-react";

declare global {
  interface Window {
    L: any;
  }
}

interface AlertPayload {
  status: string;
  incident_id?: string;
  type: string;
  confidence: number;
  risk_score?: number;
  severity: string;
  victims_detected?: number;
  vehicles_involved?: number;
  location?: string;
  timestamp: string;
  guidance?: string;
  lat?: number;
  lng?: number;
  hospital?: {
    name: string;
    phone: string;
    lat: number;
    lng: number;
  };
  pharmacies?: Array<{
    name: string;
    phone: string;
    lat: number;
    lng: number;
  }>;
  route?: Array<[number, number]>;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "citizen">("dashboard");
  const [alerts, setAlerts] = useState<AlertPayload[]>([]);
  const [activeGuidance, setActiveGuidance] = useState<string | null>(null);
  const [displayedGuidance, setDisplayedGuidance] = useState<string>("");
  const [activeHospital, setActiveHospital] = useState<{ name: string, phone: string, lat: number, lng: number } | null>(null);
  const [activePharmacies, setActivePharmacies] = useState<Array<{ name: string, phone: string, lat: number, lng: number }>>([]);
  const pharmacyMarkersRef = useRef<any[]>([]);
  const ambulanceMarkerRef = useRef<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraPermissionError, setCameraPermissionError] = useState<string | null>(null);
  const [annotatedFrame, setAnnotatedFrame] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isMuted, setIsMuted] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
  const userLocationRef = useRef<{ lat: number, lng: number } | null>(null);

  // Camera Source & IP Camera State
  const [cameraMode, setCameraMode] = useState<"webcam" | "ip_camera" | "file_upload">("webcam");
  const [ipCameraUrl, setIpCameraUrl] = useState<string>("http://172.31.2.43:8080/video");
  const [ipCamStatus, setIpCamStatus] = useState<"disconnected" | "connecting" | "connected" | "error">("disconnected");
  const [ipCamError, setIpCamError] = useState<string | null>(null);
  const [showIpCamGuide, setShowIpCamGuide] = useState(false);

  // File Upload State
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Citizen Report Mode State
  const [citizenReportText, setCitizenReportText] = useState("");
  const [citizenFile, setCitizenFile] = useState<File | null>(null);
  const [citizenStatus, setCitizenStatus] = useState<string | null>(null);

  // Response Timeline State (1 to 5)
  const [timelineStep, setTimelineStep] = useState<number>(1);
  const [callStatus, setCallStatus] = useState<"idle" | "dialing" | "connected" | "dispatched">("idle");
  const [activeAlertRoute, setActiveAlertRoute] = useState<Array<[number, number]>>([]);

  const ws = useRef<WebSocket | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const incidentMarkerRef = useRef<any>(null);
  const responderMarkerRef = useRef<any>(null);
  const routingLineRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playCountRef = useRef<number>(0);
  const currentUserMarkerRef = useRef<any>(null);

  // Request user location on mount
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(loc);
          userLocationRef.current = loc;
        },
        (error) => {
          console.warn("Geolocation failed or denied, using default fallback.", error);
          const loc = { lat: 40.7128, lng: -74.0060 };
          setUserLocation(loc);
          userLocationRef.current = loc;
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      console.warn("Geolocation API not supported.");
      const loc = { lat: 40.7128, lng: -74.0060 };
      setUserLocation(loc);
      userLocationRef.current = loc;
    }
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!userLocation) return;

    const checkInterval = setInterval(() => {
      if (typeof window !== "undefined" && window.L && mapContainerRef.current && !mapRef.current) {
        clearInterval(checkInterval);
        const L = window.L;
        const defaultCenter = [userLocation.lat, userLocation.lng];

        const map = L.map(mapContainerRef.current, {
          zoomControl: false,
          attributionControl: false
        }).setView(defaultCenter, 13);

        L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
          attribution: '&copy; Google Maps',
          maxZoom: 20
        }).addTo(map);

        currentUserMarkerRef.current = L.marker(defaultCenter, {
          icon: L.divIcon({
            className: 'bg-transparent border-none',
            html: `<div class="relative flex h-5 w-5"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span class="relative inline-flex rounded-full h-5 w-5 bg-blue-500 border-2 border-white shadow-[0_0_15px_rgba(59,130,246,0.8)]"></span></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          })
        }).addTo(map).bindPopup("<b class='text-blue-500'>Current Location</b>").openPopup();

        setTimeout(() => {
          map.invalidateSize();
        }, 500);

        mapRef.current = map;
      }
    }, 500);

    return () => clearInterval(checkInterval);
  }, [userLocation]);

  // Set up Alert WebSocket connection
  useEffect(() => {
    ws.current = new WebSocket("ws://127.0.0.1:8000/ws/emergency-alerts");

    ws.current.onopen = () => {
      setIsConnected(true);
      console.log("WebSocket connected");
    };

    ws.current.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        // Render IP Camera annotated frames
        if (data.type === "annotated_frame") {
          setAnnotatedFrame(data.image);
          return;
        }
        
        if (data.status === "emergency") {
          const newAlert: AlertPayload = {
            incident_id: data.incident_id || `INC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
            risk_score: data.risk_score || 92,
            severity: data.severity || "CRITICAL",
            victims_detected: data.victims_detected || 1,
            vehicles_involved: data.vehicles_involved || 0,
            location: data.location || "LOBBY - CAM 01",
            ...data,
          };

          setAlerts((prev) => [newAlert, ...prev]);
          setDisplayedGuidance("");

          // Progress timeline from Step 1 to 5 sequentially
          setTimelineStep(1);
          setTimeout(() => setTimelineStep(2), 1000);
          setTimeout(() => setTimelineStep(3), 3000);
          setTimeout(() => setTimelineStep(4), 5000);
          setTimeout(() => setTimelineStep(5), 7000);

          // Update Geospatial Map
          const L = window.L;
          if (L && mapRef.current) {
            const baseLat = newAlert.lat || userLocationRef.current?.lat || 40.7128;
            const baseLng = newAlert.lng || userLocationRef.current?.lng || -74.0060;
            const incidentLoc = [baseLat, baseLng];

            if (incidentMarkerRef.current) mapRef.current.removeLayer(incidentMarkerRef.current);

            incidentMarkerRef.current = L.marker(incidentLoc, {
              icon: L.divIcon({
                className: 'bg-transparent border-none',
                html: `<div class="relative flex h-6 w-6"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span><span class="relative inline-flex rounded-full h-6 w-6 bg-red-600 border-2 border-white shadow-[0_0_20px_rgba(220,38,38,0.9)] flex items-center justify-center text-[10px] text-white font-bold">⚠️</span></div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
              })
            }).addTo(mapRef.current).bindPopup(`<b class='text-red-600'>${newAlert.incident_id || 'INCIDENT'}</b><br/>${newAlert.type}`);
          }

          // Trigger Audio Alarm
          if (!isMuted && audioRef.current) {
            try {
              audioRef.current.currentTime = 0;
              playCountRef.current = 1;
              const playPromise = audioRef.current.play();
              if (playPromise !== undefined) {
                playPromise.catch(e => console.warn("Browser blocked auto-play:", e));
              }
            } catch (err) {
              console.warn("Audio playback error", err);
            }
          }

          if (newAlert.guidance) {
            setActiveGuidance(newAlert.guidance);
            if (newAlert.hospital) setActiveHospital(newAlert.hospital);
            if (newAlert.pharmacies) setActivePharmacies(newAlert.pharmacies);
            if (newAlert.route) setActiveAlertRoute(newAlert.route);
          } else {
            try {
              const res = await fetch("http://127.0.0.1:8000/api/get-guidance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  emergency_type: newAlert.type,
                  lat: userLocationRef.current?.lat,
                  lng: userLocationRef.current?.lng
                }),
              });
              const aiData = await res.json();
              if (aiData.guidance) {
                setActiveGuidance(aiData.guidance);
                if (aiData.hospital) setActiveHospital(aiData.hospital);
                if (aiData.pharmacies) setActivePharmacies(aiData.pharmacies);
                if (aiData.route) setActiveAlertRoute(aiData.route);
              }
            } catch (err) {
              console.error("Failed to fetch guidance dynamically", err);
            }
          }

          // Trigger calling ambulance animation if the risk score is high
          const isHighRisk = (newAlert.risk_score && newAlert.risk_score >= 60) || 
                             (newAlert.severity === "HIGH" || newAlert.severity === "CRITICAL");
          if (isHighRisk) {
            setCallStatus("dialing");
            setTimeout(() => setCallStatus("connected"), 3000);
            setTimeout(() => setCallStatus("dispatched"), 6000);
          } else {
            setCallStatus("idle");
          }
        }
      } catch (error) {
        console.error("Failed to parse realtime message", error);
      }
    };

    ws.current.onclose = () => {
      setIsConnected(false);
      console.log("WebSocket disconnected");
    };

    return () => {
      if (ws.current) ws.current.close();
    };
  }, []);

  // Typewriter Effect Logic
  useEffect(() => {
    if (!activeGuidance) return;

    let i = 0;
    setDisplayedGuidance("");

    const typingInterval = setInterval(() => {
      if (i < activeGuidance.length) {
        setDisplayedGuidance((prev) => prev + activeGuidance.charAt(i));
        i++;
      } else {
        clearInterval(typingInterval);
      }
    }, 12);

    return () => clearInterval(typingInterval);
  }, [activeGuidance]);

  // Hospital, Ambulance & Pharmacy Routing Map Effect
  useEffect(() => {
    if (activeHospital && userLocationRef.current && mapRef.current) {
      const L = window.L;
      const hospitalLoc = [activeHospital.lat, activeHospital.lng];
      const userLoc = [userLocationRef.current.lat, userLocationRef.current.lng];

      if (responderMarkerRef.current) mapRef.current.removeLayer(responderMarkerRef.current);
      if (routingLineRef.current) mapRef.current.removeLayer(routingLineRef.current);
      if (ambulanceMarkerRef.current) mapRef.current.removeLayer(ambulanceMarkerRef.current);

      if (pharmacyMarkersRef.current) {
        pharmacyMarkersRef.current.forEach(m => mapRef.current.removeLayer(m));
      }
      pharmacyMarkersRef.current = [];

      // 1. Add Hospital Marker (Red H)
      responderMarkerRef.current = L.marker(hospitalLoc, {
        icon: L.divIcon({
          className: 'bg-transparent border-none',
          html: `<div class="flex items-center justify-center bg-red-600 text-white font-bold rounded-full border-2 border-white shadow-[0_0_15px_rgba(220,38,38,0.8)] text-xs" style="width: 28px; height: 28px;">H</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        })
      }).addTo(mapRef.current).bindPopup(`<b class='text-red-600'>🏥 ${activeHospital.name}</b><br/>📞 ${activeHospital.phone}`).openPopup();

      // 2. Add Dispatched Ambulance Marker (Yellow AMB icon moving)
      const midLat = (userLoc[0] + hospitalLoc[0]) / 2;
      const midLng = (userLoc[1] + hospitalLoc[1]) / 2;
      ambulanceMarkerRef.current = L.marker([midLat, midLng], {
        icon: L.divIcon({
          className: 'bg-transparent border-none',
          html: `<div class="flex items-center justify-center bg-yellow-500 text-black font-bold rounded-full border-2 border-white shadow-[0_0_15px_rgba(234,179,8,0.9)] text-xs" style="width: 28px; height: 28px;">🚑</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        })
      }).addTo(mapRef.current).bindPopup(`<b class='text-yellow-400'>Dispatched Ambulance Unit AMB-01</b>`);

      // 3. Add Nearby Pharmacies Markers (Green Rx)
      activePharmacies.forEach((pharm) => {
        const pMarker = L.marker([pharm.lat, pharm.lng], {
          icon: L.divIcon({
            className: 'bg-transparent border-none',
            html: `<div class="flex items-center justify-center bg-emerald-600 text-white font-bold rounded-full border-2 border-white shadow-[0_0_12px_rgba(16,185,129,0.8)] text-[10px]" style="width: 24px; height: 24px;">Rx</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          })
        }).addTo(mapRef.current).bindPopup(`<b class='text-emerald-500'>💊 ${pharm.name}</b><br/>📞 ${pharm.phone}`);
        pharmacyMarkersRef.current.push(pMarker);
      });

      // 4. Draw Red Dashed Route Line (Calculated using A* if available)
      const routePoints = activeAlertRoute && activeAlertRoute.length > 0
        ? activeAlertRoute 
        : [userLoc, hospitalLoc];

      routingLineRef.current = L.polyline(routePoints, {
        color: '#06b6d4',
        dashArray: '8, 8',
        weight: 4,
        opacity: 0.9
      }).addTo(mapRef.current);

      const allPoints = [
        userLoc,
        hospitalLoc,
        ...activePharmacies.map(p => [p.lat, p.lng]),
        ...routePoints
      ];
      const bounds = L.latLngBounds(allPoints).pad(0.15);
      mapRef.current.fitBounds(bounds);
    }
  }, [activeHospital, activePharmacies, activeAlertRoute]);

  // Setup Local Webcam
  useEffect(() => {
    if (cameraMode !== "webcam") return;

    async function setupCamera() {
      setCameraPermissionError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsCameraActive(true);
        }
      } catch (err: any) {
        console.error("Error accessing webcam:", err);
        setIsCameraActive(false);
        setCameraPermissionError(
          err.name === "NotAllowedError"
            ? "Webcam permission denied by browser. Please allow camera access or use Mobile IP Camera mode."
            : `Camera Access Error: ${err.message || "Failed to initialize camera"}`
        );
      }
    }
    setupCamera();

    const wsVideo = new WebSocket("ws://127.0.0.1:8000/ws/video-stream");
    wsVideo.onopen = () => console.log("Video Stream WS connected");

    wsVideo.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "annotated_frame") {
        setAnnotatedFrame(data.image);
      }
    };

    const interval = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && wsVideo.readyState === WebSocket.OPEN && video.readyState >= 2) {
        const vWidth = 320;
        const vHeight = 240;

        if (vWidth > 0 && vHeight > 0) {
          const ctx = canvas.getContext('2d');
          canvas.width = vWidth;
          canvas.height = vHeight;
          ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
          const base64Data = canvas.toDataURL('image/jpeg', 0.4);
          wsVideo.send(JSON.stringify({ 
            type: "frame", 
            image: base64Data,
            lat: userLocationRef.current?.lat,
            lng: userLocationRef.current?.lng
          }));
        }
      }
    }, 250);

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
      }
      clearInterval(interval);
      wsVideo.close();
    };
  }, [cameraMode]);

  // Connect to Mobile IP Camera
  const connectIpCamera = async () => {
    let rawUrl = ipCameraUrl.trim();
    if (!rawUrl) return;

    // Auto-fix missing protocol or endpoint
    if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
      rawUrl = "http://" + rawUrl;
    }
    if (!rawUrl.endsWith("/video") && !rawUrl.endsWith("/shot.jpg") && !rawUrl.endsWith("/video.mjpg")) {
      rawUrl = rawUrl.replace(/\/$/, "") + "/video";
    }
    setIpCameraUrl(rawUrl);

    setIpCamStatus("connecting");
    setIpCamError(null);
    try {
      const res = await fetch("http://127.0.0.1:8000/api/connect-ip-camera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          url: rawUrl,
          lat: userLocationRef.current?.lat,
          lng: userLocationRef.current?.lng
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIpCamStatus("connected");
        setIsCameraActive(true);
      } else {
        setIpCamStatus("error");
        setIpCamError(data.detail || "Failed to connect to IP Camera");
      }
    } catch (err: any) {
      setIpCamStatus("error");
      setIpCamError(err.message || "Network error while connecting to IP Camera");
    }
  };

  // Simulate Emergency Dispatch Test
  const simulateEmergency = async () => {
    try {
      const incId = `INC-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      await fetch("http://127.0.0.1:8000/api/trigger-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "emergency",
          incident_id: incId,
          type: "Road Traffic Accident",
          confidence: 0.96,
          risk_score: 95,
          severity: "CRITICAL",
          victims_detected: 2,
          vehicles_involved: 1,
          location: "MAIN HIGHWAY - CAM 04",
          lat: userLocation?.lat,
          lng: userLocation?.lng
        }),
      });
    } catch (error) {
      console.error("Failed to simulate emergency to backend", error);
    }
  };

  // Submit Citizen Emergency Report
  const handleCitizenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCitizenStatus("Submitting emergency report...");
    try {
      const incId = `INC-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      await fetch("http://127.0.0.1:8000/api/trigger-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "emergency",
          incident_id: incId,
          type: citizenReportText || "Citizen Reported Incident",
          confidence: 0.98,
          risk_score: 88,
          severity: "HIGH",
          victims_detected: 1,
          vehicles_involved: 0,
          location: "Citizen Mobile Upload",
          lat: userLocation?.lat,
          lng: userLocation?.lng
        }),
      });
      setCitizenStatus("Report broadcast successfully! First responders and AI guidance activated.");
      setActiveTab("dashboard");
    } catch (err) {
      setCitizenStatus("Failed to broadcast report. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-200 font-sans p-4 flex flex-col items-stretch">

      {/* HEADER SECTION */}
      <header className="flex justify-between items-center bg-[#111111] p-4 rounded-xl border border-gray-800 shadow-lg mb-4 flex-wrap gap-4">
        <div className="flex items-center space-x-3">
          <Activity className="text-cyan-400 w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold tracking-widest text-white flex items-center gap-2">
              LIFE-LINK <span className="text-cyan-400 text-xs px-2 py-0.5 bg-cyan-950/60 border border-cyan-800 rounded font-mono">AI PLATFORM</span>
            </h1>
            <p className="text-[11px] text-gray-400 font-mono">Hackathon MVP • Incident Intelligence & Response</p>
          </div>
          <span className={`ml-2 px-3 py-1 text-xs font-mono font-semibold uppercase tracking-wider rounded-full border ${isConnected ? 'bg-cyan-950/30 text-cyan-400 border-cyan-800' : 'bg-red-950/30 text-red-400 border-red-800'}`}>
            {isConnected ? "System Online" : "System Offline"}
          </span>
        </div>

        {/* TAB NAVIGATION */}
        <div className="flex items-center bg-[#1a1a1a] p-1 rounded-lg border border-gray-800">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold uppercase transition-all ${activeTab === 'dashboard' ? 'bg-cyan-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
          >
            Dispatch Dashboard
          </button>
          <button
            onClick={() => setActiveTab("citizen")}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold uppercase transition-all flex items-center gap-1.5 ${activeTab === 'citizen' ? 'bg-cyan-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
          >
            <Smartphone className="w-3.5 h-3.5" /> Citizen Upload
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`p-2 rounded-lg border transition-all ${isMuted ? 'text-gray-500 border-gray-700 bg-gray-800' : 'text-cyan-400 border-cyan-800 bg-cyan-950/30'}`}
            title={isMuted ? "Unmute Alerts" : "Mute Alerts"}
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <button
            onClick={simulateEmergency}
            className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all shadow-[0_0_15px_rgba(220,38,38,0.4)] hover:shadow-[0_0_25px_rgba(220,38,38,0.7)]"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Simulate Incident</span>
          </button>
        </div>
      </header>

      {/* CITIZEN EMERGENCY UPLOAD TAB */}
      {activeTab === "citizen" ? (
        <div className="bg-[#111111] border border-gray-800 rounded-xl p-6 max-w-3xl mx-auto w-full shadow-2xl">
          <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-gray-800">
            <Smartphone className="w-8 h-8 text-cyan-400" />
            <div>
              <h2 className="text-xl font-bold text-white uppercase tracking-wider">Citizen Emergency Report Mode</h2>
              <p className="text-xs text-gray-400 font-mono">Report an accident or fallen victim instantly to trigger dispatch & guidance.</p>
            </div>
          </div>

          <form onSubmit={handleCitizenSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-2">Emergency Description / Type</label>
              <input
                type="text"
                value={citizenReportText}
                onChange={(e) => setCitizenReportText(e.target.value)}
                placeholder="e.g. Vehicle collision on main street / Fallen elderly person unresponsive"
                className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-300 mb-2">Upload Photo or Video (Optional)</label>
              <div className="border-2 border-dashed border-gray-700 hover:border-cyan-500/50 rounded-xl p-6 text-center bg-[#151515] transition-all cursor-pointer">
                <Upload className="w-8 h-8 text-cyan-400 mx-auto mb-2 opacity-70" />
                <p className="text-sm text-gray-300">Drag & drop emergency media file here, or tap to browse</p>
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => setCitizenFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="citizen-file-input"
                />
                <label htmlFor="citizen-file-input" className="mt-3 inline-block px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-xs font-semibold rounded-md text-cyan-400 cursor-pointer">
                  Select File
                </label>
                {citizenFile && <p className="text-xs text-green-400 mt-2 font-mono">Attached: {citizenFile.name}</p>}
              </div>
            </div>

            <div className="bg-cyan-950/20 border border-cyan-900/50 rounded-lg p-3 flex items-center space-x-3 text-xs text-cyan-300">
              <MapPin className="w-5 h-5 shrink-0 text-cyan-400" />
              <span>GPS Location: {userLocation ? `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}` : "Detecting device GPS location..."}</span>
            </div>

            <button
              type="submit"
              className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-bold uppercase tracking-wider transition-all flex items-center justify-center space-x-2 shadow-[0_0_20px_rgba(220,38,38,0.5)]"
            >
              <Send className="w-5 h-5" />
              <span>Broadcast Emergency Report Now</span>
            </button>
          </form>

          {citizenStatus && (
            <div className="mt-4 p-3 rounded-lg bg-gray-800 border border-gray-700 text-xs font-mono text-cyan-400 text-center animate-pulse">
              {citizenStatus}
            </div>
          )}
        </div>
      ) : (

        /* MAIN DISPATCH DASHBOARD LAYOUT */
        <div className="flex flex-col gap-4 flex-grow h-full">

          {/* TOP ROW GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:min-h-[52vh]">

            {/* LHS: INCIDENT ACTIVITY LOG & OUTPUT DETAILS (3 Col) */}
            <div className="lg:col-span-3 bg-[#111111] rounded-xl border border-gray-800 shadow-lg flex flex-col overflow-hidden max-h-full">
              <div className="bg-[#1a1a1a] p-4 border-b border-gray-800 flex items-center justify-between">
                <h2 className="text-xs font-bold text-gray-300 uppercase tracking-widest flex items-center">
                  <AlertCircle className="w-4 h-4 mr-2 text-cyan-400" /> Incident Log
                </h2>
                <span className="text-xs bg-gray-800 text-cyan-400 px-2.5 py-0.5 rounded-full font-mono font-bold">{alerts.length}</span>
              </div>

              <div className="p-3 flex-grow overflow-y-auto space-y-3 custom-scrollbar">
                {alerts.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-3 py-10">
                    <HeartPulse className="w-10 h-10 opacity-20" />
                    <p className="text-xs font-mono text-center">No active incidents detected.</p>
                  </div>
                ) : (
                  alerts.map((alert, idx) => (
                    <div
                      key={idx}
                      className={`relative p-3.5 rounded-xl border bg-[#141414] transition-all duration-300 ${alert.severity === "CRITICAL" || alert.severity === "HIGH"
                        ? "border-red-500/60 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                        : "border-yellow-500/50"
                        }`}
                    >
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-800">
                          {alert.incident_id || 'INC-2026-9041'}
                        </span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${alert.severity === 'CRITICAL' ? 'bg-red-600 text-white' : 'bg-yellow-600 text-white'}`}>
                          {alert.severity}
                        </span>
                      </div>

                      <h3 className="font-bold text-white text-sm truncate mt-1">{alert.type}</h3>

                      {/* PDF Spec Risk Score Bar */}
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between text-[11px] font-mono text-gray-400">
                          <span>AI Risk Score:</span>
                          <span className="font-bold text-cyan-400">{alert.risk_score || 92}/100</span>
                        </div>
                        <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-yellow-500 to-red-600 h-full rounded-full transition-all duration-500"
                            style={{ width: `${alert.risk_score || 92}%` }}
                          />
                        </div>
                      </div>

                      {/* Victim & Vehicle Count Badges */}
                      <div className="grid grid-cols-2 gap-1.5 mt-2.5 pt-2 border-t border-gray-800/80 text-[11px] font-mono">
                        <div className="flex items-center text-gray-300">
                          <User className="w-3 h-3 mr-1 text-cyan-400" />
                          <span>Victims: <b className="text-white">{alert.victims_detected || 1}</b></span>
                        </div>
                        <div className="flex items-center text-gray-300">
                          <Car className="w-3 h-3 mr-1 text-orange-400" />
                          <span>Vehicles: <b className="text-white">{alert.vehicles_involved || 0}</b></span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-gray-500 font-mono mt-2">
                        <span className="flex items-center"><Video className="w-3 h-3 mr-1" /> {alert.location || 'CAM_01'}</span>
                        <span>{(alert.confidence * 100).toFixed(0)}% Conf.</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* CENTER: LIVE MONITORING & CAMERA CONTROLS (5 Col) */}
            <div className="lg:col-span-5 bg-[#111111] rounded-xl border border-gray-800 shadow-lg flex flex-col relative overflow-hidden">
              
              {/* TOP CAMERA CONTROLS BAR */}
              <div className="bg-[#181818] p-2.5 border-b border-gray-800 flex items-center justify-between flex-wrap gap-2 z-10">
                <div className="flex items-center space-x-1.5">
                  <Video className="w-4 h-4 text-cyan-400" />
                  <select
                    value={cameraMode}
                    onChange={(e) => setCameraMode(e.target.value as any)}
                    className="bg-[#101010] border border-gray-700 text-xs text-white rounded-md px-2 py-1 font-mono focus:outline-none focus:border-cyan-500"
                  >
                    <option value="webcam">📷 Local Webcam</option>
                    <option value="ip_camera">📱 Mobile IP Camera</option>
                    <option value="file_upload">📁 Video File Upload</option>
                  </select>
                </div>

                {cameraMode === "ip_camera" && (
                  <button
                    onClick={() => setShowIpCamGuide(true)}
                    className="flex items-center space-x-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-mono bg-cyan-950/40 border border-cyan-800 px-2 py-1 rounded"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Setup Mobile Camera</span>
                  </button>
                )}
              </div>

              {/* MOBILE IP CAMERA INPUT PANEL */}
              {cameraMode === "ip_camera" && (
                <div className="bg-[#151515] p-3 border-b border-gray-800 flex items-center space-x-2">
                  <Smartphone className="w-4 h-4 text-cyan-400 shrink-0" />
                  <input
                    type="text"
                    value={ipCameraUrl}
                    onChange={(e) => setIpCameraUrl(e.target.value)}
                    placeholder="http://192.168.1.45:8080/video"
                    className="flex-grow bg-[#0a0a0a] border border-gray-700 text-xs text-white px-2.5 py-1.5 rounded font-mono focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    onClick={connectIpCamera}
                    className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold px-3 py-1.5 rounded transition-all font-mono shrink-0 flex items-center gap-1"
                  >
                    <Wifi className="w-3.5 h-3.5" />
                    <span>{ipCamStatus === "connecting" ? "Connecting..." : "Connect"}</span>
                  </button>
                </div>
              )}

              {/* CAMERA ERROR ALERTS */}
              {cameraPermissionError && cameraMode === "webcam" && (
                <div className="bg-red-950/80 border-b border-red-800 p-2.5 text-xs text-red-200 flex items-center justify-between font-mono">
                  <span>⚠️ {cameraPermissionError}</span>
                  <button onClick={() => setCameraMode("ip_camera")} className="text-cyan-400 underline ml-2">Use Mobile IP Camera</button>
                </div>
              )}

              {ipCamError && cameraMode === "ip_camera" && (
                <div className="bg-red-950/80 border-b border-red-800 p-2.5 text-xs text-red-200 flex items-center justify-between font-mono">
                  <span>⚠️ {ipCamError}</span>
                  <button onClick={() => setShowIpCamGuide(true)} className="text-cyan-400 underline ml-2">Read Guide</button>
                </div>
              )}

              {/* VIDEO MONITOR CONTAINER */}
              <div className="flex-grow bg-[#050505] relative w-full h-full min-h-[360px] flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute opacity-0 pointer-events-none w-1 h-1 w-full h-full object-contain z-0 transition-transform duration-200"
                  style={{ transform: `scale(${zoomLevel})` }}
                />
                <canvas ref={canvasRef} className="absolute opacity-0 pointer-events-none w-1 h-1" />

                {cameraMode === "ip_camera" && ipCamStatus === "connected" && annotatedFrame ? (
                  <img
                    src={annotatedFrame}
                    alt="Mobile IP Camera AI Feed"
                    className="absolute inset-0 w-full h-full object-contain z-0 transition-transform duration-200"
                    style={{ transform: `scale(${zoomLevel})` }}
                  />
                ) : cameraMode === "ip_camera" && ipCamStatus === "connected" ? (
                  <img
                    src={ipCameraUrl}
                    alt="Mobile IP Camera Stream"
                    className="absolute inset-0 w-full h-full object-contain z-0 transition-transform duration-200"
                    style={{ transform: `scale(${zoomLevel})` }}
                  />
                ) : isCameraActive && annotatedFrame ? (
                  <img
                    src={annotatedFrame}
                    alt="Annotated AI Vision Feed"
                    className="absolute inset-0 w-full h-full object-contain z-0 transition-transform duration-200"
                    style={{ transform: `scale(${zoomLevel})` }}
                  />
                ) : isCameraActive ? (
                  <div className="z-10 flex flex-col items-center justify-center text-cyan-500 font-mono animate-pulse">
                    <Video className="w-12 h-12 mb-3 opacity-50" />
                    <p className="text-xs">Initializing YOLOv8 + Pose AI Pipeline...</p>
                  </div>
                ) : (
                  <div className="z-10 flex flex-col items-center justify-center text-gray-600 p-6 text-center space-y-2">
                    <CameraOff className="w-12 h-12 text-gray-700" />
                    <p className="text-xs text-gray-400">Select camera source or connect Mobile IP Camera to start monitoring.</p>
                    {cameraMode === "ip_camera" && (
                      <button onClick={connectIpCamera} className="px-3 py-1 bg-cyan-950 text-cyan-400 border border-cyan-800 rounded text-xs font-mono">
                        Retry IP Camera Connection
                      </button>
                    )}
                  </div>
                )}

                {/* Cyber Grid Overlay */}
                <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

                {/* Emergency Bounding Highlight & Actionable Popup */}
                {alerts.length > 0 && alerts[0].severity === 'CRITICAL' && (
                  <div className="absolute inset-0 bg-red-950/40 backdrop-blur-[2px] border-4 border-red-500/50 pointer-events-auto transition-all duration-500 z-20 flex items-center justify-center">
                    <div className="p-6 bg-[#0a0a0a] border-2 border-red-500/80 rounded-2xl text-center shadow-[0_0_50px_rgba(239,68,68,0.5)] max-w-sm w-full mx-4 flex flex-col items-center">
                      <ShieldAlert className="w-14 h-14 text-red-500 mb-2 animate-pulse" />
                      <h2 className="text-2xl font-black text-red-500 tracking-widest mb-1">EMERGENCY</h2>
                      <p className="text-sm text-red-200 uppercase font-mono font-bold bg-red-950/50 px-3 py-1 rounded-full mb-4">
                        {alerts[0].type}
                      </p>
                      
                      <div className="text-left bg-[#111111] p-3 rounded-lg border border-red-900/50 mb-5 w-full">
                        <p className="text-[11px] text-gray-300 font-mono mb-1 font-bold text-red-400">⚠️ IMMEDIATE PRECAUTIONS:</p>
                        <ul className="text-[10px] text-gray-400 font-mono space-y-1 ml-4 list-disc">
                          <li>Do NOT move the patient unless in danger.</li>
                          <li>Check for responsiveness & breathing.</li>
                          <li>Keep the patient warm and calm.</li>
                          <li>Wait for professional medical help.</li>
                        </ul>
                      </div>

                      <a 
                        href={`tel:${activeHospital?.phone || '108'}`} 
                        className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3.5 rounded-xl uppercase tracking-widest flex items-center justify-center space-x-2 transition-all shadow-[0_0_20px_rgba(239,68,68,0.6)] hover:scale-105"
                      >
                        <HeartPulse className="w-5 h-5 animate-bounce" />
                        <span>Call Ambulance Now</span>
                      </a>
                      
                      <button 
                        onClick={() => {
                          // Allow dismissing the overlay to see the camera
                          setAlerts([]);
                        }}
                        className="mt-4 text-[10px] text-gray-500 uppercase tracking-widest hover:text-gray-300 font-mono transition-colors"
                      >
                        Dismiss Overlay
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RHS: AI GUIDANCE & INCIDENT RESPONSE (4 Col) */}
            <div className="lg:col-span-4 bg-[#111111] rounded-xl border border-gray-800 shadow-lg flex flex-col max-h-full">
              <div className="bg-[#1a1a1a] p-4 border-b border-gray-800">
                <h2 className="text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center">
                  <FileText className="w-4 h-4 mr-2" /> Bystander Guidance Protocol
                </h2>
              </div>

              <div className="p-4 flex-grow overflow-y-auto custom-scrollbar relative space-y-4">
                {!activeGuidance ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-600 text-center px-4 py-12">
                    <ShieldAlert className="w-10 h-10 mb-3 opacity-20" />
                    <p className="text-xs leading-relaxed font-mono">System standing by. Safe first-response protocols activate automatically upon incident detection.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {callStatus !== "idle" && (
                      <div className={`border rounded-xl p-4 text-center shadow-lg transition-all duration-500 ${
                        callStatus === "dialing" ? "bg-amber-950/30 border-amber-500/50 animate-pulse" :
                        callStatus === "connected" ? "bg-blue-950/30 border-blue-500/50" :
                        "bg-emerald-950/30 border-emerald-500/50"
                      }`}>
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <div className={`relative flex h-3 w-3 ${callStatus === "dialing" ? "block" : "hidden"}`}>
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                          </div>
                          <div className={`relative flex h-3 w-3 ${callStatus === "connected" ? "block" : "hidden"}`}>
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                          </div>
                          <div className={`relative flex h-3 w-3 ${callStatus === "dispatched" ? "block" : "hidden"}`}>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                          </div>
                          
                          <span className={`text-[10px] font-mono font-bold uppercase tracking-widest ${
                            callStatus === "dialing" ? "text-amber-400" :
                            callStatus === "connected" ? "text-blue-400" :
                            "text-emerald-400"
                          }`}>
                            {callStatus === "dialing" ? "📞 Dialing Ambulance Services..." :
                             callStatus === "connected" ? "⚡ Live GPS Coordinates Shared" :
                             "🚑 Ambulance Dispatched"}
                          </span>
                        </div>
                        
                        <p className="text-white font-mono text-sm font-semibold">
                          {callStatus === "dialing" ? "Calling Emergency Dispatch (108)..." :
                           callStatus === "connected" ? "Connected to Dispatcher Center" :
                           `Unit AMB-01 Dispatched from ${activeHospital?.name || "General ER"}`}
                        </p>
                        
                        <div className="mt-2 text-[10px] font-mono text-gray-400">
                          {callStatus === "dialing" && "Initializing voice response & telemetry link..."}
                          {callStatus === "connected" && "Transmitting camera coordinate data..."}
                          {callStatus === "dispatched" && `ETA: 4 minutes • Phone: ${activeHospital?.phone || "108"}`}
                        </div>
                      </div>
                    )}

                    {activeHospital && callStatus === "idle" && (
                      <div className="bg-red-950/40 border border-red-500/50 rounded-xl p-3 text-center shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                        <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center justify-center">
                          🚑 DISPATCHED TO: {activeHospital.name}
                        </h3>
                        <p className="text-gray-200 font-mono mt-1 font-bold text-base">📞 {activeHospital.phone}</p>
                      </div>
                    )}

                    <div className="prose prose-invert prose-sm max-w-none text-gray-300">
                      <div className="whitespace-pre-wrap font-mono text-xs relative space-y-2">
                        {displayedGuidance.split('\n').filter(line => line.trim().length > 0).map((line, idx) => {
                          const cleanLine = line.replace(/^[\*\-\#\s]+/, '').replace(/\*\*/g, '').trim();
                          if (!cleanLine) return null;
                          return (
                            <div key={idx} className="flex items-start">
                              <ChevronRight className="w-3.5 h-3.5 text-cyan-500 shrink-0 mt-0.5 mr-1.5 opacity-80" />
                              <span className="text-gray-200 leading-relaxed">{cleanLine}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* BOTTOM ROW: PDF RESPONSE TIMELINE & GEOSPATIAL DISPATCH MAP */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

            {/* RESPONSE TIMELINE WIDGET (PDF SPEC SECTION 5) (5 Col) */}
            <div className="lg:col-span-5 bg-[#111111] rounded-xl border border-gray-800 shadow-lg p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3 border-b border-gray-800 pb-2">
                <h2 className="text-xs font-bold text-gray-300 uppercase tracking-widest flex items-center">
                  <Clock className="w-4 h-4 mr-2 text-cyan-400" /> Response Dispatch Timeline
                </h2>
                <span className="text-[10px] font-mono text-cyan-400">Step {timelineStep} of 5</span>
              </div>

              <div className="space-y-2 font-mono text-xs">
                {[
                  { step: 1, label: "AI Detection Triggered", desc: "YOLOv8 + Pose event detection" },
                  { step: 2, label: `Incident Created (${alerts[0]?.incident_id || 'INC-2026-9041'})`, desc: "Severity & GPS logged" },
                  { step: 3, label: "Ambulance Dispatched", desc: "Nearest unit en route to location" },
                  { step: 4, label: "Police Control Notified", desc: "Traffic regulation requested" },
                  { step: 5, label: "Hospital Alerted", desc: "ER prep & trauma team standing by" }
                ].map((item) => {
                  const isDone = timelineStep >= item.step;
                  return (
                    <div key={item.step} className={`flex items-center justify-between p-2 rounded-lg border transition-all ${isDone ? 'bg-cyan-950/20 border-cyan-800/80 text-cyan-300' : 'bg-gray-900/40 border-gray-800/60 text-gray-600'}`}>
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className={`w-4 h-4 ${isDone ? 'text-cyan-400' : 'text-gray-700'}`} />
                        <span className="font-semibold">{item.label}</span>
                      </div>
                      <span className="text-[10px] opacity-70">{item.desc}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* GEOSPATIAL MAP (7 Col) */}
            <div className="lg:col-span-7 bg-[#111111] rounded-xl border border-gray-800 shadow-lg p-3 flex flex-col min-h-[280px] relative overflow-hidden">
              <div className="absolute top-4 left-4 z-[400] bg-[#1a1a1a]/90 backdrop-blur-md px-3 py-1.5 border border-gray-800 rounded-lg flex items-center shadow-lg pointer-events-none">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2"></div>
                <h2 className="text-[11px] font-semibold text-gray-300 uppercase tracking-widest font-mono">Live Incident & Unit Map</h2>
              </div>
              <div ref={mapContainerRef} className="w-full h-full min-h-[260px] rounded-lg border border-gray-800 z-0"></div>
            </div>

          </div>

        </div>
      )}

      {/* MOBILE IP CAMERA SETUP GUIDE MODAL */}
      {showIpCamGuide && (
        <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 relative">
            <button onClick={() => setShowIpCamGuide(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 text-cyan-400">
              <Smartphone className="w-6 h-6" />
              <h3 className="text-lg font-bold uppercase tracking-wider text-white">Mobile IP Camera Guide</h3>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed font-mono">
              Use your Android or iPhone camera as the live AI detection feed:
            </p>

            <ol className="text-xs space-y-3 font-mono text-gray-300 border-l-2 border-cyan-600 pl-4">
              <li>
                <b className="text-cyan-400">Step 1: Install Stream App</b><br />
                Download <span className="text-white">"IP Webcam"</span> (Android Play Store) or <span className="text-white">"DroidCam"</span> (iOS App Store).
              </li>
              <li>
                <b className="text-cyan-400">Step 2: Connect Same Wi-Fi</b><br />
                Ensure your phone and laptop are connected to the exact same Wi-Fi network.
              </li>
              <li>
                <b className="text-cyan-400">Step 3: Start Server & Copy IP</b><br />
                Tap <i>"Start Server"</i> in IP Webcam. Copy the IP shown on screen (e.g. <code>http://192.168.1.45:8080</code>).
              </li>
              <li>
                <b className="text-cyan-400">Step 4: Connect on Dashboard</b><br />
                Paste the URL + <code>/video</code> (e.g., <code>http://192.168.1.45:8080/video</code>) into the camera input bar and click Connect.
              </li>
            </ol>

            <button
              onClick={() => setShowIpCamGuide(false)}
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 rounded-lg text-xs uppercase tracking-wider transition-all font-mono"
            >
              Got It - Close Guide
            </button>
          </div>
        </div>
      )}

      {/* Hidden Audio Element for Alarms */}
      <audio
        ref={audioRef}
        src="https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
        onEnded={() => {
          if (playCountRef.current < 3) {
            playCountRef.current += 1;
            audioRef.current?.play().catch(e => console.warn(e));
          }
        }}
      />

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #111;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #333;
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
