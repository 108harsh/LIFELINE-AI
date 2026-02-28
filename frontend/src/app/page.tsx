"use client";

import React, { useEffect, useState, useRef } from "react";
import { AlertCircle, Activity, HeartPulse, Video, ShieldAlert, FileText, ChevronRight, CameraOff, Volume2, VolumeX } from "lucide-react";

declare global {
  interface Window {
    L: any;
  }
}

interface AlertPayload {
  status: string;
  type: string;
  confidence: number;
  location?: string;
  severity: string;
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
}

export default function Dashboard() {
  const [alerts, setAlerts] = useState<AlertPayload[]>([]);
  const [activeGuidance, setActiveGuidance] = useState<string | null>(null);
  const [displayedGuidance, setDisplayedGuidance] = useState<string>("");
  const [activeHospital, setActiveHospital] = useState<{ name: string, phone: string, lat: number, lng: number } | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [annotatedFrame, setAnnotatedFrame] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isMuted, setIsMuted] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
  const userLocationRef = useRef<{ lat: number, lng: number } | null>(null);

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
    if (!userLocation) return; // wait for location

    const checkInterval = setInterval(() => {
      if (typeof window !== "undefined" && window.L && mapContainerRef.current && !mapRef.current) {
        clearInterval(checkInterval);
        const L = window.L;
        const defaultCenter = [userLocation.lat, userLocation.lng];

        const map = L.map(mapContainerRef.current, {
          zoomControl: false,
          attributionControl: false
        }).setView(defaultCenter, 13);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          subdomains: 'abcd',
          maxZoom: 20
        }).addTo(map);

        // Add a blue pulsing marker for the user's current location
        currentUserMarkerRef.current = L.marker(defaultCenter, {
          icon: L.divIcon({
            className: 'bg-transparent border-none',
            html: `<div class="relative flex h-5 w-5"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span class="relative inline-flex rounded-full h-5 w-5 bg-blue-500 border-2 border-white shadow-[0_0_15px_rgba(59,130,246,0.8)]"></span></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          })
        }).addTo(map).bindPopup("<b class='text-blue-500'>Current Location</b>").openPopup();

        // Fix Leaflet container size bug when rendered inside CSS Grid/Flexbox
        setTimeout(() => {
          map.invalidateSize();
        }, 500);

        mapRef.current = map;
      }
    }, 500);

    return () => clearInterval(checkInterval);
  }, [userLocation]);

  // Set up WebSocket connection
  useEffect(() => {
    ws.current = new WebSocket("ws://localhost:8000/ws/emergency-alerts");

    ws.current.onopen = () => {
      setIsConnected(true);
      console.log("WebSocket connected");
    };

    ws.current.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.status === "emergency") {
          const newAlert: AlertPayload = {
            ...data,
            // Override severity to HIGH as requested, and add location mapping
            location: data.location || "LOBBY",
            severity: "HIGH",
          };

          setAlerts((prev) => [newAlert, ...prev]);

          // Clear current typewriter text and load new one
          setDisplayedGuidance("");

          // Update Geospatial Map
          const L = window.L;
          if (L && mapRef.current) {
            // Use lat/lng from alert if available, else user's location, else fallback
            const baseLat = newAlert.lat || userLocationRef.current?.lat || 40.7128;
            const baseLng = newAlert.lng || userLocationRef.current?.lng || -74.0060;

            const incidentLoc = [baseLat, baseLng];

            // Clear previous markers
            if (incidentMarkerRef.current) mapRef.current.removeLayer(incidentMarkerRef.current);

            // Add Incident Marker (Red pulsing)
            incidentMarkerRef.current = L.marker(incidentLoc, {
              icon: L.divIcon({
                className: 'bg-transparent border-none',
                html: `<div class="relative flex h-5 w-5"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span><span class="relative inline-flex rounded-full h-5 w-5 bg-red-600 border-2 border-white shadow-[0_0_15px_rgba(220,38,38,0.8)]"></span></div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
              })
            }).addTo(mapRef.current).bindPopup("<b class='text-red-600'>Incident Location</b>");
          }

          // Trigger Audio Alarm if unmuted
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

          // Handle AI guidance: Either it comes with the WS payload or we fetch it dynamically
          if (newAlert.guidance) {
            setActiveGuidance(newAlert.guidance);
            if (newAlert.hospital) setActiveHospital(newAlert.hospital);
          } else {
            // Trigger request to backend /api/get-guidance endpoint
            try {
              const res = await fetch("http://localhost:8000/api/get-guidance", {
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
              }
            } catch (err) {
              console.error("Failed to fetch guidance dynamically", err);
            }
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
    setDisplayedGuidance(""); // Reset before typing

    // Character by character animation intervals
    const typingInterval = setInterval(() => {
      if (i < activeGuidance.length) {
        setDisplayedGuidance((prev) => prev + activeGuidance.charAt(i));
        i++;
      } else {
        clearInterval(typingInterval);
      }
    }, 12); // Adjust speed here (ms per char)

    return () => clearInterval(typingInterval);
  }, [activeGuidance]);

  // Hospital Routing Map Effect
  useEffect(() => {
    if (activeHospital && userLocationRef.current && mapRef.current) {
      const L = window.L;
      const hospitalLoc = [activeHospital.lat, activeHospital.lng];
      const userLoc = [userLocationRef.current.lat, userLocationRef.current.lng];

      // Clear previous responder/routing
      if (responderMarkerRef.current) mapRef.current.removeLayer(responderMarkerRef.current);
      if (routingLineRef.current) mapRef.current.removeLayer(routingLineRef.current);

      // Add Hospital Marker
      responderMarkerRef.current = L.marker(hospitalLoc, {
        icon: L.divIcon({
          className: 'bg-transparent border-none',
          html: `<div class="flex items-center justify-center bg-red-600 text-white font-bold rounded-full border-2 border-white shadow-[0_0_15px_rgba(220,38,38,0.8)]" style="width: 28px; height: 28px;">H</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        })
      }).addTo(mapRef.current).bindPopup(`<b class='text-red-600'>${activeHospital.name}</b><br/>📞 ${activeHospital.phone}`).openPopup();

      // Draw Red Dashed Route Line
      routingLineRef.current = L.polyline([userLoc, hospitalLoc], {
        color: '#dc2626',
        dashArray: '10, 10',
        weight: 3,
        opacity: 0.8
      }).addTo(mapRef.current);

      // Fit bounds to show both
      const bounds = L.latLngBounds(userLoc, hospitalLoc).pad(0.1);
      mapRef.current.fitBounds(bounds);
    }
  }, [activeHospital]);

  // Request & attach user webcam
  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsCameraActive(true);
        }
      } catch (err) {
        console.error("Error accessing webcam:", err);
        setIsCameraActive(false);
      }
    }
    setupCamera();

    // Secondary websocket for sending frames & receiving AI annotated vision
    const wsVideo = new WebSocket("ws://localhost:8000/ws/video-stream");

    wsVideo.onopen = () => {
      console.log("Video Stream WS connected");
    };

    wsVideo.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "annotated_frame") {
        setAnnotatedFrame(data.image);
      }
    };

    // Capture from local hidden video tag and transmit every 500ms
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
          wsVideo.send(JSON.stringify({ type: "frame", image: base64Data }));
        }
      }
    }, 250);

    return () => {
      // Clean up camera on unmount
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
      }
      clearInterval(interval);
      wsVideo.close();
    };
  }, []);

  const simulateEmergency = async () => {
    try {
      await fetch("http://localhost:8000/api/trigger-alert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "emergency",
          type: "cardiac_arrest_suspected",
          confidence: 0.95,
          location: "Lobby",
          lat: userLocation?.lat,
          lng: userLocation?.lng
        }),
      });
    } catch (error) {
      console.error("Failed to simulate emergency to backend", error);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-200 font-sans p-4 flex flex-col items-stretch">

      {/* HEADER SECTION */}
      <header className="flex justify-between items-center bg-[#111111] p-4 rounded-xl border border-gray-800 shadow-lg mb-4">
        <div className="flex items-center space-x-3">
          <Activity className="text-cyan-400 w-8 h-8" />
          <h1 className="text-2xl font-bold tracking-widest text-white">
            LIFELINE <span className="text-cyan-400">AI</span>
          </h1>
          <span className={`ml-4 px-3 py-1 text-xs font-mono font-semibold uppercase tracking-wider rounded-full border ${isConnected ? 'bg-cyan-950/30 text-cyan-400 border-cyan-800' : 'bg-red-950/30 text-red-400 border-red-800'}`}>
            {isConnected ? "System Online" : "System Offline"}
          </span>
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`p-2 rounded-lg border transition-all ${isMuted ? 'text-gray-500 border-gray-700 bg-gray-800' : 'text-cyan-400 border-cyan-800 bg-cyan-950/30'}`}
            title={isMuted ? "Unmute Alerts" : "Mute Alerts"}
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <button
            onClick={simulateEmergency}
            className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg font-semibold transition-all shadow-[0_0_15px_rgba(220,38,38,0.4)] hover:shadow-[0_0_25px_rgba(220,38,38,0.7)]"
          >
            <ShieldAlert className="w-5 h-5" />
            <span>Simulate Emergency</span>
          </button>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <div className="flex flex-col gap-4 flex-grow h-full">

        {/* TOP ROW GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:min-h-[50vh]">

          {/* LHS: ACTIVE EMERGENCY LOG (3 Col) */}
          <div className="lg:col-span-3 bg-[#111111] rounded-xl border border-gray-800 shadow-lg flex flex-col overflow-hidden max-h-full">
            <div className="bg-[#1a1a1a] p-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" /> Activity Log
              </h2>
              <span className="text-xs bg-gray-800 px-2 rounded-full">{alerts.length}</span>
            </div>

            <div className="p-4 flex-grow overflow-y-auto space-y-3 custom-scrollbar">
              {alerts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-3">
                  <HeartPulse className="w-10 h-10 opacity-20" />
                  <p className="text-sm">No active alerts.</p>
                </div>
              ) : (
                alerts.map((alert, idx) => (
                  <div
                    key={idx}
                    className={`relative p-4 rounded-lg border bg-[#151515] transition-all duration-300 ${alert.severity === "HIGH"
                      ? "border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)] animate-pulse-slow"
                      : "border-gray-700"
                      }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-xs font-bold uppercase ${alert.severity === 'HIGH' ? 'text-red-400' : 'text-yellow-400'}`}>
                        {alert.severity} PRIORITY
                      </span>
                      <span className="text-xs text-gray-500 font-mono">
                        {new Date(alert.timestamp || Date.now()).toLocaleTimeString()}
                      </span>
                    </div>
                    <h3 className="font-semibold text-white truncate">{alert.type}</h3>
                    <div className="flex justify-between items-center text-xs text-gray-400 mt-2">
                      <span className="flex items-center"><Video className="w-3 h-3 mr-1" /> {alert.location || 'CAM_01'}</span>
                      <span>Confidence: {(alert.confidence * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* CENTER: LIVE MONITORING FEED (5 Col) */}
          <div className="lg:col-span-5 bg-[#111111] rounded-xl border border-gray-800 shadow-lg flex flex-col relative overflow-hidden">
            <div className="absolute top-4 left-4 z-10 flex flex-col space-y-3">
              <div className="flex items-center space-x-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-gray-800">
                <Video className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">CAM_01 - LOBBY</span>
                {isCameraActive && (
                  <div className="relative flex h-2 w-2 ml-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </div>
                )}
              </div>

              {/* Manual Zoom Control Slider */}
              <div className="flex items-center space-x-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-gray-800 transition-opacity hover:opacity-100 opacity-50">
                <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">Zoom</span>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.1"
                  value={zoomLevel}
                  onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                  className="w-20 accent-cyan-500 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-[10px] font-mono text-cyan-400 w-4 text-right">{zoomLevel.toFixed(1)}x</span>
              </div>
            </div>

            <div className="flex-grow bg-[#050505] relative w-full h-full min-h-[400px] flex items-center justify-center">
              {/* HTML5 Video element mapping local device stream */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute opacity-0 pointer-events-none w-1 h-1 w-full h-full object-contain z-0 transition-transform duration-200" style={{ transform: `scale(${zoomLevel})`, transformOrigin: "center center" }} /* Uses opacity rather than display:none so canvas can read frames */
              />
              <canvas ref={canvasRef} className="absolute opacity-0 pointer-events-none w-1 h-1" />

              {isCameraActive && annotatedFrame ? (
                <img
                  src={annotatedFrame}
                  alt="Annotated Feed"
                  className="absolute inset-0 w-full h-full object-contain z-0 transition-transform duration-200"
                  style={{ transform: `scale(${zoomLevel})`, transformOrigin: "center center" }}
                />
              ) : isCameraActive ? (
                <div className="z-10 flex flex-col items-center justify-center text-cyan-500 font-mono animate-pulse">
                  <Video className="w-16 h-16 mb-4 opacity-50" />
                  <p>Initializing Core AI Vision Integration...</p>
                </div>
              ) : (
                <div className="z-10 flex flex-col items-center justify-center text-gray-600">
                  <CameraOff className="w-16 h-16 mb-4" />
                  <p>Establishing secure camera link...</p>
                </div>
              )}

              {/* Grid overlay for tech feel */}
              <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

              {/* Scanner line effect overlay */}
              <div className="absolute top-0 left-0 w-full h-1 bg-cyan-500/30 blur-sm animate-[scan_3s_ease-in-out_infinite] z-10 pointer-events-none" />

              {/* Blinking bounding box on active high-alert */}
              {alerts.length > 0 && alerts[0].severity === 'HIGH' && (
                <div className="absolute inset-0 border-4 border-red-500/40 pointer-events-none transition-all duration-500 z-20">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-4 bg-red-950/80 backdrop-blur-md border border-red-500/50 rounded-xl text-center shadow-[0_0_30px_rgba(239,68,68,0.5)]">
                    <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-2 animate-bounce" />
                    <h2 className="text-xl font-bold text-red-400 tracking-wider">EMERGENCY DETECTED</h2>
                    <p className="text-sm text-red-200 mt-1 uppercase font-mono">{alerts[0].type}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RHS: AI GUIDANCE PANEL (4 Col) */}
          <div className="lg:col-span-4 bg-[#111111] rounded-xl border border-gray-800 shadow-lg flex flex-col max-h-full">
            <div className="bg-[#1a1a1a] p-4 border-b border-gray-800">
              <h2 className="text-sm font-semibold text-cyan-400 uppercase tracking-widest flex items-center">
                <FileText className="w-4 h-4 mr-2" /> Life-Saving Guidance
              </h2>
            </div>

            <div className="p-5 pb-20 flex-grow overflow-y-auto custom-scrollbar relative">
              {!activeGuidance ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-600 text-center px-4">
                  <ShieldAlert className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-sm leading-relaxed">System standby. AI protocols will activate immediately upon incident detection.</p>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {activeHospital && (
                    <div className="bg-red-950/40 border border-red-500/50 rounded-lg p-3 text-center shadow-[0_0_15px_rgba(239,68,68,0.2)] mb-2 mt-0">
                      <h3 className="text-sm font-bold text-red-400 uppercase tracking-widest flex items-center justify-center">
                        🚑 NEAREST HOSPITAL: {activeHospital.name}
                      </h3>
                      <p className="text-gray-300 font-mono mt-1 font-semibold text-lg">📞 {activeHospital.phone}</p>
                    </div>
                  )}

                  <div className="bg-red-950/20 border border-red-900/50 rounded-lg p-3 mb-4 sticky top-0 backdrop-blur-md z-10">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-red-400 font-mono font-semibold uppercase">Active Intervention Protocol</p>
                      {/* Blinking cursor mimic for status */}
                      <div className="w-2 h-4 bg-red-500 animate-pulse-slow"></div>
                    </div>
                  </div>

                  <div className="prose prose-invert prose-sm max-w-none text-gray-300">
                    {/* Typewriter raw streaming effect block */}
                    <div className="whitespace-pre-wrap font-mono relative">
                      {displayedGuidance.split('\n').filter(line => line.trim().length > 0).map((line, idx) => {
                        const cleanLine = line.replace(/^[\*\-\#\s]+/, '').replace(/\*\*/g, '').trim();
                        if (!cleanLine) return null;

                        const isHeader = cleanLine.match(/^[A-Z][A-Z\s]+:/);
                        return (
                          <div key={idx} className="flex items-start mb-3">
                            <ChevronRight className="w-4 h-4 text-cyan-500 shrink-0 mt-1 mr-2 opacity-70" />
                            <span className={isHeader ? "text-cyan-300 font-bold" : "text-gray-300 leading-relaxed"}>
                              {cleanLine}
                            </span>
                          </div>
                        );
                      })}
                      {/* Pulsing cursor at the end of text flow */}
                      {activeGuidance !== displayedGuidance && (
                        <span className="inline-block w-2 bg-cyan-400 animate-pulse ml-1 h-4 align-middle" />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* BOTTOM ROW: GEOSPATIAL MAP */}
        <div className="bg-[#111111] rounded-xl border border-gray-800 shadow-lg p-3 flex flex-col flex-grow min-h-[300px] relative overflow-hidden">
          <div className="absolute top-4 left-4 z-[400] bg-[#1a1a1a]/90 backdrop-blur-md px-4 py-2 border border-gray-800 rounded-lg flex items-center shadow-lg pointer-events-none">
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse mr-2"></div>
            <h2 className="text-xs font-semibold text-gray-300 uppercase tracking-widest">Live Geospatial Tracking</h2>
          </div>
          <div ref={mapContainerRef} className="w-full h-full min-h-[300px] rounded-lg border border-gray-800 z-0"></div>
        </div>

      </div>

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
        @keyframes scan {
          0%, 100% { top: 0%; transform: translateY(0); opacity: 0; }
          50% { top: 100%; transform: translateY(-100%); opacity: 1; }
        }
        .animate-pulse-slow {
          animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
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
