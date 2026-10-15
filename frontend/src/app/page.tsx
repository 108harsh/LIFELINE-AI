/* eslint-disable */
"use client";

import React from "react";
import Link from "next/link";
import { Activity, Shield, Zap, MapPin, Eye, ArrowRight, HeartPulse, Stethoscope, Video, Database } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-gray-200 font-sans selection:bg-cyan-900 selection:text-cyan-100">
      
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-900/20 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/20 rounded-full blur-[120px] pointer-events-none"></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-10 border-b border-gray-800/50 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-cyan-950/50 border border-cyan-800 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-cyan-400" />
            </div>
            <span className="text-xl font-bold tracking-widest text-white">LIFE-LINK <span className="text-cyan-400 text-xs px-1.5 py-0.5 bg-cyan-950/60 border border-cyan-800 rounded font-mono">AI</span></span>
          </div>
          <div className="flex items-center space-x-6">
            <a href="#features" className="text-sm font-semibold text-gray-400 hover:text-white transition-colors">Features</a>
            <a href="#architecture" className="text-sm font-semibold text-gray-400 hover:text-white transition-colors">Architecture</a>
            <Link 
              href="/login" 
              className="px-5 py-2 bg-white text-black text-sm font-bold rounded-full hover:bg-gray-200 transition-colors shadow-[0_0_15px_rgba(255,255,255,0.2)] hover:shadow-[0_0_20px_rgba(255,255,255,0.4)]"
            >
              System Login
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center space-x-2 bg-cyan-950/30 border border-cyan-800/50 rounded-full px-4 py-1.5 mb-8">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">Hackathon Prototype Live</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight mb-8">
            Real-Time Emergency <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
              Detection & Response
            </span>
          </h1>
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-gray-400 mb-10 leading-relaxed">
            Powered by YOLOv8 and advanced pose estimation, Life-Line AI instantly identifies falls, accidents, and medical crises—automating dispatch, intelligent routing, and first-aid guidance in crucial seconds.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/login" 
              className="w-full sm:w-auto px-8 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-all flex items-center justify-center space-x-2 shadow-[0_0_20px_rgba(8,145,178,0.4)] group"
            >
              <Shield className="w-5 h-5" />
              <span>Enter Dispatch Center</span>
              <ArrowRight className="w-5 h-5 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </Link>
            <a 
              href="https://github.com" 
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto px-8 py-4 bg-[#111111] hover:bg-[#1a1a1a] border border-gray-700 hover:border-gray-500 text-white font-bold rounded-lg transition-all flex items-center justify-center"
            >
              View GitHub Repo
            </a>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="relative z-10 py-24 px-6 bg-[#0a0a0a]/50 border-y border-gray-800/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Core Capabilities</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">An end-to-end automated pipeline connecting incident detection to rapid medical response.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <Eye className="w-6 h-6 text-cyan-400" />,
                title: "Vision Intelligence",
                desc: "YOLOv8 + MediaPipe Pose running at edge speeds to detect human collapse, traffic accidents, and critical posture changes."
              },
              {
                icon: <Zap className="w-6 h-6 text-yellow-400" />,
                title: "30-Second Verification",
                desc: "Algorithmic countdown filters out false positives by tracking recovery movement before confirming an emergency state."
              },
              {
                icon: <HeartPulse className="w-6 h-6 text-red-400" />,
                title: "Generative First-Aid",
                desc: "Groq LLM integration delivers situation-specific, medically-safe bystander guidance instantly upon incident confirmation."
              },
              {
                icon: <MapPin className="w-6 h-6 text-emerald-400" />,
                title: "Live GPS & A* Routing",
                desc: "OpenStreetMap integration identifies the nearest hospital and calculates optimal A* navigation paths dynamically."
              },
              {
                icon: <Video className="w-6 h-6 text-purple-400" />,
                title: "IP Camera Streaming",
                desc: "Seamless integration with mobile IP cameras (IP Webcam/DroidCam) to turn any smartphone into a remote AI sensor."
              },
              {
                icon: <Database className="w-6 h-6 text-blue-400" />,
                title: "Event-Driven WebSocket",
                desc: "Real-time telemetry and annotated video frames pushed directly to the React dashboard via FastAPI WebSockets."
              }
            ].map((feature, idx) => (
              <div key={idx} className="bg-[#111111] border border-gray-800 hover:border-cyan-900/50 p-6 rounded-2xl transition-colors group">
                <div className="w-12 h-12 bg-[#1a1a1a] rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack / Architecture */}
      <section id="architecture" className="relative z-10 py-24 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-12">Technology Stack</h2>
          <div className="flex flex-wrap justify-center gap-4 max-w-4xl mx-auto">
            {["Next.js 14", "React", "Tailwind CSS", "FastAPI", "Python", "OpenCV", "YOLOv8", "MediaPipe", "Groq AI", "WebSockets", "Leaflet", "Overpass API"].map((tech) => (
              <span key={tech} className="px-4 py-2 bg-[#111111] border border-gray-800 text-gray-300 font-mono text-sm rounded-lg hover:border-cyan-500 hover:text-cyan-400 transition-colors cursor-default">
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gray-800/50 bg-[#0a0a0a] py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-bold tracking-widest text-white">LIFE-LINK <span className="text-cyan-400 text-[10px] px-1 py-0.5 bg-cyan-950/60 border border-cyan-800 rounded font-mono">AI</span></span>
          </div>
          <p className="text-xs text-gray-500 font-mono">
            Hackathon Prototype © 2026. All systems operational.
          </p>
        </div>
      </footer>

    </div>
  );
}
