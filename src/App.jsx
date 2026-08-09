import React, { useState, useEffect, useRef } from "react";
import { socket, BACKEND_URL } from "./config";

export default function App() {
  const [userId] = useState("User_" + Math.floor(Math.random() * 1000));
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [activeCall, setActiveCall] = useState(false);
  const [callType, setCallType] = useState(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);

  useEffect(() => {
    socket.auth = { userId };
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
  }, []);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const msgData = { 
      sender: userId, 
      text: inputText, 
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    };

    socket.emit("send_message", msgData);
    setMessages((prev) => [...prev, msgData]);
    setInputText("");
  };

  const startCall = async (type) => {
    setCallType(type);
    setActiveCall(true);

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });
    peerConnectionRef.current = pc;

    const stream = await navigator.mediaDevices.getUserMedia({
      video: type === "video",
      audio: true
    });
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

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

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit("webrtc_signal", { type: "answer", answer });
  };

  const endCall = () => {
    peerConnectionRef.current?.close();
    setActiveCall(false);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0b141a', color: '#e9edef', fontFamily: 'sans-serif' }}>
      {/* Sidebar */}
      <div style={{ width: '280px', borderRight: '1px solid #222d34', padding: '15px' }}>
        <h2 style={{ color: '#00a884', margin: '0 0 10px 0' }}>HayatApp</h2>
        <p>Status: <span style={{ color: connected ? '#00a884' : '#ef4444', fontWeight: 'bold' }}>{connected ? "Connected to Render" : "Connecting..."}</span></p>
        <p style={{ fontSize: '12px', color: '#8696a0' }}>My ID: {userId}</p>
      </div>

      {/* Main Chat Box */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '15px', backgroundColor: '#202c33', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 'bold' }}>HayatApp Chat Room</span>
          <div>
            <button onClick={() => startCall('voice')} style={{ marginRight: '10px', background: '#00a884', border: 'none', padding: '8px 14px', color: '#fff', borderRadius: '5px', cursor: 'pointer' }}>📞 Voice Call</button>
            <button onClick={() => startCall('video')} style={{ background: '#00a884', border: 'none', padding: '8px 14px', color: '#fff', borderRadius: '5px', cursor: 'pointer' }}>📹 Video Call</button>
          </div>
        </div>

        {/* Message Container */}
        <div style={{ flex: 1, padding: '20px', overflowY: 'auto', background: '#0b141a' }}>
          {messages.map((m, idx) => (
            <div key={idx} style={{ textAlign: m.sender === userId ? 'right' : 'left', margin: '8px 0' }}>
              <span style={{ display: 'inline-block', background: m.sender === userId ? '#005c4b' : '#202c33', padding: '8px 14px', borderRadius: '8px', maxWidth: '60%' }}>
                <div style={{ fontSize: '10px', color: '#8696a0' }}>{m.sender}</div>
                <div>{m.text}</div>
                <div style={{ fontSize: '9px', color: '#8696a0', textAlign: 'right' }}>{m.time}</div>
              </span>
            </div>
          ))}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} style={{ padding: '10px', backgroundColor: '#202c33', display: 'flex' }}>
          <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Type a message..." style={{ flex: 1, padding: '12px', background: '#2a3942', border: 'none', color: '#fff', borderRadius: '8px', marginRight: '10px' }} />
          <button type="submit" style={{ background: '#00a884', border: 'none', padding: '12px 20px', color: '#fff', borderRadius: '8px', cursor: 'pointer' }}>Send</button>
        </form>
      </div>

      {/* Calling Screen Overlay */}
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
