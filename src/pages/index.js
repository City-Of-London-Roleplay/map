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
  "winter-locations": "https://map.col-erlc.ca/winter-locations.png"
};

const AOP_ZONES = [
  {
    id: "1",
    label: "London and Byron",
    color: "#3b82f6",
    mapUrl: "/aop-1.png"
  },
  {
    id: "2",
    label: "London and East London",
    color: "#22c55e",
    mapUrl: "/aop-2.png"
  },
  {
    id: "3",
    label: "London and Surroundings",
    color: "#f59e0b",
    mapUrl: "/aop-3.png"
  },
  { id: "4", label: "Sarnia", color: "#a78bfa", mapUrl: "/aop-4.png" },
  {
    id: "5",
    label: "Sarnia and MacDonald Cartier Fwy",
    color: "#ef4444",
    mapUrl: "/aop-5.png"
  }
];

const JURISDICTION_MAPS = [
  {
    id: "lps",
    label: "LPS",
    fullName: "London Police Service",
    color: "#1a6fca",
    icon: "🏛️",
    mapUrl: "/jd-1.png"
  },
  {
    id: "sps",
    label: "SPS",
    fullName: "Sarnia Police Service",
    color: "#3b3bb7",
    icon: "🚔",
    mapUrl: "/jd-2.png"
  },
  {
    id: "fnps",
    label: "FNPS",
    fullName: "First Nations Police Service",
    color: "#ff9800",
    icon: "🪶",
    mapUrl: "/jd-3.png"
  },
  {
    id: "opp",
    label: "OPP",
    fullName: "Ontario Provincial Police",
    color: "#7f5d28",
    icon: "👮",
    mapUrl: "/jd-4.png"
  }
];

const TEAM_COLORS = {
  police: { dot: "#3b82f6", bg: "rgba(59,130,246,0.15)", text: "#93c5fd" },
  sheriff: { dot: "#16a34a", bg: "rgba(22,163,74,0.15)", text: "#86efac" },
  fire: { dot: "#ef4444", bg: "rgba(239,68,68,0.15)", text: "#fca5a5" },
  dot: { dot: "#f59e0b", bg: "rgba(245,158,11,0.15)", text: "#fcd34d" },
  jail: { dot: "#7c3aed", bg: "rgba(124,58,237,0.15)", text: "#c4b5fd" },
  default: { dot: "#6b7280", bg: "rgba(107,114,128,0.15)", text: "#9ca3af" }
};

const getTeamStyle = (team) =>
  TEAM_COLORS[team?.toLowerCase()] || TEAM_COLORS.default;

const worldToMap = (x, z) => ({
  x: (x / MAP_SIZE) * MAP_IMAGE_SIZE,
  y: (z / MAP_SIZE) * MAP_IMAGE_SIZE
});

