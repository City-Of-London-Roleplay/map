import { useEffect, useState, useRef, useCallback } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const MAP_SIZE = 3121;
const MAP_IMAGE_SIZE = 3121;

const MAP_STYLES = {
  normal: "https://map.col-erlc.ca/normal.png",
  "normal-locations": "https://map.col-erlc.ca/normal-locations.png",
  winter: "https://map.col-erlc.ca/winter.png",
  "winter-locations": "https://map.col-erlc.ca/winter-locations.png",
};

// Area of Play zones — single active zone per session
const AOP_ZONES = [
  { id: "downtown",    label: "Downtown Core",      color: "#3b82f6" },
  { id: "northside",  label: "Northside District",  color: "#22c55e" },
  { id: "eastend",    label: "East End",            color: "#f59e0b" },
  { id: "westshore",  label: "West Shore",          color: "#a78bfa" },
  { id: "industrial", label: "Industrial Zone",     color: "#ef4444" },
  { id: "suburbs",    label: "Suburbs",             color: "#06b6d4" },
  { id: "full",       label: "Full Map",            color: "#ffffff" },
];

// Jurisdiction maps
const JURISDICTION_MAPS = [
  { id: "pd",         label: "Police Dept (PD)",    color: "#3b82f6",  icon: "🚔" },
  { id: "sheriff",    label: "Sheriff / County",    color: "#16a34a",  icon: "⭐" },
  { id: "fire",       label: "Fire Dept (FD)",      color: "#ef4444",  icon: "🚒", placeholder: true },
  { id: "ems",        label: "EMS / Medical",       color: "#22c55e",  icon: "🚑", placeholder: true },
  { id: "dot",        label: "DOT / Traffic",       color: "#f59e0b",  icon: "🚧", placeholder: true },
  { id: "swat",       label: "SWAT / Tactical",     color: "#7c3aed",  icon: "🛡️", placeholder: true },
];

const TEAM_COLORS = {
  police:  { dot: "#3b82f6", bg: "rgba(59,130,246,0.15)",  text: "#93c5fd" },
  sheriff: { dot: "#16a34a", bg: "rgba(22,163,74,0.15)",   text: "#86efac" },
  fire:    { dot: "#ef4444", bg: "rgba(239,68,68,0.15)",   text: "#fca5a5" },
  dot:     { dot: "#f59e0b", bg: "rgba(245,158,11,0.15)",  text: "#fcd34d" },
  jail:    { dot: "#7c3aed", bg: "rgba(124,58,237,0.15)",  text: "#c4b5fd" },
  default: { dot: "#6b7280", bg: "rgba(107,114,128,0.15)", text: "#9ca3af" },
};

const getTeamStyle = (team) =>
  TEAM_COLORS[team?.toLowerCase()] || TEAM_COLORS.default;

const worldToMap = (x, z) => ({
  x: (x / MAP_SIZE) * MAP_IMAGE_SIZE,
  y: (z / MAP_SIZE) * MAP_IMAGE_SIZE,
});

