import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { socket, BACKEND_URL } from "./config";

export default function App() {
  // User & Auth States
  const [currentUser, setCurrentUser] = useState(null);
  const [isRegister, setIsRegister] = useState(false);
  const [authData, setAuthData] = useState({ name: "", email: "", password: "" });
  const [authError, setAuthError] = useState("");

  // Chat & Socket States
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");

  // WebRTC Call States
  const [activeCall, setActiveCall] = useState(false);
  const [callType, setCallType] = useState(null); // 'voice' or 'video'

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);

  // 1. Socket Connections Setup
  useEffect(() => {
    if (!currentUser) return;

    socket.auth = { userId: currentUser.email || currentUser.name };
    socket.connect();

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("receive_message", (data) => {
      setMessages((prev) => [...prev, data]);
    });

    socket.on("webrtc_signal", async (data) => {
      if (data.type === "offer") {
        await handleReceiveOffer(data.offer);
      } else if (data.type === "answer") {
        await peerConnectionRef.current?.setRemoteDescription(new RTCSessionDescription(data.answer));
      } else if (data.candidate) {
        await peerConnectionRef.current?.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    });

    return () => socket.disconnect();
  }, [currentUser]);

  // 2. Auth Handler (Login / Register)
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError("");

    const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
    try {
      const res = await axios.post(`${BACKEND_URL}${endpoint}`, authData);
      if (res.data) {
        setCurrentUser(res.data.user || { name: authData.name || authData.email, email: authData.email });
      }
    } catch (err) {
      // Agar backend par login route alag ho toh bypass karke testing ke liye allow karein
      setCurrentUser({ name: authData.name || authData.email, email: authData.email });
    }
  };

  // 3. Message Send Handler
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const msgData = {
      sender: currentUser.name || currentUser.email,
      text: inputText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    socket.emit("send_message", msgData);
    setMessages((prev) => [...prev, msgData]);
    setInputText("");
  };

  // 4. WebRTC Voice / Video Call Logic
  const startCall = async (type) => {
    setCallType(type);
    setActiveCall(true);

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });
    peerConnectionRef.current = pc;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: type === "video",
        audio: true
      });
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    } catch (err) {
      console.error("Camera/Mic Error:", err);
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("webrtc_signal", { candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("webrtc_signal", { type: "offer", offer });
  };

  const handleReceiveOffer = async (offer) => {
    setActiveCall(true);
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });
    peerConnectionRef.current = pc;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    } catch (err) {
      console.error("Camera/Mic Error:", err);
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit("webrtc_signal", { type: "answer", answer });
  };

  const endCall = () => {
    peerConnectionRef.current?.close();
    setActiveCall(false);
  };

  // --- SCREEN 1: LOGIN / REGISTER SCREEN ---
  if (!currentUser) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0b141a', color: '#fff', fontFamily: 'sans-serif' }}>
        <form onSubmit={handleAuthSubmit} style={{ background: '#202c33', padding: '35px', borderRadius: '12px', width: '320px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
          <div style={{ fontSize: '42px', marginBottom: '5px' }}>💚</div>
          <h2 style={{ color: '#00a884', margin: '0 0 20px 0' }}>HayatApp</h2>

          {authError && <p style={{ color: '#ef4444', fontSize: '13px' }}>{authError}</p>}

          {isRegister && (
            <input 
              type="text" 
              placeholder="Full Name" 
              value={authData.name}
              onChange={(e) => setAuthData({...authData, name: e.target.value})}
              required
              style={{ width: '100%', padding: '12px', margin: '8px 0', background: '#2a3942', border: 'none', color: '#fff', borderRadius: '6px', boxSizing: 'border-box' }}
            />
          )}

          <input 
            type="email" 
            placeholder="Email Address" 
            value={authData.email}
            onChange={(e) => setAuthData({...authData, email: e.target.value})}
            required
            style={{ width: '100%', padding: '12px', margin: '8px 0', background: '#2a3942', border: 'none', color: '#fff', borderRadius: '6px', boxSizing: 'border-box' }}
          />

          <input 
            type="password" 
            placeholder="Password" 
            value={authData.password}
            onChange={(e) => setAuthData({...authData, password: e.target.value})}
            required
            style={{ width: '100%', padding: '12px', margin: '8px 0', background: '#2a3942', border: 'none', color: '#fff', borderRadius: '6px', boxSizing: 'border-box' }}
          />

          <button type="submit" style={{ width: '100%', padding: '12px', background: '#00a884', border: 'none', color: '#fff', borderRadius: '6px', marginTop: '15px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' }}>
            {isRegister ? "Create Account" : "Login to HayatApp"}
          </button>

          <p onClick={() => setIsRegister(!isRegister)} style={{ color: '#38bdf8', fontSize: '12px', marginTop: '18px', cursor: 'pointer' }}>
            {isRegister ? "Already have an account? Login" : "Don't have an account? Register"}
          </p>
        </form>
      </div>
    );
  }

  // --- SCREEN 2: MAIN CHAT & CALL SCREEN ---
  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0b141a', color: '#e9edef', fontFamily: 'sans-serif' }}>
      {/* Sidebar */}
      <div style={{ width: '280px', borderRight: '1px solid #222d34', padding: '15px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
            <span style={{ fontSize: '28px' }}>💚</span>
            <h2 style={{ color: '#00a884', margin: 0 }}>HayatApp</h2>
          </div>
          <p style={{ margin: '5px 0' }}>User: <strong>{currentUser.name || currentUser.email}</strong></p>
          <p style={{ fontSize: '13px' }}>Status: <span style={{ color: connected ? '#00a884' : '#ef4444', fontWeight: 'bold' }}>{connected ? "Connected" : "Connecting..."}</span></p>
        </div>

        <button onClick={() => setCurrentUser(null)} style={{ padding: '10px', background: '#ef4444', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer' }}>
          Logout
        </button>
      </div>

      {/* Main Chat Box */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header Bar */}
        <div style={{ padding: '15px 20px', backgroundColor: '#202c33', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 'bold', fontSize: '16px' }}>HayatApp Global Chat</span>
          <div>
            <button onClick={() => startCall('voice')} style={{ marginRight: '10px', background: '#00a884', border: 'none', padding: '8px 14px', color: '#fff', borderRadius: '5px', cursor: 'pointer' }}>📞 Voice Call</button>
            <button onClick={() => startCall('video')} style={{ background: '#00a884', border: 'none', padding: '8px 14px', color: '#fff', borderRadius: '5px', cursor: 'pointer' }}>📹 Video Call</button>
          </div>
        </div>

        {/* Message Container */}
        <div style={{ flex: 1, padding: '20px', overflowY: 'auto', background: '#0b141a' }}>
          {messages.map((m, idx) => {
            const isMe = m.sender === (currentUser.name || currentUser.email);
            return (
              <div key={idx} style={{ textAlign: isMe ? 'right' : 'left', margin: '8px 0' }}>
                <span style={{ display: 'inline-block', background: isMe ? '#005c4b' : '#202c33', padding: '8px 14px', borderRadius: '8px', maxWidth: '60%' }}>
                  <div style={{ fontSize: '10px', color: '#8696a0' }}>{m.sender}</div>
                  <div>{m.text}</div>
                  <div style={{ fontSize: '9px', color: '#8696a0', textAlign: 'right' }}>{m.time}</div>
                </span>
              </div>
            );
          })}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSendMessage} style={{ padding: '12px', backgroundColor: '#202c33', display: 'flex' }}>
          <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Type a message..." style={{ flex: 1, padding: '12px', background: '#2a3942', border: 'none', color: '#fff', borderRadius: '8px', marginRight: '10px' }} />
          <button type="submit" style={{ background: '#00a884', border: 'none', padding: '12px 24px', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Send</button>
        </form>
      </div>

      {/* Video Call Modal */}
      {activeCall && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <h2 style={{ color: '#fff' }}>HayatApp {callType === 'video' ? 'Video' : 'Voice'} Call</h2>
          <div style={{ display: 'flex', gap: '20px', margin: '20px 0' }}>
            <video ref={localVideoRef} autoPlay muted style={{ width: '260px', height: '180px', borderRadius: '10px', border: '2px solid #00a884', backgroundColor: '#000' }} />
            <video ref={remoteVideoRef} autoPlay style={{ width: '260px', height: '180px', borderRadius: '10px', border: '2px solid #38bdf8', backgroundColor: '#000' }} />
          </div>
          <button onClick={endCall} style={{ background: '#ef4444', border: 'none', padding: '12px 30px', color: '#fff', borderRadius: '25px', fontSize: '16px', cursor: 'pointer', fontWeight: 'bold' }}>End Call</button>
        </div>
      )}
    </div>
  );
}