// Fixed typo: removed extra 'g' at end of URL
const FALLBACK_AVATAR =
  "https://cdn.col-erlc.ca/files/images/69221fda-64a4-4169-91fd-295506c6712a.png";

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function Home() {
  const router = useRouter();

  const [serverInfo, setServerInfo] = useState(null);
  const [players, setPlayers] = useState({});
  const [queue, setQueue] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [joinLogs, setJoinLogs] = useState([]);
  const [markers, setMarkers] = useState({});
  const [avatarUrls, setAvatarUrls] = useState({});
  const [avatarsLoaded, setAvatarsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [hoveredPlayer, setHoveredPlayer] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [urlProcessed, setUrlProcessed] = useState(false);

  const [mapStyle, setMapStyle] = useState("normal-locations");
  const [nameDisplay, setNameDisplay] = useState("hover");

  const [layersPanelOpen, setLayersPanelOpen] = useState(false);
  const [layersTab, setLayersTab] = useState("style");
  const [activeAOP, setActiveAOP] = useState(null);
  const [activeJurisdictions, setActiveJurisdictions] = useState([]);
  const [showJurisdictionNames, setShowJurisdictionNames] = useState(true);

  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragOffset = useRef({ x: 0, y: 0 });
  const [transform, setTransform] = useState({ scale: 0.3, x: 0, y: 0 });

  // ── Smooth animation + auto-tracking refs ────────────────────────────────
  const animPosRef = useRef({});
  const [animPos, setAnimPos] = useState({});
  const animFrameRef = useRef(null);
  const isTrackingRef = useRef(false); // true while a player is selected & being followed
  const trackScaleRef = useRef(2); // preserve zoom level during tracking

  // ── Avatar helpers ────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      if (!players || Object.keys(players).length === 0 || avatarsLoaded)
        return;
      const urls = {};
      await Promise.all(
        Object.values(players).flatMap((team) =>
          team.map((player) =>
            fetch(`/api/roblox/user?userId=${player.Player.split(":")[1]}`)
              .then((r) => r.json())
              .then((url) => {
                urls[player.Player] = url;
              })
              .catch(() => {
                urls[player.Player] = FALLBACK_AVATAR;
              })
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
        try {
          const res = await fetch(
            `/api/roblox/user?userId=${marker.player.Player.split(":")[1]}`
          );
          urls[marker.player.Player] = await res.json();
        } catch {
          /* skip */
        }
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
      x: (c.width - MAP_IMAGE_SIZE * 0.3) / 2,
      y: (c.height - MAP_IMAGE_SIZE * 0.3) / 2
    });
  }, []);

  useEffect(() => {
    if (mapRef.current?.complete) centerMap();
  }, [mapStyle, centerMap]);

  // ── Focus on player ───────────────────────────────────────────────────────
  const focusOnPlayer = useCallback(
    (playerKey) => {
      const marker = markers[playerKey];
      if (!marker || !containerRef.current) return;
      const c = containerRef.current.getBoundingClientRect();
      const s = trackScaleRef.current;
      setTransform({
        scale: s,
        x: c.width / 2 - marker.x * s,
        y: c.height / 2 - marker.y * s
      });
      isTrackingRef.current = true;
    },
    [markers]
  );

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
      if (found) {
        setSelectedPlayer(found);
        setTimeout(() => focusOnPlayer(found.Player), 500);
      }
    }
    setUrlProcessed(true);
  }, [players, router.isReady, router.query, urlProcessed, focusOnPlayer]);

  useEffect(() => {
    if (!router.isReady) return;
    const url = new URL(window.location.href);
    if (selectedPlayer)
      url.searchParams.set("user", selectedPlayer.Player.split(":")[0]);
    else url.searchParams.delete("user");
    window.history.pushState({}, "", url.toString());
  }, [selectedPlayer, router.isReady]);

  // ── Fetch data ────────────────────────────────────────────────────────────
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [serverRes, playersRes, queueRes, vehiclesRes, joinLogsRes] =
        await Promise.all([
          fetch("/api/server").then((r) => r.json()),
          fetch("/api/players").then((r) => r.json()),
          fetch("/api/queue").then((r) => r.json()),
          fetch("/api/vehicles").then((r) => r.json()),
          fetch("/api/joinLogs").then((r) => r.json())
        ]);
      setServerInfo(serverRes);
      setPlayers(playersRes);
      setQueue(queueRes);
      setVehicles(vehiclesRes);
      setJoinLogs(joinLogsRes);

      const newMarkers = {};
      Object.entries(playersRes).forEach(([team, members]) =>
        members.forEach((p) => {
          if (p.Location) {
            const { x, y } = worldToMap(
              p.Location.LocationX,
              p.Location.LocationZ
            );
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
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  // ── NEW: Smooth marker animation loop (lerp toward real positions) ────────
  useEffect(() => {
    const LERP = 0.08; // lower = smoother but slower to arrive
    const tick = () => {
      const current = animPosRef.current;
      let changed = false;
      const next = { ...current };

      Object.entries(markers).forEach(([key, m]) => {
        if (!current[key]) {
          // First appearance — snap directly
          next[key] = { x: m.x, y: m.y };
          changed = true;
        } else {
          const dx = m.x - current[key].x;
          const dy = m.y - current[key].y;
          if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) {
            next[key] = {
              x: current[key].x + dx * LERP,
              y: current[key].y + dy * LERP
            };
            changed = true;
          }
        }
      });

      // Remove players who left
      Object.keys(current).forEach((k) => {
        if (!markers[k]) {
          delete next[k];
          changed = true;
        }
      });

      if (changed) {
        animPosRef.current = next;
        setAnimPos({ ...next });
      }

      // ── Auto-tracking: recentre map on selected player every frame ────────
      if (isTrackingRef.current && selectedPlayer && containerRef.current) {
        const tracked = next[selectedPlayer.Player];
        if (tracked) {
          const c = containerRef.current.getBoundingClientRect();
          const s = trackScaleRef.current;
          setTransform((prev) => {
            const targetX = c.width / 2 - tracked.x * s;
            const targetY = c.height / 2 - tracked.y * s;
            const dx = targetX - prev.x;
            const dy = targetY - prev.y;
            if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) return prev;
            return { scale: s, x: prev.x + dx * 0.12, y: prev.y + dy * 0.12 };
          });
        }
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [markers, selectedPlayer]);

  // ── Map interaction ───────────────────────────────────────────────────────
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    isDragging.current = true;
    isTrackingRef.current = false; // user dragged — stop auto-following
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragOffset.current = { x: transform.x, y: transform.y };
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    e.preventDefault();
    setTransform((prev) => ({
      ...prev,
      x: dragOffset.current.x + e.clientX - dragStart.current.x,
      y: dragOffset.current.y + e.clientY - dragStart.current.y
    }));
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const mapX = (mouseX - transform.x) / transform.scale;
    const mapY = (mouseY - transform.y) / transform.scale;
    const delta = e.deltaY > 0 ? 0.95 : 1.05;
    const ns = Math.min(Math.max(0.1, transform.scale * delta), 3);
    trackScaleRef.current = ns; // keep zoom in sync so re-track uses current zoom
    setTransform({ scale: ns, x: mouseX - mapX * ns, y: mouseY - mapY * ns });
  };

  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    isDragging.current = true;
    dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    dragOffset.current = { x: transform.x, y: transform.y };
  };

  const handleTouchMove = (e) => {
    if (!isDragging.current || e.touches.length !== 1) return;
    e.preventDefault();
    setTransform((prev) => ({
      ...prev,
      x: dragOffset.current.x + e.touches[0].clientX - dragStart.current.x,
      y: dragOffset.current.y + e.touches[0].clientY - dragStart.current.y
    }));
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
  };

  // ── Player helpers ────────────────────────────────────────────────────────
  const togglePlayerPopup = (player) => {
    if (selectedPlayer?.Player === player.Player) {
      setSelectedPlayer(null);
      isTrackingRef.current = false;
      return;
    }
    setSelectedPlayer(player);
    trackScaleRef.current = 2;
    focusOnPlayer(player.Player);
  };

  const PlayerAvatar = ({ player, size = 20 }) => (
    <img
      src={avatarUrls[player.Player] || FALLBACK_AVATAR}
      alt={player.Player.split(":")[0]}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        objectFit: "cover",
        border: "1px solid rgba(255,255,255,0.15)",
        flexShrink: 0
      }}
      onError={(e) => {
        e.target.src = FALLBACK_AVATAR;
      }}
    />
  );

  const isWinter = mapStyle.includes("winter");
  const showLocations = mapStyle.includes("locations");
  const updateMapStyle = (winter, locations) =>
    setMapStyle(
      `${winter ? "winter" : "normal"}${locations ? "-locations" : ""}`
    );

  const toggleJurisdiction = (jurisdictionId) => {
    setActiveJurisdictions((prev) =>
      prev.includes(jurisdictionId)
        ? prev.filter((id) => id !== jurisdictionId)
        : [...prev, jurisdictionId]
    );
  };

  const getMetaTitle = () => {
    const { user } = router.query;
    return user
      ? `City of London — Tracking ${user}`
      : "City of London ERLC Live Map";
  };

  const formatJoinTime = (timestamp) => {
    if (!timestamp) return null;
    const date = new Date(Math.round(timestamp * 1000));
    return date.toLocaleString([], { dateStyle: "short", timeStyle: "short" });
  };

  const totalPlayers = Object.values(players).reduce((s, t) => s + t.length, 0);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <Head>
        <title>{getMetaTitle()}</title>
        <meta
          name="description"
          content="Live map tracking for City of London ERLC server"
        />
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

      <div
        style={{
          display: "flex",
          height: "100vh",
          overflow: "hidden",
          background: "var(--bg)"
        }}
      >
        {/* ── MOBILE OVERLAY ── */}
        {isMobileMenuOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.7)",
              zIndex: 40
            }}
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* ── MOBILE DRAWER ── */}
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            height: "100%",
            width: 320,
            zIndex: 50,
            transform: isMobileMenuOpen ? "translateX(0)" : "translateX(-100%)",
            transition: "transform 0.3s ease",
            background: "rgba(13,14,17,0.97)",
            backdropFilter: "blur(20px)",
            borderRight: "1px solid var(--border)",
            overflowY: "auto"
          }}
          className="md-hidden-drawer"
        >
          <div style={{ padding: "20px 16px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20
              }}
            >
              <LogoBlock />
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                style={iconBtnStyle}
              >
                <CloseIcon />
              </button>
            </div>
            <SidebarContent
              {...{
                serverInfo,
                players,
                queue,
                vehicles,
                selectedPlayer,
                togglePlayerPopup,
                hoveredPlayer,
                setHoveredPlayer,
                setSelectedPlayer,
                nameDisplay,
                avatarUrls,
                PlayerAvatar
              }}
            />
          </div>
        </div>

        {/* ── DESKTOP SIDEBAR ── */}
        <div
          style={{
            display: "none",
            position: "fixed",
            top: 16,
            left: 16,
            width: 320,
            zIndex: 40,
            maxHeight: "calc(100vh - 32px)",
            borderRadius: 14,
            background: "rgba(13,14,17,0.92)",
            backdropFilter: "blur(20px)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow)",
            overflowY: "auto"
          }}
          className="desktop-sidebar"
        >
          <div style={{ padding: "20px 16px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20
              }}
            >
              <LogoBlock isLoading={isLoading} />
            </div>
            <SidebarContent
              {...{
                serverInfo,
                players,
                queue,
                vehicles,
                selectedPlayer,
                togglePlayerPopup,
                hoveredPlayer,
                setHoveredPlayer,
                setSelectedPlayer,
                nameDisplay,
                avatarUrls,
                PlayerAvatar
              }}
            />
          </div>
        </div>

        {/* ── MAP AREA ── */}
        <div
          ref={containerRef}
          style={{
            flex: 1,
            position: "relative",
            overflow: "hidden",
            background: "#0a0b0e",
            cursor: "grab"
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={(e) => {
            if (
              e.target === containerRef.current ||
              e.target === mapRef.current?.parentElement
            ) {
              setSelectedPlayer(null);
              setHoveredPlayer(null);
              const url = new URL(window.location.href);
              url.searchParams.delete("user");
              window.history.pushState({}, "", url.toString());
            }
          }}
        >
          {/* ── DESKTOP top-right controls ── */}
          <div
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              zIndex: 20,
              display: "flex",
              gap: 8,
              alignItems: "center"
            }}
            className="desktop-top-controls"
          >
            {/* AOP indicator pill */}
            {activeAOP &&
              (() => {
                const zone = AOP_ZONES.find((z) => z.id === activeAOP);
                if (!zone) return null;
                return (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 12px",
                      borderRadius: 20,
                      background: "rgba(13,14,17,0.92)",
                      backdropFilter: "blur(12px)",
                      border: `1px solid ${zone.color}50`,
                      boxShadow: "var(--shadow)"
                    }}
                  >
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: zone.color,
                        animation: "pulse 1.5s infinite"
                      }}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: "var(--font-h)",
                        fontWeight: 700,
                        color: zone.color
                      }}
                    >
                      AOP: {zone.label}
                    </span>
                  </div>
                );
              })()}

            <div style={{ ...pillStyle, gap: 6 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--green)",
                  boxShadow: "0 0 6px var(--green)",
                  animation: "pulse 2s infinite"
                }}
              />
              <span style={{ fontSize: 11, color: "var(--muted)" }}>Live</span>
            </div>
            <PlayerCountBadge serverInfo={serverInfo} />
            <div
              style={{ ...pillStyle, fontFamily: "monospace", fontSize: 12 }}
            >
              {Math.round(transform.scale * 100)}%
            </div>
            <button onClick={centerMap} style={iconBtnStyle} title="Reset view">
              <HomeIcon />
            </button>
            {isLoading && (
              <div
                style={{
                  width: 20,
                  height: 20,
                  border: "2px solid var(--accent)",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite"
                }}
              />
            )}
          </div>

          {/* ── MOBILE top bar ── */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 20,
              background: "rgba(13,14,17,0.95)",
              backdropFilter: "blur(16px)",
              borderBottom: "1px solid var(--border)",
              padding: "10px 12px",
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap"
            }}
            className="mobile-topbar"
          >
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              style={iconBtnStyle}
            >
              <MenuIcon />
            </button>
            <span
              style={{
                fontFamily: "var(--font-h)",
                fontSize: 15,
                fontWeight: 700,
                flex: 1,
                textAlign: "center"
              }}
            >
              City Of London
            </span>

            {/* Mobile AOP Indicator */}
            {activeAOP &&
              (() => {
                const zone = AOP_ZONES.find((z) => z.id === activeAOP);
                if (!zone) return null;
                return (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "3px 8px",
                      borderRadius: 16,
                      background: "rgba(13,14,17,0.92)",
                      backdropFilter: "blur(12px)",
                      border: `1px solid ${zone.color}50`
                    }}
                  >
                    <div
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: zone.color
                      }}
                    />
                    <span
                      style={{
                        fontSize: 9,
                        fontFamily: "var(--font-h)",
                        fontWeight: 700,
                        color: zone.color
                      }}
                    >
                      {zone.label.length > 15
                        ? zone.label.substring(0, 12) + "..."
                        : zone.label}
                    </span>
                  </div>
                );
              })()}

            <PlayerCountBadge serverInfo={serverInfo} />
            <button onClick={centerMap} style={iconBtnStyle} title="Reset view">
              <HomeIcon />
            </button>
          </div>

          {/* Base map */}
          <div
            style={{
              transform: `translate(${transform.x}px,${transform.y}px) scale(${transform.scale})`,
              transformOrigin: "0 0",
              position: "absolute",
              top: 0,
              left: 0,
              width: MAP_IMAGE_SIZE,
              height: MAP_IMAGE_SIZE
            }}
          >
            <img
              ref={mapRef}
              src={MAP_STYLES[mapStyle]}
              alt="Map"
              draggable={false}
              style={{
                width: MAP_IMAGE_SIZE,
                height: MAP_IMAGE_SIZE,
                display: "block",
                userSelect: "none",
                pointerEvents: "none"
              }}
              onLoad={centerMap}
              onError={(e) => {
                e.target.src = MAP_STYLES["normal-locations"];
              }}
            />
          </div>

          {/* AOP Overlay */}
          {activeAOP &&
            (() => {
              const zone = AOP_ZONES.find((z) => z.id === activeAOP);
              if (!zone || !zone.mapUrl) return null;
              return (
                <div
                  style={{
                    transform: `translate(${transform.x}px,${transform.y}px) scale(${transform.scale})`,
                    transformOrigin: "0 0",
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: MAP_IMAGE_SIZE,
                    height: MAP_IMAGE_SIZE,
                    pointerEvents: "none"
                  }}
                >
                  <img
                    src={zone.mapUrl}
                    alt={`AOP: ${zone.label}`}
                    draggable={false}
                    style={{
                      width: MAP_IMAGE_SIZE,
                      height: MAP_IMAGE_SIZE,
                      display: "block",
                      userSelect: "none",
                      pointerEvents: "none",
                      opacity: 0.7
                    }}
                    onError={(e) => {
                      console.warn(`AOP image failed: ${zone.mapUrl}`);
                      e.target.style.display = "none";
                    }}
                  />
                </div>
              );
            })()}

          {/* Jurisdiction Overlays */}
          {activeJurisdictions.map((jurId) => {
            const jur = JURISDICTION_MAPS.find((j) => j.id === jurId);
            if (!jur || !jur.mapUrl) return null;
            return (
              <div
                key={jur.id}
                style={{
                  transform: `translate(${transform.x}px,${transform.y}px) scale(${transform.scale})`,
                  transformOrigin: "0 0",
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: MAP_IMAGE_SIZE,
                  height: MAP_IMAGE_SIZE,
                  pointerEvents: "none"
                }}
              >
                <img
                  src={
                    showJurisdictionNames
                      ? jur.mapUrl.replace(".png", "-text.png")
                      : jur.mapUrl
                  }
                  alt={`${jur.fullName} Jurisdiction`}
                  draggable={false}
                  style={{
                    width: MAP_IMAGE_SIZE,
                    height: MAP_IMAGE_SIZE,
                    display: "block",
                    userSelect: "none",
                    pointerEvents: "none",
                    opacity: 0.6
                  }}
                  onError={(e) => {
                    console.warn(`JD image failed: ${jur.mapUrl}`);
                    e.target.style.display = "none";
                  }}
                />
              </div>
            );
          })}

          {/* Player markers — use animPos for smooth movement */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none"
            }}
          >
            {Object.values(markers).map((m) => {
              const pos = animPos[m.player.Player] || { x: m.x, y: m.y };
              const sx = pos.x * transform.scale + transform.x;
              const sy = pos.y * transform.scale + transform.y;
              const isSelected = selectedPlayer?.Player === m.player.Player;
              const isHovered = hoveredPlayer?.Player === m.player.Player;
              const ts = getTeamStyle(m.team);
              return (
                <div
                  key={m.player.Player}
                  style={{
                    position: "absolute",
                    left: sx,
                    top: sy,
                    transform: "translate(-50%,-50%)",
                    zIndex: isSelected ? 30 : 10,
                    pointerEvents: "auto",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center"
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlayerPopup(m.player);
                  }}
                  onMouseEnter={() => {
                    if (nameDisplay === "hover") setHoveredPlayer(m.player);
                  }}
                  onMouseLeave={() => {
                    if (nameDisplay === "hover") setHoveredPlayer(null);
                  }}
                >
                  {(nameDisplay === "always" || isSelected || isHovered) && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "calc(100% + 6px)",
                        left: "50%",
                        transform: "translateX(-50%)",
                        whiteSpace: "nowrap",
                        pointerEvents: "none",
                        zIndex: 40,
                        background: "rgba(13,14,17,0.95)",
                        backdropFilter: "blur(8px)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        padding: "3px 8px",
                        fontSize: 11,
                        color: "var(--text)",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.4)"
                      }}
                    >
                      {m.player.Player.split(":")[0]}
                      {m.player?.Callsign && (
                        <span style={{ color: "var(--muted)", marginLeft: 4 }}>
                          ({m.player.Callsign})
                        </span>
                      )}
                    </div>
                  )}
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      overflow: "hidden",
                      background: "#000000",
                      border: `2px solid ${ts.dot}`,
                      boxShadow: isSelected
                        ? `0 0 0 3px ${ts.dot}40,0 4px 12px rgba(0,0,0,0.5)`
                        : "0 2px 8px rgba(0,0,0,0.4)",
                      transition: "box-shadow 0.15s ease"
                    }}
                  >
                    <img
                      src={avatarUrls[m.player.Player] || FALLBACK_AVATAR}
                      alt=""
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover"
                      }}
                      onError={(e) => {
                        e.target.src = FALLBACK_AVATAR;
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Player popup */}
          {selectedPlayer &&
            (() => {
              const ts = getTeamStyle(selectedPlayer.Team);
              const name = selectedPlayer.Player.split(":")[0];
              const loc = selectedPlayer.Location;
              const wanted = selectedPlayer.WantedStars || 0;
              const perm = selectedPlayer.Permission || "";
              const isStaff =
                perm.toLowerCase().includes("admin") ||
                perm.toLowerCase().includes("owner") ||
                perm.toLowerCase().includes("mod") ||
                perm.toLowerCase().includes("helper");
              const pv = vehicles.find((v) => v.Owner === name);

              const joinLogEntry = joinLogs
                .filter(
                  (j) => j.Player.split(":")[0] === name && j.Join === true
                )
                .sort(
                  (a, b) => new Date(b.Timestamp) - new Date(a.Timestamp)
                )[0];
              const Joined = joinLogEntry?.Timestamp
                ? formatJoinTime(joinLogEntry.Timestamp)
                : null;

              return (
                <div
                  style={{
                    position: "absolute",
                    bottom: 80,
                    right: 16,
                    zIndex: 50,
                    width: 300,
                    borderRadius: 14,
                    background: "rgba(18,20,26,0.98)",
                    backdropFilter: "blur(20px)",
                    border: "1px solid var(--border)",
                    boxShadow: "var(--shadow)",
                    animation: "fadeUp 0.2s ease",
                    overflow: "hidden"
                  }}
                >
                  {/* Colour accent bar */}
                  <div
                    style={{ height: 3, background: ts.dot, width: "100%" }}
                  />

                  <div style={{ padding: "14px 14px 0" }}>
                    {/* Header */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        marginBottom: 12
                      }}
                    >
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <img
                          src={
                            avatarUrls[selectedPlayer.Player] || FALLBACK_AVATAR
                          }
                          alt=""
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: 10,
                            objectFit: "cover",
                            border: `2px solid ${ts.dot}60`
                          }}
                          onError={(e) => {
                            e.target.src = FALLBACK_AVATAR;
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            bottom: 2,
                            right: 2,
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: "#22c55e",
                            border: "2px solid rgba(18,20,26,0.98)",
                            boxShadow: "0 0 6px #22c55e"
                          }}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontFamily: "var(--font-h)",
                            fontWeight: 700,
                            fontSize: 15,
                            color: "var(--text)",
                            marginBottom: 3,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            flexWrap: "wrap"
                          }}
                        >
                          {name}
                          {isStaff && (
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                background: "rgba(59,130,246,0.2)",
                                border: "1px solid rgba(59,130,246,0.4)",
                                color: "#93c5fd",
                                borderRadius: 4,
                                padding: "1px 5px",
                                letterSpacing: "0.05em"
                              }}
                            >
                              STAFF
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            background: ts.bg,
                            border: `1px solid ${ts.dot}40`,
                            borderRadius: 6,
                            padding: "3px 8px"
                          }}
                        >
                          <div
                            style={{
                              width: 5,
                              height: 5,
                              borderRadius: "50%",
                              background: ts.dot,
                              flexShrink: 0
                            }}
                          />
                          <span
                            style={{
                              fontSize: 11,
                              color: ts.text,
                              fontWeight: 600
                            }}
                          >
                            {selectedPlayer.Team}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedPlayer(null)}
                        style={{
                          ...iconBtnStyle,
                          width: 28,
                          height: 28,
                          flexShrink: 0
                        }}
                      >
                        <CloseIcon size={13} />
                      </button>
                    </div>

                    {/* Info rows */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 1,
                        marginBottom: 12
                      }}
                    >
                      {selectedPlayer.Callsign && (
                        <InfoPill
                          label="Callsign"
                          value={selectedPlayer.Callsign}
                          mono
                        />
                      )}
                      {perm && perm !== "Normal" && (
                        <InfoPill label="Role" value={perm} color="#93c5fd" />
                      )}
                      <InfoPill
                        label="Wanted"
                        value={
                          wanted > 0
                            ? "★".repeat(wanted) +
                              ` (${wanted} star${wanted > 1 ? "s" : ""})`
                            : "Clean"
                        }
                        color={wanted > 0 ? "#fca5a5" : "#86efac"}
                      />
                      {Joined && (
                        <InfoPill
                          label="Joined"
                          value={Joined}
                          color="var(--muted)"
                        />
                      )}
                    </div>

                    {/* Vehicle block */}
                    {pv && (
                      <div
                        style={{
                          borderTop: "1px solid var(--border)",
                          paddingTop: 10,
                          marginBottom: 12
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            color: "var(--muted)",
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                            marginBottom: 8
                          }}
                        >
                          Vehicle
                        </div>
                        <div
                          style={{
                            position: "relative",
                            borderRadius: 8,
                            overflow: "hidden",
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid var(--border)",
                            padding: "8px 10px 8px 16px"
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: 3,
                              background: pv.ColorHex || "#555"
                            }}
                          />
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginBottom: 4
                            }}
                          >
                            <span
                              style={{
                                fontSize: 12,
                                color: "#67e8f9",
                                fontWeight: 600,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap"
                              }}
                            >
                              {pv.Name}
                            </span>
                            <span
                              style={{
                                fontFamily: "monospace",
                                fontSize: 10,
                                color: "var(--muted)",
                                background: "rgba(255,255,255,0.06)",
                                padding: "1px 6px",
                                borderRadius: 4,
                                marginLeft: 8,
                                flexShrink: 0
                              }}
                            >
                              {pv.Plate}
                            </span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6
                            }}
                          >
                            {pv.ColorHex && (
                              <div
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: "50%",
                                  background: pv.ColorHex,
                                  border: "1px solid rgba(255,255,255,0.2)",
                                  flexShrink: 0
                                }}
                              />
                            )}
                            <span
                              style={{ fontSize: 10, color: "var(--muted)" }}
                            >
                              {pv.ColorName || "Unknown colour"}
                            </span>
                            {pv.Texture && pv.Texture !== "Livery Name" && (
                              <span
                                style={{
                                  fontSize: 10,
                                  color: "var(--dim)",
                                  marginLeft: "auto"
                                }}
                              >
                                {pv.Texture}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Location block */}
                    {loc && (
                      <div
                        style={{
                          borderTop: "1px solid var(--border)",
                          paddingTop: 10,
                          marginBottom: 12
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            color: "var(--muted)",
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                            marginBottom: 8
                          }}
                        >
                          Location
                        </div>
                        {loc.StreetName && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              marginBottom: 8
                            }}
                          >
                            <span style={{ fontSize: 14 }}>📍</span>
                            <div>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: "var(--text)",
                                  fontWeight: 500
                                }}
                              >
                                {loc.BuildingNumber
                                  ? `${loc.BuildingNumber} `
                                  : ""}
                                {loc.StreetName}
                              </div>
                              {loc.PostalCode && (
                                <div
                                  style={{
                                    fontSize: 10,
                                    color: "var(--muted)",
                                    fontFamily: "monospace",
                                    marginTop: 1
                                  }}
                                >
                                  Postal: {loc.PostalCode}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Close button */}
                  <div style={{ padding: "0 14px 14px" }}>
                    <button
                      onClick={() => setSelectedPlayer(null)}
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: 8,
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid var(--border)",
                        color: "var(--muted)",
                        fontSize: 12,
                        cursor: "pointer",
                        fontFamily: "var(--font-b)",
                        transition: "background 0.15s"
                      }}
                      onMouseEnter={(e) =>
                        (e.target.style.background = "rgba(255,255,255,0.09)")
                      }
                      onMouseLeave={(e) =>
                        (e.target.style.background = "rgba(255,255,255,0.05)")
                      }
                    >
                      Close
                    </button>
                  </div>
                </div>
              );
            })()}

          {/* ── BOTTOM-LEFT: Map options ── */}
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: 16,
              zIndex: 30,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              alignItems: "flex-start"
            }}
          >
            {layersPanelOpen && (
              <div
                style={{
                  width: 300,
                  borderRadius: 14,
                  background: "rgba(13,14,17,0.97)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid var(--border)",
                  boxShadow: "var(--shadow)",
                  overflow: "hidden",
                  animation: "fadeUp 0.18s ease"
                }}
              >
                {/* Tab bar */}
                <div
                  style={{
                    display: "flex",
                    borderBottom: "1px solid var(--border)"
                  }}
                >
                  {[
                    { id: "style", label: "Map Style" },
                    { id: "aop", label: "Area of Play" },
                    { id: "jurisdiction", label: "Jurisdiction" }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setLayersTab(tab.id)}
                      style={{
                        flex: 1,
                        padding: "10px 0",
                        fontSize: 11,
                        fontWeight: 600,
                        fontFamily: "var(--font-h)",
                        cursor: "pointer",
                        border: "none",
                        background: "none",
                        color:
                          layersTab === tab.id
                            ? "var(--accent2)"
                            : "var(--muted)",
                        position: "relative",
                        transition: "color 0.15s"
                      }}
                    >
                      {tab.label}
                      {layersTab === tab.id && (
                        <div
                          style={{
                            position: "absolute",
                            bottom: 0,
                            left: "20%",
                            right: "20%",
                            height: 2,
                            background: "var(--accent)",
                            borderRadius: "2px 2px 0 0"
                          }}
                        />
                      )}
                    </button>
                  ))}
                </div>

                {/* Map Style tab */}
                {layersTab === "style" && (
                  <div style={{ padding: 14 }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                        marginBottom: 14
                      }}
                    >
                      {[
                        {
                          key: "normal",
                          label: "Default",
                          mapUrl: MAP_STYLES["normal"],
                          preview: "#1a2332"
                        },
                        {
                          key: "winter",
                          label: "Winter",
                          mapUrl: MAP_STYLES["winter"],
                          preview: "#1e2d3d"
                        }
                      ].map(({ key, label, mapUrl, preview }) => (
                        <div
                          key={key}
                          onClick={() =>
                            updateMapStyle(key === "winter", showLocations)
                          }
                          style={{
                            borderRadius: 8,
                            overflow: "hidden",
                            cursor: "pointer",
                            border: `2px solid ${isWinter === (key === "winter") ? "var(--accent)" : "transparent"}`,
                            transition: "border-color 0.15s"
                          }}
                        >
                          <div
                            style={{
                              background: preview,
                              height: 56,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              overflow: "hidden",
                              position: "relative"
                            }}
                          >
                            <img
                              src={mapUrl}
                              alt={label}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                opacity: 0.8
                              }}
                              onError={(e) => {
                                e.target.style.display = "none";
                                e.target.parentElement.style.background =
                                  preview;
                              }}
                            />
                          </div>
                          <div
                            style={{
                              padding: "5px 8px",
                              background: "rgba(255,255,255,0.04)",
                              fontSize: 11,
                              fontFamily: "var(--font-h)",
                              fontWeight: 600,
                              textAlign: "center"
                            }}
                          >
                            {label}
                          </div>
                        </div>
                      ))}
                    </div>
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

                {/* AOP tab */}
                {layersTab === "aop" && (
                  <div style={{ padding: 14 }}>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--muted)",
                        marginBottom: 10,
                        lineHeight: 1.6
                      }}
                    >
                      Select the active Area of Play for this session. Only one
                      zone is active at a time.
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4
                      }}
                    >
                      {AOP_ZONES.map((zone) => {
                        const isActive = activeAOP === zone.id;
                        const hasMap = !!zone.mapUrl;
                        return (
                          <button
                            key={zone.id}
                            onClick={() =>
                              hasMap && setActiveAOP(isActive ? null : zone.id)
                            }
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "9px 10px",
                              borderRadius: 8,
                              border: "none",
                              cursor: hasMap ? "pointer" : "not-allowed",
                              background: isActive
                                ? `${zone.color}18`
                                : "rgba(255,255,255,0.03)",
                              outline: isActive
                                ? `1.5px solid ${zone.color}60`
                                : "1.5px solid transparent",
                              transition: "all 0.15s",
                              textAlign: "left",
                              opacity: hasMap ? 1 : 0.45
                            }}
                            onMouseEnter={(e) => {
                              if (!isActive && hasMap)
                                e.currentTarget.style.background =
                                  "rgba(255,255,255,0.06)";
                            }}
                            onMouseLeave={(e) => {
                              if (!isActive && hasMap)
                                e.currentTarget.style.background =
                                  "rgba(255,255,255,0.03)";
                            }}
                          >
                            <div
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: 3,
                                background: zone.color,
                                flexShrink: 0
                              }}
                            />
                            <span
                              style={{
                                flex: 1,
                                fontSize: 12,
                                color: isActive
                                  ? "var(--text)"
                                  : "var(--muted)",
                                fontFamily: "var(--font-b)"
                              }}
                            >
                              {zone.label}
                            </span>
                            {!hasMap && (
                              <span
                                style={{ fontSize: 10, color: "var(--dim)" }}
                              >
                                Full Map
                              </span>
                            )}
                            {isActive && (
                              <span
                                style={{
                                  fontSize: 10,
                                  color: zone.color,
                                  fontWeight: 600,
                                  fontFamily: "var(--font-h)"
                                }}
                              >
                                ACTIVE
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Jurisdiction tab */}
                {layersTab === "jurisdiction" && (
                  <div style={{ padding: 14 }}>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--muted)",
                        marginBottom: 10,
                        lineHeight: 1.6
                      }}
                    >
                      View jurisdiction boundaries for each department. Multiple
                      can be active at once.
                    </div>
                    <ToggleRow
                      label="Show Jurisdiction Names"
                      desc="Display names on map overlay"
                      value={showJurisdictionNames}
                      onChange={(v) => setShowJurisdictionNames(v)}
                    />
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        marginTop: 8
                      }}
                    >
                      {JURISDICTION_MAPS.map((j) => {
                        const isActive = activeJurisdictions.includes(j.id);
                        const hasMap = !!j.mapUrl;
                        return (
                          <button
                            key={j.id}
                            onClick={() => hasMap && toggleJurisdiction(j.id)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "9px 10px",
                              borderRadius: 8,
                              border: "none",
                              cursor: hasMap ? "pointer" : "not-allowed",
                              background: isActive
                                ? `${j.color}18`
                                : "rgba(255,255,255,0.03)",
                              outline: isActive
                                ? `1.5px solid ${j.color}60`
                                : "1.5px solid transparent",
                              opacity: hasMap ? 1 : 0.45,
                              transition: "all 0.15s",
                              textAlign: "left"
                            }}
                          >
                            <span style={{ fontSize: 14 }}>{j.icon}</span>
                            <div style={{ flex: 1 }}>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: isActive
                                    ? "var(--text)"
                                    : "var(--muted)",
                                  fontFamily: "var(--font-b)"
                                }}
                              >
                                {j.fullName}
                              </div>
                              <div
                                style={{ fontSize: 10, color: "var(--dim)" }}
                              >
                                {j.label}
                              </div>
                            </div>
                            {isActive && (
                              <span
                                style={{
                                  fontSize: 10,
                                  color: j.color,
                                  fontWeight: 600,
                                  fontFamily: "var(--font-h)"
                                }}
                              >
                                ON
                              </span>
                            )}
                            <div
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 2,
                                background: j.color,
                                flexShrink: 0,
                                opacity: hasMap ? 1 : 0.4
                              }}
                            />
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
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 14px",
                borderRadius: 10,
                cursor: "pointer",
                background: "rgba(13,14,17,0.97)",
                backdropFilter: "blur(16px)",
                border: `1px solid ${layersPanelOpen ? "var(--accent)" : "var(--border)"}`,
                boxShadow: "var(--shadow)",
                color: "var(--text)",
                fontFamily: "var(--font-h)",
                fontSize: 12,
                fontWeight: 600,
                transition: "border-color 0.15s"
              }}
            >
              <LayersIcon />
              Map Options
              {(activeAOP || activeJurisdictions.length > 0) && (
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--accent)",
                    marginLeft: 2
                  }}
                />
              )}
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                style={{
                  marginLeft: "auto",
                  transform: layersPanelOpen ? "rotate(180deg)" : "",
                  transition: "transform 0.18s"
                }}
              >
                <path
                  d="M3 4.5L6 7.5L9 4.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
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