// ─── FALLBACK AVATAR ─────────────────────────────────────────────────────────
const FALLBACK_AVATAR =
  "https://cdn.col-erlc.ca/images/69221fda-64a4-4169-91fd-295506c6712a.png";

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function Home() {
  const router = useRouter();

  // Data state
  const [serverInfo,   setServerInfo]   = useState(null);
  const [players,      setPlayers]      = useState({});
  const [queue,        setQueue]        = useState([]);
  const [vehicles,     setVehicles]     = useState([]);
  const [markers,      setMarkers]      = useState({});
  const [avatarUrls,   setAvatarUrls]   = useState({});
  const [avatarsLoaded,setAvatarsLoaded]= useState(false);
  const [isLoading,    setIsLoading]    = useState(true);

  // UI state
  const [selectedPlayer,  setSelectedPlayer]  = useState(null);
  const [hoveredPlayer,   setHoveredPlayer]   = useState(null);
  const [isMobileMenuOpen,setIsMobileMenuOpen]= useState(false);
  const [urlProcessed,    setUrlProcessed]    = useState(false);

  // Map display
  const [mapStyle,     setMapStyle]     = useState("normal-locations");
  const [nameDisplay,  setNameDisplay]  = useState("hover");

  // Bottom-left panel state
  const [layersPanelOpen,  setLayersPanelOpen]  = useState(false);
  const [layersTab,        setLayersTab]         = useState("style"); // "style" | "aop" | "jurisdiction"
  const [activeAOP,        setActiveAOP]         = useState(null);
  const [activeJurisdiction,setActiveJurisdiction]=useState(null);

  // Map transform
  const mapRef       = useRef(null);
  const containerRef = useRef(null);
  const isDragging   = useRef(false);
  const dragStart    = useRef({ x: 0, y: 0 });
  const dragOffset   = useRef({ x: 0, y: 0 });
  const [transform,  setTransform] = useState({ scale: 0.3, x: 0, y: 0 });

  // ── Avatar helpers ────────────────────────────────────────────────────────
  const fetchPlayerAvatar = async (player) => {
    try {
      const res = await fetch(`/api/roblox/user?userId=${player.Player.split(":")[1]}`);
      return await res.json();
    } catch {
      return FALLBACK_AVATAR;
    }
  };

  useEffect(() => {
    const load = async () => {
      if (!players || Object.keys(players).length === 0 || avatarsLoaded) return;
      const urls = {};
      await Promise.all(
        Object.values(players).flatMap((team) =>
          team.map((player) =>
            fetch(`/api/roblox/user?userId=${player.Player.split(":")[1]}`)
              .then((r) => r.json())
              .then((url) => { urls[player.Player] = url; })
              .catch(() => { urls[player.Player] = FALLBACK_AVATAR; })
          )
        )
      );
      setAvatarUrls(urls);
      setAvatarsLoaded(true);
    };
    load();
  }, [players, avatarsLoaded]);

  useEffect(() => {
    const load = async () => {
      const urls = {};
      for (const marker of Object.values(markers)) {
        try { urls[marker.player.Player] = await fetchPlayerAvatar(marker.player); }
        catch { /* skip */ }
      }
      setAvatarUrls(urls);
    };
    if (Object.keys(markers).length > 0) load();
  }, [markers]);

  // ── Center map ────────────────────────────────────────────────────────────
  const centerMap = useCallback(() => {
    if (!containerRef.current) return;
    const c = containerRef.current.getBoundingClientRect();
    setTransform({
      scale: 0.3,
      x: (c.width  - MAP_IMAGE_SIZE * 0.3) / 2,
      y: (c.height - MAP_IMAGE_SIZE * 0.3) / 2,
    });
  }, []);

  useEffect(() => {
    if (mapRef.current?.complete) centerMap();
  }, [mapStyle, centerMap]);

  // ── Focus on player ───────────────────────────────────────────────────────
  const focusOnPlayer = useCallback((playerKey) => {
    const marker = markers[playerKey];
    if (!marker || !containerRef.current) return;
    const c = containerRef.current.getBoundingClientRect();
    setTransform({ scale: 2, x: c.width / 2 - marker.x * 2, y: c.height / 2 - marker.y * 2 });
  }, [markers]);

  // ── URL params ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (urlProcessed || !Object.keys(players).length || !router.isReady) return;
    const { user } = router.query;
    if (user) {
      const uLow = user.toLowerCase();
      let found = null;
      Object.values(players).forEach((team) =>
        team.forEach((p) => {
          const name = p.Player.split(":")[0].toLowerCase();
          if (name.includes(uLow) || p.Player.split(":")[1] === user) found = p;
        })
      );
      if (found) { setSelectedPlayer(found); setTimeout(() => focusOnPlayer(found.Player), 500); }
    }
    setUrlProcessed(true);
  }, [players, router.isReady, router.query, urlProcessed, focusOnPlayer]);

  useEffect(() => {
    if (!router.isReady) return;
    const url = new URL(window.location.href);
    if (selectedPlayer) url.searchParams.set("user", selectedPlayer.Player.split(":")[0]);
    else url.searchParams.delete("user");
    window.history.pushState({}, "", url.toString());
  }, [selectedPlayer, router.isReady]);

  // ── Fetch data ────────────────────────────────────────────────────────────
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [serverRes, playersRes, queueRes, vehiclesRes] = await Promise.all([
        fetch("/api/server").then((r) => r.json()),
        fetch("/api/players").then((r) => r.json()),
        fetch("/api/queue").then((r) => r.json()),
        fetch("/api/vehicles").then((r) => r.json()),
      ]);
      setServerInfo(serverRes);
      setPlayers(playersRes);
      setQueue(queueRes);
      setVehicles(vehiclesRes);

      const newMarkers = {};
      Object.entries(playersRes).forEach(([team, members]) =>
        members.forEach((p) => {
          if (p.Location) {
            const { x, y } = worldToMap(p.Location.LocationX, p.Location.LocationZ);
            newMarkers[p.Player] = { x, y, player: p, team, id: p.Player };
          }
        })
      );
      setMarkers(newMarkers);
      setIsLoading(false);
    } catch (err) {
      console.error("Fetch failed", err);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // ── Map interaction ───────────────────────────────────────────────────────
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    isDragging.current = true;
    dragStart.current  = { x: e.clientX, y: e.clientY };
    dragOffset.current = { x: transform.x, y: transform.y };
  };
  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    e.preventDefault();
    setTransform((prev) => ({
      ...prev,
      x: dragOffset.current.x + e.clientX - dragStart.current.x,
      y: dragOffset.current.y + e.clientY - dragStart.current.y,
    }));
  };
  const handleMouseUp = () => { isDragging.current = false; };

  const handleWheel = (e) => {
    e.preventDefault();
    const rect   = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const mapX   = (mouseX - transform.x) / transform.scale;
    const mapY   = (mouseY - transform.y) / transform.scale;
    const delta  = e.deltaY > 0 ? 0.95 : 1.05;
    const ns     = Math.min(Math.max(0.1, transform.scale * delta), 3);
    setTransform({ scale: ns, x: mouseX - mapX * ns, y: mouseY - mapY * ns });
  };

  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    isDragging.current = true;
    dragStart.current  = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    dragOffset.current = { x: transform.x, y: transform.y };
  };
  const handleTouchMove = (e) => {
    if (!isDragging.current || e.touches.length !== 1) return;
    e.preventDefault();
    setTransform((prev) => ({
      ...prev,
      x: dragOffset.current.x + e.touches[0].clientX - dragStart.current.x,
      y: dragOffset.current.y + e.touches[0].clientY - dragStart.current.y,
    }));
  };
  const handleTouchEnd = () => { isDragging.current = false; };

  // ── Player helpers ────────────────────────────────────────────────────────
  const togglePlayerPopup = (player) => {
    if (selectedPlayer?.Player === player.Player) { setSelectedPlayer(null); return; }
    setSelectedPlayer(player);
    focusOnPlayer(player.Player);
  };

  const PlayerAvatar = ({ player, size = 20 }) => (
    <img
      src={avatarUrls[player.Player] || FALLBACK_AVATAR}
      alt={player.Player.split(":")[0]}
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: "1px solid rgba(255,255,255,0.15)", flexShrink: 0 }}
      onError={(e) => { e.target.src = FALLBACK_AVATAR; }}
    />
  );

  // ── Map style derived values ──────────────────────────────────────────────
  const isWinter     = mapStyle.includes("winter");
  const showLocations= mapStyle.includes("locations");

  const updateMapStyle = (winter, locations) =>
    setMapStyle(`${winter ? "winter" : "normal"}${locations ? "-locations" : ""}`);

  // ── Meta helpers ──────────────────────────────────────────────────────────
  const getMetaTitle = () => {
    const { user } = router.query;
    return user ? `City of London — Tracking ${user}` : "City of London ERLC Live Map";
  };

  const totalPlayers = Object.values(players).reduce((s, t) => s + t.length, 0);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <Head>
        <title>{getMetaTitle()}</title>
        <meta name="description" content="Live map tracking for City of London ERLC server" />
        <link rel="icon" type="image/x-icon" href={FALLBACK_AVATAR} />
        <meta name="theme-color" content="#3B82F6" />
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
          *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
          :root{
            --bg:#0d0e11;--surface:rgba(18,20,26,0.92);--surface2:rgba(25,28,35,0.95);
            --border:rgba(255,255,255,0.08);--border-h:rgba(255,255,255,0.15);
            --accent:#3b82f6;--accent2:#60a5fa;
            --text:#f0f2f6;--muted:#7b8499;--dim:#3d4259;
            --green:#22c55e;--amber:#f59e0b;--red:#ef4444;
            --r:10px;--rs:6px;--font-h:'Syne',sans-serif;--font-b:'DM Sans',sans-serif;
            --shadow:0 8px 32px rgba(0,0,0,0.6);
          }
          body{font-family:var(--font-b);background:var(--bg);color:var(--text);overflow:hidden}
          ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:4px}
          @keyframes spin{to{transform:rotate(360deg)}}
          @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
          @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        `}</style>
      </Head>

      <div style={{ display:"flex", height:"100vh", overflow:"hidden", background:"var(--bg)" }}>

        {/* ── MOBILE OVERLAY ─────────────────────────────────────────────── */}
        {isMobileMenuOpen && (
          <div
            style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:40 }}
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* ── MOBILE DRAWER ──────────────────────────────────────────────── */}
        <div style={{
          position:"fixed",top:0,left:0,height:"100%",width:320,zIndex:50,
          transform: isMobileMenuOpen ? "translateX(0)" : "translateX(-100%)",
          transition:"transform 0.3s ease",
          background:"rgba(13,14,17,0.97)",backdropFilter:"blur(20px)",
          borderRight:"1px solid var(--border)",overflowY:"auto",
        }} className="md-hidden-drawer">
          <div style={{ padding:"20px 16px" }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20 }}>
              <LogoBlock />
              <button onClick={() => setIsMobileMenuOpen(false)} style={iconBtnStyle}>
                <CloseIcon />
              </button>
            </div>
            <SidebarContent {...{ serverInfo, players, queue, vehicles, selectedPlayer, togglePlayerPopup, hoveredPlayer, setHoveredPlayer, setSelectedPlayer, nameDisplay, avatarUrls, PlayerAvatar }} />
          </div>
        </div>

        {/* ── DESKTOP SIDEBAR ────────────────────────────────────────────── */}
        <div style={{
          display:"none",position:"fixed",top:16,left:16,width:320,zIndex:40,
          maxHeight:"calc(100vh - 32px)",borderRadius:14,
          background:"rgba(13,14,17,0.92)",backdropFilter:"blur(20px)",
          border:"1px solid var(--border)",boxShadow:"var(--shadow)",
          overflowY:"auto",
        }} className="desktop-sidebar">
          <div style={{ padding:"20px 16px" }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20 }}>
              <LogoBlock isLoading={isLoading} />
            </div>
            <SidebarContent {...{ serverInfo, players, queue, vehicles, selectedPlayer, togglePlayerPopup, hoveredPlayer, setHoveredPlayer, setSelectedPlayer, nameDisplay, avatarUrls, PlayerAvatar }} />
          </div>
        </div>

        {/* ── MAP AREA ───────────────────────────────────────────────────── */}
        <div
          ref={containerRef}
          style={{ flex:1, position:"relative", overflow:"hidden", background:"#0a0b0e", cursor:"grab" }}
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}     onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
          onClick={(e) => {
            if (e.target === containerRef.current || e.target === mapRef.current?.parentElement) {
              setSelectedPlayer(null); setHoveredPlayer(null);
              const url = new URL(window.location.href);
              url.searchParams.delete("user");
              window.history.pushState({}, "", url.toString());
            }
          }}
        >

          {/* Mobile top bar */}
          <div style={{
            position:"absolute",top:0,left:0,right:0,zIndex:20,
            background:"rgba(13,14,17,0.95)",backdropFilter:"blur(16px)",
            borderBottom:"1px solid var(--border)",padding:"10px 12px",
            display:"flex",alignItems:"center",gap:8,
          }} className="mobile-topbar">
            <button onClick={() => setIsMobileMenuOpen(true)} style={iconBtnStyle}>
              <MenuIcon />
            </button>
            <span style={{ fontFamily:"var(--font-h)",fontSize:15,fontWeight:700,flex:1,textAlign:"center" }}>City Of London</span>
            <PlayerCountBadge serverInfo={serverInfo} />
            <button onClick={centerMap} style={iconBtnStyle} title="Reset view"><HomeIcon /></button>
          </div>

          {/* Top-right controls (desktop) */}
          <div style={{ position:"absolute",top:16,right:16,zIndex:20,display:"flex",gap:8,alignItems:"center" }} className="desktop-top-controls">
            <PlayerCountBadge serverInfo={serverInfo} />
            <div style={{ ...pillStyle, fontFamily:"monospace",fontSize:12 }}>{Math.round(transform.scale * 100)}%</div>
            <button onClick={centerMap} style={iconBtnStyle} title="Reset view"><HomeIcon /></button>
            {isLoading && (
              <div style={{ width:20,height:20,border:"2px solid var(--accent)",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite" }} />
            )}
          </div>

          {/* Map image */}
          <div style={{
            transform:`translate(${transform.x}px,${transform.y}px) scale(${transform.scale})`,
            transformOrigin:"0 0",position:"absolute",top:0,left:0,
            width:MAP_IMAGE_SIZE,height:MAP_IMAGE_SIZE,
          }}>
            <img
              ref={mapRef}
              src={MAP_STYLES[mapStyle]}
              alt="Map"
              draggable={false}
              style={{ width:MAP_IMAGE_SIZE,height:MAP_IMAGE_SIZE,display:"block",userSelect:"none",pointerEvents:"none" }}
              onLoad={centerMap}
              onError={(e) => { e.target.src = MAP_STYLES["normal-locations"]; }}
            />
          </div>

          {/* Player markers */}
          <div style={{ position:"absolute",top:0,left:0,width:"100%",height:"100%",pointerEvents:"none" }}>
            {Object.values(markers).map((m) => {
              const sx = m.x * transform.scale + transform.x;
              const sy = m.y * transform.scale + transform.y;
              const isSelected = selectedPlayer?.Player === m.player.Player;
              const isHovered  = hoveredPlayer?.Player  === m.player.Player;
              const ts = getTeamStyle(m.team);
              return (
                <div
                  key={m.player.Player}
                  style={{
                    position:"absolute",left:sx,top:sy,
                    transform:"translate(-50%,-50%)",
                    zIndex: isSelected ? 30 : 10,
                    pointerEvents:"auto",cursor:"pointer",
                    display:"flex",flexDirection:"column",alignItems:"center",
                  }}
                  onClick={(e) => { e.stopPropagation(); togglePlayerPopup(m.player); }}
                  onMouseEnter={() => { if (nameDisplay === "hover") setHoveredPlayer(m.player); }}
                  onMouseLeave={() => { if (nameDisplay === "hover") setHoveredPlayer(null); }}
                >
                  {(nameDisplay === "always" || isSelected || isHovered) && (
                    <div style={{
                      position:"absolute",bottom:"calc(100% + 6px)",left:"50%",
                      transform:"translateX(-50%)",whiteSpace:"nowrap",
                      pointerEvents:"none",zIndex:40,
                      background:"rgba(13,14,17,0.95)",backdropFilter:"blur(8px)",
                      border:"1px solid var(--border)",borderRadius:6,
                      padding:"3px 8px",fontSize:11,color:"var(--text)",
                      boxShadow:"0 4px 12px rgba(0,0,0,0.4)",
                    }}>
                      {m.player.Player.split(":")[0]}
                      {m.player?.Callsign && <span style={{ color:"var(--muted)",marginLeft:4 }}>({m.player.Callsign})</span>}
                    </div>
                  )}
                  <div style={{
                    width:26,height:26,borderRadius:"50%",overflow:"hidden",
                    border:`2px solid ${isSelected ? ts.dot : "rgba(255,255,255,0.2)"}`,
                    boxShadow: isSelected ? `0 0 0 3px ${ts.dot}40,0 4px 12px rgba(0,0,0,0.5)` : "0 2px 8px rgba(0,0,0,0.4)",
                    transition:"all 0.15s ease",
                  }}>
                    <img
                      src={avatarUrls[m.player.Player] || FALLBACK_AVATAR}
                      alt=""
                      style={{ width:"100%",height:"100%",objectFit:"cover" }}
                      onError={(e) => { e.target.src = FALLBACK_AVATAR; }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Player popup (bottom-right) */}
          {selectedPlayer && (
            <div style={{
              position:"absolute",bottom:80,right:16,zIndex:50,
              width:296,borderRadius:14,
              background:"rgba(18,20,26,0.97)",backdropFilter:"blur(20px)",
              border:"1px solid var(--border)",boxShadow:"var(--shadow)",
              animation:"fadeUp 0.2s ease",
            }}>
              <div style={{ padding:"16px 16px 0" }}>
                <div style={{ display:"flex",alignItems:"flex-start",gap:12,marginBottom:14 }}>
                  <img
                    src={avatarUrls[selectedPlayer.Player] || FALLBACK_AVATAR}
                    alt=""
                    style={{ width:48,height:48,borderRadius:10,objectFit:"cover",border:"1px solid var(--border)" }}
                    onError={(e) => { e.target.src = FALLBACK_AVATAR; }}
                  />
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontFamily:"var(--font-h)",fontWeight:700,fontSize:15,marginBottom:2,color:"var(--text)" }}>
                      {selectedPlayer.Player.split(":")[0]}
                    </div>
                    <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                      <div style={{ width:6,height:6,borderRadius:"50%",background:getTeamStyle(selectedPlayer.Team).dot,flexShrink:0 }} />
                      <span style={{ fontSize:11,color:"var(--muted)" }}>
                        {selectedPlayer.Team}
                        {selectedPlayer.Callsign && <span style={{ marginLeft:4,color:"var(--dim)" }}>• {selectedPlayer.Callsign}</span>}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setSelectedPlayer(null)} style={{ ...iconBtnStyle,width:28,height:28 }}><CloseIcon size={14} /></button>
                </div>

                {selectedPlayer.Location && (
                  <div style={{ borderTop:"1px solid var(--border)",paddingTop:12,marginBottom:12 }}>
                    <div style={{ fontSize:11,color:"var(--muted)",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em" }}>Location</div>
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8 }}>
                      {[["X", selectedPlayer.Location.LocationX], ["Z", selectedPlayer.Location.LocationZ]].map(([ax, val]) => (
                        <div key={ax} style={{ background:"rgba(255,255,255,0.04)",borderRadius:6,padding:"6px 10px",textAlign:"center" }}>
                          <div style={{ fontSize:10,color:"var(--muted)",marginBottom:2 }}>{ax}</div>
                          <div style={{ fontFamily:"monospace",fontSize:13 }}>{Math.round(val)}</div>
                        </div>
                      ))}
                    </div>
                    {selectedPlayer.Location.StreetName && (
                      <div style={{ fontSize:11,color:"var(--muted)",textAlign:"center" }}>
                        {selectedPlayer.Location.BuildingNumber && `${selectedPlayer.Location.BuildingNumber} `}
                        {selectedPlayer.Location.StreetName}
                        {selectedPlayer.Location.PostalCode && <span style={{ marginLeft:6,color:"var(--dim)" }}>{selectedPlayer.Location.PostalCode}</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div style={{ padding:"0 16px 16px" }}>
                <button
                  onClick={() => setSelectedPlayer(null)}
                  style={{ width:"100%",padding:"8px",borderRadius:8,background:"rgba(255,255,255,0.06)",border:"1px solid var(--border)",color:"var(--muted)",fontSize:12,cursor:"pointer",fontFamily:"var(--font-b)",transition:"background 0.15s" }}
                  onMouseEnter={(e) => e.target.style.background="rgba(255,255,255,0.1)"}
                  onMouseLeave={(e) => e.target.style.background="rgba(255,255,255,0.06)"}
                >Close</button>
              </div>
            </div>
          )}

          {/* ── BOTTOM-LEFT: Google Maps-style controls ─────────────────── */}
          <div style={{ position:"absolute",bottom:16,left:16,zIndex:30,display:"flex",flexDirection:"column",gap:8,alignItems:"flex-start" }}>

            {/* Expanded panel */}
            {layersPanelOpen && (
              <div style={{
                width:300,borderRadius:14,
                background:"rgba(13,14,17,0.97)",backdropFilter:"blur(20px)",
                border:"1px solid var(--border)",boxShadow:"var(--shadow)",
                overflow:"hidden",animation:"fadeUp 0.18s ease",
              }}>
                {/* Tab bar */}
                <div style={{ display:"flex",borderBottom:"1px solid var(--border)" }}>
                  {[
                    { id:"style",       label:"Map Style"   },
                    { id:"aop",         label:"Area of Play"},
                    { id:"jurisdiction",label:"Jurisdiction"},
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setLayersTab(tab.id)}
                      style={{
                        flex:1,padding:"10px 0",fontSize:11,fontWeight:600,
                        fontFamily:"var(--font-h)",cursor:"pointer",border:"none",
                        background:"none",color: layersTab === tab.id ? "var(--accent2)" : "var(--muted)",
                        position:"relative",transition:"color 0.15s",
                      }}
                    >
                      {tab.label}
                      {layersTab === tab.id && (
                        <div style={{ position:"absolute",bottom:0,left:"20%",right:"20%",height:2,background:"var(--accent)",borderRadius:"2px 2px 0 0" }} />
                      )}
                    </button>
                  ))}
                </div>

                {/* ── Map Style Tab ── */}
                {layersTab === "style" && (
                  <div style={{ padding:14 }}>
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14 }}>
                      {[
                        { key:"normal",  label:"Default",     preview:"#1a2332" },
                        { key:"winter",  label:"Winter",      preview:"#1e2d3d" },
                      ].map(({ key, label, preview }) => (
                        <div
                          key={key}
                          onClick={() => updateMapStyle(key === "winter", showLocations)}
                          style={{
                            borderRadius:8,overflow:"hidden",cursor:"pointer",
                            border: `2px solid ${isWinter === (key === "winter") ? "var(--accent)" : "transparent"}`,
                            transition:"border-color 0.15s",
                          }}
                        >
                          <div style={{ background:preview,height:56,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24 }}>
                            {key === "winter" ? "❄️" : "🗺️"}
                          </div>
                          <div style={{ padding:"5px 8px",background:"rgba(255,255,255,0.04)",fontSize:11,fontFamily:"var(--font-h)",fontWeight:600 }}>
                            {label}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Toggles */}
                    <ToggleRow
                      label="Street Names & Postcodes"
                      desc="Show location labels on the map"
                      value={showLocations}
                      onChange={(v) => updateMapStyle(isWinter, v)}
                    />
                    <ToggleRow
                      label="Always Show Player Names"
                      desc="Show names without hovering"
                      value={nameDisplay === "always"}
                      onChange={(v) => setNameDisplay(v ? "always" : "hover")}
                    />
                  </div>
                )}

                {/* ── Area of Play Tab ── */}
                {layersTab === "aop" && (
                  <div style={{ padding:14 }}>
                    <div style={{ fontSize:11,color:"var(--muted)",marginBottom:10,lineHeight:1.6 }}>
                      Select the active Area of Play for this session. Only one zone is active at a time.
                    </div>
                    <div style={{ display:"flex",flexDirection:"column",gap:4 }}>
                      {AOP_ZONES.map((zone) => {
                        const isActive = activeAOP === zone.id;
                        return (
                          <button
                            key={zone.id}
                            onClick={() => setActiveAOP(isActive ? null : zone.id)}
                            style={{
                              display:"flex",alignItems:"center",gap:10,
                              padding:"9px 10px",borderRadius:8,border:"none",cursor:"pointer",
                              background: isActive ? `${zone.color}18` : "rgba(255,255,255,0.03)",
                              outline: isActive ? `1.5px solid ${zone.color}60` : "1.5px solid transparent",
                              transition:"all 0.15s",textAlign:"left",
                            }}
                            onMouseEnter={(e) => { if(!isActive) e.currentTarget.style.background="rgba(255,255,255,0.06)"; }}
                            onMouseLeave={(e) => { if(!isActive) e.currentTarget.style.background="rgba(255,255,255,0.03)"; }}
                          >
                            <div style={{ width:10,height:10,borderRadius:3,background:zone.color,flexShrink:0 }} />
                            <span style={{ flex:1,fontSize:12,color: isActive ? "var(--text)" : "var(--muted)",fontFamily:"var(--font-b)" }}>
                              {zone.label}
                            </span>
                            {isActive && (
                              <span style={{ fontSize:10,color:zone.color,fontWeight:600,fontFamily:"var(--font-h)" }}>ACTIVE</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {activeAOP && (
                      <button
                        onClick={() => setActiveAOP(null)}
                        style={{ marginTop:10,width:"100%",padding:"7px",borderRadius:8,background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)",color:"#fca5a5",fontSize:11,cursor:"pointer",fontFamily:"var(--font-b)" }}
                      >Clear AOP</button>
                    )}
                  </div>
                )}

                {/* ── Jurisdiction Tab ── */}
                {layersTab === "jurisdiction" && (
                  <div style={{ padding:14 }}>
                    <div style={{ fontSize:11,color:"var(--muted)",marginBottom:10,lineHeight:1.6 }}>
                      View jurisdiction boundaries for each department. Select one to highlight.
                    </div>
                    <div style={{ display:"flex",flexDirection:"column",gap:4 }}>
                      {JURISDICTION_MAPS.map((j) => {
                        const isActive = activeJurisdiction === j.id;
                        return (
                          <button
                            key={j.id}
                            onClick={() => !j.placeholder && setActiveJurisdiction(isActive ? null : j.id)}
                            style={{
                              display:"flex",alignItems:"center",gap:10,
                              padding:"9px 10px",borderRadius:8,border:"none",
                              cursor: j.placeholder ? "not-allowed" : "pointer",
                              background: isActive ? `${j.color}18` : "rgba(255,255,255,0.03)",
                              outline: isActive ? `1.5px solid ${j.color}60` : "1.5px solid transparent",
                              opacity: j.placeholder ? 0.45 : 1,
                              transition:"all 0.15s",textAlign:"left",
                            }}
                          >
                            <span style={{ fontSize:14 }}>{j.icon}</span>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:12,color: isActive ? "var(--text)" : "var(--muted)",fontFamily:"var(--font-b)" }}>{j.label}</div>
                              {j.placeholder && <div style={{ fontSize:10,color:"var(--dim)" }}>Coming soon</div>}
                            </div>
                            {isActive && <span style={{ fontSize:10,color:j.color,fontWeight:600,fontFamily:"var(--font-h)" }}>ON</span>}
                            <div style={{ width:8,height:8,borderRadius:2,background:j.color,flexShrink:0,opacity:j.placeholder?0.4:1 }} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Toggle button */}
            <button
              onClick={() => setLayersPanelOpen(!layersPanelOpen)}
              style={{
                display:"flex",alignItems:"center",gap:8,
                padding:"9px 14px",borderRadius:10,cursor:"pointer",
                background:"rgba(13,14,17,0.97)",backdropFilter:"blur(16px)",
                border:`1px solid ${layersPanelOpen ? "var(--accent)" : "var(--border)"}`,
                boxShadow:"var(--shadow)",color:"var(--text)",
                fontFamily:"var(--font-h)",fontSize:12,fontWeight:600,
                transition:"border-color 0.15s",
              }}
            >
              <LayersIcon />
              Map Options
              {(activeAOP || activeJurisdiction) && (
                <div style={{ width:6,height:6,borderRadius:"50%",background:"var(--accent)",marginLeft:2 }} />
              )}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginLeft:"auto",transform: layersPanelOpen ? "rotate(180deg)" : "",transition:"transform 0.18s" }}>
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {/* AOP active label overlay */}
          {activeAOP && (() => {
            const zone = AOP_ZONES.find((z) => z.id === activeAOP);
            return (
              <div style={{
                position:"absolute",bottom:60,left:"50%",transform:"translateX(-50%)",
                zIndex:20,pointerEvents:"none",
                display:"flex",alignItems:"center",gap:8,
                padding:"6px 14px",borderRadius:20,
                background:"rgba(13,14,17,0.92)",backdropFilter:"blur(12px)",
                border:`1px solid ${zone.color}50`,boxShadow:"var(--shadow)",
              }}>
                <div style={{ width:8,height:8,borderRadius:"50%",background:zone.color,animation:"pulse 1.5s infinite" }} />
                <span style={{ fontSize:11,fontFamily:"var(--font-h)",fontWeight:700,color:zone.color }}>AOP: {zone.label}</span>
              </div>
            );
          })()}

          {/* Jurisdiction active label */}
          {activeJurisdiction && (() => {
            const j = JURISDICTION_MAPS.find((x) => x.id === activeJurisdiction);
            return (
              <div style={{
                position:"absolute",bottom: activeAOP ? 98 : 60,left:"50%",transform:"translateX(-50%)",
                zIndex:20,pointerEvents:"none",
                display:"flex",alignItems:"center",gap:8,
                padding:"6px 14px",borderRadius:20,
                background:"rgba(13,14,17,0.92)",backdropFilter:"blur(12px)",
                border:`1px solid ${j.color}50`,boxShadow:"var(--shadow)",
              }}>
                <span style={{ fontSize:12 }}>{j.icon}</span>
                <span style={{ fontSize:11,fontFamily:"var(--font-h)",fontWeight:700,color:j.color }}>{j.label} Jurisdiction</span>
              </div>
            );
          })()}

          {/* Bottom-right: status */}
          <div style={{ position:"absolute",bottom:16,right:16,zIndex:20,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6 }}>
            <div style={{ ...pillStyle,gap:6 }}>
              <div style={{ width:6,height:6,borderRadius:"50%",background:"var(--green)",boxShadow:"0 0 6px var(--green)",animation:"pulse 2s infinite" }} />
              <span style={{ fontSize:11,color:"var(--muted)" }}>Live</span>
            </div>
            <div style={{ ...pillStyle,fontFamily:"monospace",fontSize:11 }}>
              {totalPlayers} player{totalPlayers !== 1 ? "s" : ""}
            </div>
          </div>

        </div>{/* /map area */}
      </div>

      {/* ── RESPONSIVE CSS ──────────────────────────────────────────────────── */}
      <style>{`
        .desktop-sidebar { display: none !important; }
        .desktop-top-controls { display: none !important; }
        .mobile-topbar { display: flex !important; }
        .md-hidden-drawer { display: block !important; }
        @media (min-width: 768px) {
          .desktop-sidebar { display: block !important; }
          .desktop-top-controls { display: flex !important; }
          .mobile-topbar { display: none !important; }
          .md-hidden-drawer { display: none !important; }
        }
      `}</style>
    </>
  );
}

// ─── SHARED STYLE OBJECTS ─────────────────────────────────────────────────────
const pillStyle = {
  display:"flex",alignItems:"center",gap:6,
  padding:"5px 10px",borderRadius:20,
  background:"rgba(13,14,17,0.92)",backdropFilter:"blur(12px)",
  border:"1px solid var(--border)",boxShadow:"var(--shadow)",
};

const iconBtnStyle = {
  width:34,height:34,borderRadius:8,cursor:"pointer",
  background:"rgba(255,255,255,0.05)",border:"1px solid var(--border)",
  color:"var(--text)",display:"flex",alignItems:"center",justifyContent:"center",
  flexShrink:0,transition:"background 0.15s",
};

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────
const LogoBlock = ({ isLoading }) => (
  <div style={{ display:"flex",alignItems:"center",gap:10 }}>
    <div style={{ width:34,height:34,borderRadius:8,background:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--font-h)",fontSize:13,fontWeight:800,color:"#fff",letterSpacing:"-0.5px",flexShrink:0 }}>COL</div>
    <div>
      <div style={{ fontFamily:"var(--font-h)",fontSize:15,fontWeight:700,color:"var(--text)",lineHeight:1.2 }}>City Of London</div>
      <div style={{ fontSize:11,color:"var(--muted)" }}>ERLC Live Map</div>
    </div>
    {isLoading && <div style={{ width:16,height:16,border:"2px solid var(--accent)",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite",marginLeft:4 }} />}
  </div>
);

const PlayerCountBadge = ({ serverInfo }) => {
  const cur = serverInfo?.CurrentPlayers ?? 0;
  const max = serverInfo?.MaxPlayers ?? 0;
  const pct = max ? cur / max : 0;
  const col = pct > 0.85 ? "#ef4444" : pct > 0.6 ? "#f59e0b" : cur === 0 ? "#ef4444" : "#22c55e";
  return (
    <div style={{ ...pillStyle,fontSize:12 }}>
      <span style={{ color:col,fontWeight:600 }}>{cur}</span>
      <span style={{ color:"var(--dim)" }}>/{max}</span>
    </div>
  );
};

const ToggleRow = ({ label, desc, value, onChange }) => (
  <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderTop:"1px solid var(--border)" }}>
    <div>
      <div style={{ fontSize:12,color:"var(--text)",marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:10,color:"var(--dim)" }}>{desc}</div>
    </div>
    <button
      onClick={() => onChange(!value)}
      style={{
        width:38,height:22,borderRadius:11,border:"none",cursor:"pointer",
        background: value ? "var(--accent)" : "rgba(255,255,255,0.1)",
        position:"relative",transition:"background 0.2s",flexShrink:0,
      }}
    >
      <div style={{
        width:16,height:16,borderRadius:"50%",background:"#fff",
        position:"absolute",top:3,left: value ? 19 : 3,
        transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.3)",
      }} />
    </button>
  </div>
);

// ─── SIDEBAR CONTENT ──────────────────────────────────────────────────────────
const SidebarContent = ({ serverInfo, players, queue, vehicles, selectedPlayer, togglePlayerPopup, hoveredPlayer, setHoveredPlayer, setSelectedPlayer, nameDisplay, avatarUrls, PlayerAvatar }) => {
  const total = Object.values(players).reduce((s, t) => s + t.length, 0);
  return (
    <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
      <Dropdown title="Server Status" icon="🖥️">
        <ServerStatus serverInfo={serverInfo} />
      </Dropdown>
      {total > 0 && (
        <Dropdown title={`Players (${total})`} icon="👥" defaultOpen>
          <PlayersContent {...{ players, selectedPlayer, togglePlayerPopup, hoveredPlayer, setHoveredPlayer, setSelectedPlayer, nameDisplay, avatarUrls, PlayerAvatar }} />
        </Dropdown>
      )}
      {queue.length > 0 && (
        <Dropdown title={`Queue (${queue.length})`} icon="⏳">
          <QueueContent queue={queue} />
        </Dropdown>
      )}
      {vehicles.length > 0 && (
        <Dropdown title={`Vehicles (${vehicles.length})`} icon="🚗">
          <VehiclesContent vehicles={vehicles} />
        </Dropdown>
      )}
    </div>
  );
};

const Dropdown = ({ title, icon, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderRadius:10,overflow:"hidden",border:"1px solid var(--border)",background:"rgba(255,255,255,0.02)" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width:"100%",padding:"11px 14px",display:"flex",alignItems:"center",
          justifyContent:"space-between",background:"none",border:"none",cursor:"pointer",
          transition:"background 0.15s",
        }}
        onMouseEnter={(e) => e.currentTarget.style.background="rgba(255,255,255,0.04)"}
        onMouseLeave={(e) => e.currentTarget.style.background="none"}
      >
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <span style={{ fontSize:14 }}>{icon}</span>
          <span style={{ fontSize:13,fontWeight:600,color:"var(--text)",fontFamily:"var(--font-h)" }}>{title}</span>
        </div>
        <svg style={{ width:14,height:14,color:"var(--muted)",transform: open ? "rotate(180deg)" : "",transition:"transform 0.25s",flexShrink:0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div style={{ borderTop:"1px solid var(--border)",padding:14,maxHeight:320,overflowY:"auto" }}>
          {children}
        </div>
      )}
    </div>
  );
};

const ServerStatus = ({ serverInfo }) => (
  <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
    {[
      ["Server", serverInfo?.Name],
      ["Join Key", serverInfo?.JoinKey],
    ].map(([k, v]) => (
      <div key={k} style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
        <span style={{ fontSize:12,color:"var(--muted)" }}>{k}</span>
        <span style={{ fontSize:12,color:"var(--text)",fontWeight:500,fontFamily: k === "Join Key" ? "monospace" : "inherit",background: k === "Join Key" ? "rgba(255,255,255,0.06)" : "none",padding: k === "Join Key" ? "2px 7px" : 0,borderRadius:4 }}>{v || "—"}</span>
      </div>
    ))}
    <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
      <span style={{ fontSize:12,color:"var(--muted)" }}>Capacity</span>
      <div style={{ display:"flex",alignItems:"center",gap:8 }}>
        <div style={{ width:60,height:4,borderRadius:2,background:"rgba(255,255,255,0.08)",overflow:"hidden" }}>
          <div style={{
            height:"100%",borderRadius:2,
            background: (serverInfo?.CurrentPlayers / serverInfo?.MaxPlayers) > 0.8 ? "#ef4444" : "#22c55e",
            width:`${((serverInfo?.CurrentPlayers||0)/(serverInfo?.MaxPlayers||1))*100}%`,
            transition:"width 0.5s",
          }} />
        </div>
        <span style={{ fontSize:12,color:"var(--text)",fontWeight:500 }}>{serverInfo?.CurrentPlayers||0}/{serverInfo?.MaxPlayers||0}</span>
      </div>
    </div>
  </div>
);

const PlayersContent = ({ players, selectedPlayer, togglePlayerPopup, hoveredPlayer, setHoveredPlayer, setSelectedPlayer, nameDisplay, avatarUrls, PlayerAvatar }) => (
  <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
    {Object.entries(players).map(([team, members]) => {
      const ts = getTeamStyle(team);
      return (
        <div key={team}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6 }}>
            <div style={{ display:"flex",alignItems:"center",gap:6 }}>
              <div style={{ width:6,height:6,borderRadius:"50%",background:ts.dot }} />
              <span style={{ fontSize:11,fontWeight:600,color:"var(--muted)",textTransform:"uppercase",letterSpacing:"0.06em" }}>{team}</span>
            </div>
            <span style={{ fontSize:10,color:"var(--dim)",background:"rgba(255,255,255,0.05)",borderRadius:10,padding:"2px 7px" }}>{members.length}</span>
          </div>
          <div style={{ display:"flex",flexDirection:"column",gap:2 }}>
            {members.map((player) => {
              const isSelected = selectedPlayer?.Player === player.Player;
              return (
                <div
                  key={player.Player}
                  onClick={(e) => { e.stopPropagation(); togglePlayerPopup(player); setSelectedPlayer(player); }}
                  onMouseEnter={() => { if (nameDisplay === "hover") setHoveredPlayer(player); }}
                  onMouseLeave={() => { if (nameDisplay === "hover") setHoveredPlayer(null); }}
                  style={{
                    display:"flex",alignItems:"center",gap:10,
                    padding:"7px 10px",borderRadius:8,cursor:"pointer",
                    background: isSelected ? `${ts.dot}20` : "transparent",
                    outline: isSelected ? `1px solid ${ts.dot}40` : "1px solid transparent",
                    transition:"all 0.15s",
                  }}
                  onMouseOver={(e) => { if(!isSelected) e.currentTarget.style.background="rgba(255,255,255,0.04)"; }}
                  onMouseOut={(e) => { if(!isSelected) e.currentTarget.style.background="transparent"; }}
                >
                  <PlayerAvatar player={player} size={22} />
                  <span style={{ flex:1,fontSize:12,color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                    {player.Player.split(":")[0]}
                  </span>
                  {player.Location?.StreetName && (
                    <span style={{ fontSize:10,color:"var(--dim)",maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
                      {player.Location.StreetName}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    })}
  </div>
);

const QueueContent = ({ queue }) => (
  <div style={{ display:"flex",flexDirection:"column",gap:4 }}>
    {queue.slice(0, 20).map((player, i) => (
      <div key={i} style={{ display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:6,background:"rgba(255,255,255,0.03)",border:"1px solid var(--border)" }}>
        <span style={{ fontSize:10,color:"var(--dim)",minWidth:16 }}>#{i+1}</span>
        <span style={{ fontSize:12,color:"#fcd34d" }}>{player}</span>
      </div>
    ))}
  </div>
);

const VehiclesContent = ({ vehicles }) => (
  <div style={{ display:"flex",flexDirection:"column",gap:4 }}>
    {vehicles.slice(0, 20).map((v, i) => (
      <div key={i} style={{ position:"relative",borderRadius:8,overflow:"hidden",background:"rgba(255,255,255,0.03)",border:"1px solid var(--border)" }}>
        <div style={{ position:"absolute",left:0,top:0,bottom:0,width:3,background:v.ColorHex||"#555",borderRadius:"8px 0 0 8px" }} />
        <div style={{ paddingLeft:12,padding:"8px 10px 8px 14px" }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:2 }}>
            <span style={{ fontSize:12,color:"#67e8f9",fontWeight:500 }}>{v.Name}</span>
            {v.Texture && v.Texture !== "Livery Name" && <span style={{ fontSize:10,color:"var(--dim)" }}>{v.Texture}</span>}
          </div>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <span style={{ fontSize:10,color:"var(--muted)" }}>{v.Owner}</span>
            {v.ColorName && (
              <span style={{ fontSize:10,padding:"2px 7px",borderRadius:10,background:`${v.ColorHex}20`,color:v.ColorHex }}>{v.ColorName}</span>
            )}
          </div>
        </div>
      </div>
    ))}
  </div>
);

// ─── ICONS ────────────────────────────────────────────────────────────────────
const CloseIcon = ({ size = 16 }) => (
  <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
  </svg>
);
const MenuIcon = () => (
  <svg width={18} height={18} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
  </svg>
);
const HomeIcon = () => (
  <svg width={16} height={16} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
  </svg>
);
const LayersIcon = () => (
  <svg width={15} height={15} viewBox="0 0 16 16" fill="none">
    <path d="M8 1L14 4.5L8 8L2 4.5L8 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
    <path d="M2 8L8 11.5L14 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M2 11.5L8 15L14 11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