// ─── SHARED STYLES ────────────────────────────────────────────────────────────
const pillStyle = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "5px 10px",
  borderRadius: 20,
  background: "rgba(13,14,17,0.92)",
  backdropFilter: "blur(12px)",
  border: "1px solid var(--border)",
  boxShadow: "var(--shadow)"
};

const iconBtnStyle = {
  width: 34,
  height: 34,
  borderRadius: 8,
  cursor: "pointer",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  transition: "background 0.15s"
};

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────
const LogoBlock = ({ isLoading }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
    <img
      src="https://cdn.col-erlc.ca/files/images/69221fda-64a4-4169-91fd-295506c6712a.png"
      alt="City of London"
      style={{ height: 36, width: "auto", objectFit: "contain", flexShrink: 0 }}
    />
    {isLoading && (
      <div
        style={{
          width: 16,
          height: 16,
          border: "2px solid var(--accent)",
          borderTopColor: "transparent",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite"
        }}
      />
    )}
  </div>
);

const PlayerCountBadge = ({ serverInfo }) => {
  const cur = serverInfo?.CurrentPlayers ?? 0;
  const max = serverInfo?.MaxPlayers ?? 0;
  const pct = max ? cur / max : 0;
  const col =
    pct > 0.85
      ? "#ef4444"
      : pct > 0.6
        ? "#f59e0b"
        : cur === 0
          ? "#ef4444"
          : "#22c55e";
  return (
    <div style={{ ...pillStyle, fontSize: 12 }}>
      <span style={{ color: col, fontWeight: 600 }}>{cur}</span>
      <span style={{ color: "var(--dim)" }}>/{max}</span>
    </div>
  );
};

const ToggleRow = ({ label, desc, value, onChange }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "10px 0",
      borderTop: "1px solid var(--border)"
    }}
  >
    <div>
      <div style={{ fontSize: 12, color: "var(--text)", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 10, color: "var(--dim)" }}>{desc}</div>
    </div>
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 38,
        height: 22,
        borderRadius: 11,
        border: "none",
        cursor: "pointer",
        background: value ? "var(--accent)" : "rgba(255,255,255,0.1)",
        position: "relative",
        transition: "background 0.2s",
        flexShrink: 0
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: "#fff",
          position: "absolute",
          top: 3,
          left: value ? 19 : 3,
          transition: "left 0.2s",
          boxShadow: "0 1px 4px rgba(0,0,0,0.3)"
        }}
      />
    </button>
  </div>
);

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
const SidebarContent = ({
  serverInfo,
  players,
  queue,
  vehicles,
  selectedPlayer,
  togglePlayerPopup,
  hoveredPlayer,
  setHoveredPlayer,
  setSelectedPlayer,
  nameDisplay,
  avatarUrls,
  PlayerAvatar
}) => {
  const total = Object.values(players).reduce((s, t) => s + t.length, 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          borderRadius: 10,
          overflow: "hidden",
          border: "1px solid var(--border)",
          background: "rgba(255,255,255,0.02)"
        }}
      >
        <div style={{ padding: 14 }}>
          <ServerStatus serverInfo={serverInfo} />
        </div>
      </div>
      {total > 0 && (
        <Dropdown title={`Players (${total})`} icon="👥" defaultOpen>
          <PlayersContent
            {...{
              players,
              selectedPlayer,
              togglePlayerPopup,
              hoveredPlayer,
              setHoveredPlayer,
              setSelectedPlayer,
              nameDisplay,
              avatarUrls,
              PlayerAvatar
            }}
          />
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
    <div
      style={{
        borderRadius: 10,
        overflow: "hidden",
        border: "1px solid var(--border)",
        background: "rgba(255,255,255,0.02)"
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          padding: "11px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "none",
          border: "none",
          cursor: "pointer",
          transition: "background 0.15s"
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = "rgba(255,255,255,0.04)")
        }
        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14 }}>{icon}</span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text)",
              fontFamily: "var(--font-h)"
            }}
          >
            {title}
          </span>
        </div>
        <svg
          style={{
            width: 14,
            height: 14,
            color: "var(--muted)",
            transform: open ? "rotate(180deg)" : "",
            transition: "transform 0.25s",
            flexShrink: 0
          }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {open && (
        <div
          style={{
            borderTop: "1px solid var(--border)",
            padding: 14,
            maxHeight: 320,
            overflowY: "auto"
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
};

const ServerStatus = ({ serverInfo }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    {[
      ["Server", serverInfo?.Name],
      ["Join Key", serverInfo?.JoinKey]
    ].map(([k, v]) => (
      <div
        key={k}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}
      >
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{k}</span>
        <span
          style={{
            fontSize: 12,
            color: "var(--text)",
            fontWeight: 500,
            fontFamily: k === "Join Key" ? "monospace" : "inherit",
            background: k === "Join Key" ? "rgba(255,255,255,0.06)" : "none",
            padding: k === "Join Key" ? "2px 7px" : 0,
            borderRadius: 4
          }}
        >
          {v || "—"}
        </span>
      </div>
    ))}
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }}
    >
      <span style={{ fontSize: 12, color: "var(--muted)" }}>Capacity</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            width: 60,
            height: 4,
            borderRadius: 2,
            background: "rgba(255,255,255,0.08)",
            overflow: "hidden"
          }}
        >
          <div
            style={{
              height: "100%",
              borderRadius: 2,
              background:
                serverInfo?.CurrentPlayers / serverInfo?.MaxPlayers > 0.8
                  ? "#ef4444"
                  : "#22c55e",
              width: `${((serverInfo?.CurrentPlayers || 0) / (serverInfo?.MaxPlayers || 1)) * 100}%`,
              transition: "width 0.5s"
            }}
          />
        </div>
        <span style={{ fontSize: 12, color: "var(--text)", fontWeight: 500 }}>
          {serverInfo?.CurrentPlayers || 0}/{serverInfo?.MaxPlayers || 0}
        </span>
      </div>
    </div>
  </div>
);

const PlayersContent = ({
  players,
  selectedPlayer,
  togglePlayerPopup,
  hoveredPlayer,
  setHoveredPlayer,
  setSelectedPlayer,
  nameDisplay,
  avatarUrls,
  PlayerAvatar
}) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    {Object.entries(players).map(([team, members]) => {
      const ts = getTeamStyle(team);
      return (
        <div key={team}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 6
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: ts.dot
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em"
                }}
              >
                {team}
              </span>
            </div>
            <span
              style={{
                fontSize: 10,
                color: "var(--dim)",
                background: "rgba(255,255,255,0.05)",
                borderRadius: 10,
                padding: "2px 7px"
              }}
            >
              {members.length}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {members.map((player) => {
              const isSelected = selectedPlayer?.Player === player.Player;
              return (
                <div
                  key={player.Player}
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlayerPopup(player);
                    setSelectedPlayer(player);
                  }}
                  onMouseEnter={() => {
                    if (nameDisplay === "hover") setHoveredPlayer(player);
                  }}
                  onMouseLeave={() => {
                    if (nameDisplay === "hover") setHoveredPlayer(null);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "7px 10px",
                    borderRadius: 8,
                    cursor: "pointer",
                    background: isSelected ? `${ts.dot}20` : "transparent",
                    outline: isSelected
                      ? `1px solid ${ts.dot}40`
                      : "1px solid transparent",
                    transition: "all 0.15s"
                  }}
                  onMouseOver={(e) => {
                    if (!isSelected)
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.04)";
                  }}
                  onMouseOut={(e) => {
                    if (!isSelected)
                      e.currentTarget.style.background = "transparent";
                  }}
                >
                  <PlayerAvatar player={player} size={22} />
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12,
                      color: "var(--text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {player.Player.split(":")[0]}
                  </span>
                  {player.Location?.StreetName && (
                    <span
                      style={{
                        fontSize: 10,
                        color: "var(--dim)",
                        maxWidth: 80,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}
                    >
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
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    {queue.slice(0, 20).map((player, i) => (
      <div
        key={i}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          borderRadius: 6,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid var(--border)"
        }}
      >
        <span style={{ fontSize: 10, color: "var(--dim)", minWidth: 16 }}>
          #{i + 1}
        </span>
        <span style={{ fontSize: 12, color: "#fcd34d" }}>{player}</span>
      </div>
    ))}
  </div>
);

const VehiclesContent = ({ vehicles }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    {vehicles.slice(0, 20).map((v, i) => (
      <div
        key={i}
        style={{
          position: "relative",
          borderRadius: 8,
          overflow: "hidden",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid var(--border)"
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            background: v.ColorHex || "#555",
            borderRadius: "8px 0 0 8px"
          }}
        />
        <div style={{ padding: "8px 10px 8px 14px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 2
            }}
          >
            <span style={{ fontSize: 12, color: "#67e8f9", fontWeight: 500 }}>
              {v.Name}
            </span>
            {v.Texture && v.Texture !== "Livery Name" && (
              <span style={{ fontSize: 10, color: "var(--dim)" }}>
                {v.Texture}
              </span>
            )}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}
          >
            <span style={{ fontSize: 10, color: "var(--muted)" }}>
              {v.Owner}
            </span>
            {v.ColorName && (
              <span
                style={{
                  fontSize: 10,
                  padding: "2px 7px",
                  borderRadius: 10,
                  background: `${v.ColorHex}20`,
                  color: v.ColorHex
                }}
              >
                {v.ColorName}
              </span>
            )}
          </div>
        </div>
      </div>
    ))}
  </div>
);

// ─── INFO PILL ────────────────────────────────────────────────────────────────
const InfoPill = ({ label, value, mono, color }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "5px 0",
      borderBottom: "1px solid rgba(255,255,255,0.04)"
    }}
  >
    <span style={{ fontSize: 11, color: "var(--muted)" }}>{label}</span>
    <span
      style={{
        fontSize: 11,
        color: color || "var(--text)",
        fontFamily: mono ? "monospace" : "inherit",
        fontWeight: mono ? 400 : 500
      }}
    >
      {value}
    </span>
  </div>
);

// ─── ICONS ────────────────────────────────────────────────────────────────────
const CloseIcon = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);
const MenuIcon = () => (
  <svg
    width={18}
    height={18}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 6h16M4 12h16M4 18h16"
    />
  </svg>
);
const HomeIcon = () => (
  <svg
    width={16}
    height={16}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
    />
  </svg>
);
const LayersIcon = () => (
  <svg width={15} height={15} viewBox="0 0 16 16" fill="none">
    <path
      d="M8 1L14 4.5L8 8L2 4.5L8 1Z"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
    <path
      d="M2 8L8 11.5L14 8"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
    <path
      d="M2 11.5L8 15L14 11.5"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
  </svg>
);
