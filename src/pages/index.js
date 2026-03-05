import { useEffect, useState, useRef, useCallback } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

export default function Home() {
  const router = useRouter();
  const [serverInfo, setServerInfo] = useState(null);
  const [players, setPlayers] = useState({});
  const [staff, setStaff] = useState({});
  const [joinLogs, setJoinLogs] = useState([]);
  const [queue, setQueue] = useState([]);
  const [killLogs, setKillLogs] = useState([]);
  const [commandLogs, setCommandLogs] = useState([]);
  const [modCalls, setModCalls] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [markers, setMarkers] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [mapStyle, setMapStyle] = useState("normal-locations");
  const [nameDisplay, setNameDisplay] = useState("hover");
  const [urlProcessed, setUrlProcessed] = useState(false);

  const MAP_STYLES = {
    normal: "https://map.col-erlc.ca/normal.png",
    "normal-locations": "https://map.col-erlc.ca/normal-locations.png",
    winter: "https://map.col-erlc.ca/winter.png",
    "winter-locations": "https://map.col-erlc.ca/winter-locations.png"
  };

  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const dragOffset = useRef({ x: 0, y: 0 });

  const [transform, setTransform] = useState({
    scale: 0.3,
    x: 0,
    y: 0
  });

  const MAP_SIZE = 3121;
  const MAP_IMAGE_SIZE = 3121;

  // Process URL parameters
  useEffect(() => {
    if (!urlProcessed && Object.keys(players).length > 0 && router.isReady) {
      const { user, team } = router.query;

      if (user) {
        // Find user by name or ID
        const userLower = user.toLowerCase();
        let foundPlayer = null;

        Object.values(players).forEach((team) => {
          team.forEach((player) => {
            const playerName = player.Player.split(":")[0].toLowerCase();
            const playerId = player.Player.split(":")[1];

            if (playerName.includes(userLower) || playerId === user) {
              foundPlayer = player;
            }
          });
        });

        if (foundPlayer) {
          setSelectedPlayer(foundPlayer);
          setTimeout(() => focusOnPlayer(foundPlayer.Player), 500);
        }
      }

      if (team) {
        // Find team and focus on first player in that team
        const teamLower = team.toLowerCase();
        let teamPlayers = [];

        Object.entries(players).forEach(([teamName, members]) => {
          if (teamName.toLowerCase().includes(teamLower)) {
            teamPlayers = members;
          }
        });

        if (teamPlayers.length > 0) {
          // Focus on the first player in the team
          setSelectedPlayer(teamPlayers[0]);
          setTimeout(() => focusOnPlayer(teamPlayers[0].Player), 500);
        }
      }

      setUrlProcessed(true);
    }
  }, [players, router.isReady, router.query, urlProcessed, focusOnPlayer]);

  const centerMap = useCallback(() => {
    if (!containerRef.current || !mapRef.current) return;
    const container = containerRef.current.getBoundingClientRect();
    setTransform({
      scale: 0.3,
      x: (container.width - MAP_IMAGE_SIZE * 0.3) / 2,
      y: (container.height - MAP_IMAGE_SIZE * 0.3) / 2
    });
  }, []);

  useEffect(() => {
    if (mapRef.current?.complete) centerMap();
  }, [mapStyle, centerMap]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [
        serverRes,
        playersRes,
        staffRes,
        joinLogsRes,
        queueRes,
        killLogsRes,
        commandLogsRes,
        modCallsRes,
        vehiclesRes
      ] = await Promise.all([
        fetch("/api/server").then((r) => r.json()),
        fetch("/api/players").then((r) => r.json()),
        fetch("/api/staff").then((r) => r.json()),
        fetch("/api/joinLogs").then((r) => r.json()),
        fetch("/api/queue").then((r) => r.json()),
        fetch("/api/killLogs").then((r) => r.json()),
        fetch("/api/commandLogs").then((r) => r.json()),
        fetch("/api/modCalls").then((r) => r.json()),
        fetch("/api/vehicles").then((r) => r.json())
      ]);

      setServerInfo(serverRes);
      setPlayers(playersRes);
      setStaff(staffRes);
      setJoinLogs(joinLogsRes);
      setQueue(queueRes);
      setKillLogs(killLogsRes);
      setCommandLogs(commandLogsRes);
      setModCalls(modCallsRes);
      setVehicles(vehiclesRes);

      const newMarkers = {};
      Object.entries(playersRes).forEach(([team, members]) => {
        members.forEach((p) => {
          if (p.Location) {
            const { x, y } = worldToMap(
              p.Location.LocationX,
              p.Location.LocationZ
            );
            newMarkers[p.Player] = { x, y, player: p, team, id: p.Player };
          }
        });
      });
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

  const worldToMap = (x, z) => ({
    x: (x / MAP_SIZE) * MAP_IMAGE_SIZE,
    y: (z / MAP_SIZE) * MAP_IMAGE_SIZE
  });

  // Google Maps style dragging
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragOffset.current = { x: transform.x, y: transform.y };
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    e.preventDefault();

    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;

    setTransform((prev) => ({
      ...prev,
      x: dragOffset.current.x + dx,
      y: dragOffset.current.y + dy
    }));
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  // Google Maps style zooming (towards mouse position)
  const handleWheel = (e) => {
    e.preventDefault();

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate mouse position relative to map before zoom
    const mapX = (mouseX - transform.x) / transform.scale;
    const mapY = (mouseY - transform.y) / transform.scale;

    // Calculate new scale (Google Maps style - smoother)
    const delta = e.deltaY > 0 ? 0.95 : 1.05;
    const newScale = Math.min(Math.max(0.1, transform.scale * delta), 3);

    // Adjust position to zoom towards mouse (Google Maps style)
    setTransform({
      scale: newScale,
      x: mouseX - mapX * newScale,
      y: mouseY - mapY * newScale
    });
  };

  // Touch support for mobile (Google Maps style)
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      e.preventDefault();
      isDragging.current = true;
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      dragOffset.current = { x: transform.x, y: transform.y };
    }
  };

  const handleTouchMove = (e) => {
    if (!isDragging.current || e.touches.length !== 1) return;
    e.preventDefault();

    const dx = e.touches[0].clientX - dragStart.current.x;
    const dy = e.touches[0].clientY - dragStart.current.y;

    setTransform((prev) => ({
      ...prev,
      x: dragOffset.current.x + dx,
      y: dragOffset.current.y + dy
    }));
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
  };

  const getTeamColor = (team) => {
    switch (team?.toLowerCase()) {
      case "police":
        return "bg-blue-500";
      case "sheriff":
        return "bg-green-600";
      case "fire":
        return "bg-red-600";
      case "dot":
        return "bg-orange-500";
      case "jail":
        return "bg-purple-600";
      default:
        return "bg-gray-500";
    }
  };

  const focusOnPlayer = useCallback(
    (playerKey) => {
      const marker = markers[playerKey];
      if (!marker || !containerRef.current) return;
      const container = containerRef.current.getBoundingClientRect();
      setTransform({
        scale: 2,
        x: container.width / 2 - marker.x * 2,
        y: container.height / 2 - marker.y * 2
      });
    },
    [markers]
  );

  const togglePlayerPopup = (player) => {
    if (selectedPlayer?.Player === player.Player) {
      setSelectedPlayer(null);
    } else {
      setSelectedPlayer(player);
      focusOnPlayer(player.Player);
    }
  };

  const resetView = () => centerMap();

  // Generate meta description based on URL params
  const getMetaDescription = () => {
    const { user, team } = router.query;
    if (user) {
      return `Live tracking of player ${user} on City of London ERLC server`;
    }
    if (team) {
      return `Live tracking of ${team} team on City of London ERLC server`;
    }
    return "Live map tracking for City of London ERLC server - Track players, vehicles, and staff in real-time";
  };

  // Generate meta title based on URL params
  const getMetaTitle = () => {
    const { user, team } = router.query;
    if (user) {
      return `City of London - Tracking ${user}`;
    }
    if (team) {
      return `City of London - ${team} Team`;
    }
    return "City of London ERLC Live Map";
  };

  // Generate Open Graph image URL (you'll need to create an API endpoint for this)
  const getOGImageUrl = () => {
    const { user, team } = router.query;
    const baseUrl = "https://map.col-erlc.ca";

    if (user) {
      return `${baseUrl}/api/og?type=user&value=${encodeURIComponent(user)}`;
    }
    if (team) {
      return `${baseUrl}/api/og?type=team&value=${encodeURIComponent(team)}`;
    }
    return `${baseUrl}/api/og?type=default`;
  };

  return (
    <>
      <Head>
        <title>{getMetaTitle()}</title>
        <meta name="description" content={getMetaDescription()} />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta
          property="og:url"
          content={typeof window !== "undefined" ? window.location.href : ""}
        />
        <meta property="og:title" content={getMetaTitle()} />
        <meta property="og:description" content={getMetaDescription()} />
        <meta property="og:image" content={getOGImageUrl()} />
        <meta property="og:image:width" content="3121" />
        <meta property="og:image:height" content="3121" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={getMetaTitle()} />
        <meta name="twitter:description" content={getMetaDescription()} />
        <meta name="twitter:image" content={getOGImageUrl()} />

        {/* Additional meta tags for Discord */}
        <meta name="theme-color" content="#3B82F6" />
      </Head>

      <div className="flex h-screen overflow-hidden bg-gray-900 text-white">
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/70 z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
        <div
          className={`fixed top-0 left-0 h-full w-80 z-50 transform transition-transform duration-300 ease-in-out md:hidden overflow-y-auto ${
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="absolute inset-0 bg-gray-900/90 backdrop-blur-md" />
          <div className="relative p-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Menu</h2>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-8 h-8 bg-gray-800/80 rounded-lg flex items-center justify-center hover:bg-gray-700/80 backdrop-blur-sm border border-white/10"
              >
                <svg
                  className="w-5 h-5 text-white"
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
              </button>
            </div>
            <div className="space-y-4">
              <SidebarContent
                serverInfo={serverInfo}
                players={players}
                staff={staff}
                joinLogs={joinLogs}
                queue={queue}
                killLogs={killLogs}
                commandLogs={commandLogs}
                modCalls={modCalls}
                vehicles={vehicles}
                selectedPlayer={selectedPlayer}
                togglePlayerPopup={togglePlayerPopup}
                getTeamColor={getTeamColor}
                nameDisplay={nameDisplay}
                setSelectedPlayer={setSelectedPlayer}
              />
            </div>
          </div>
        </div>
        <div className="hidden md:block fixed top-4 left-4 w-96 z-40 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl">
          <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl" />
          <div className="relative p-5">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-white">
                  City Of London
                </h1>
                <p className="text-xs text-gray-400">Live Map</p>
              </div>
              <div className="flex items-center gap-2">
                {isLoading && (
                  <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                )}
              </div>
            </div>
            <SidebarContent
              serverInfo={serverInfo}
              players={players}
              staff={staff}
              joinLogs={joinLogs}
              queue={queue}
              killLogs={killLogs}
              commandLogs={commandLogs}
              modCalls={modCalls}
              vehicles={vehicles}
              selectedPlayer={selectedPlayer}
              togglePlayerPopup={togglePlayerPopup}
              getTeamColor={getTeamColor}
              nameDisplay={nameDisplay}
              setSelectedPlayer={setSelectedPlayer}
            />
          </div>
        </div>

        {/* Map Container */}
        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden bg-gray-900"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Mobile Header */}
          <div className="absolute top-0 left-0 right-0 z-20 md:hidden bg-gray-900/90 backdrop-blur-md p-3 border-b border-white/10">
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="w-10 h-10 bg-gray-800/80 rounded-lg flex items-center justify-center hover:bg-gray-700/80 border border-white/10 shrink-0"
              >
                <svg
                  className="w-6 h-6 text-white"
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
              </button>

              <h1 className="text-lg font-bold text-white truncate flex-1 text-center">
                City Of London
              </h1>

              <div className="flex items-center gap-1 shrink-0">
                {/* Player count */}
                <div className="bg-gray-800/80 px-2 py-1.5 rounded-lg border border-white/10 text-xs whitespace-nowrap">
                  <span
                    className={`
            ${
              serverInfo?.CurrentPlayers > 35
                ? "text-red-500"
                : serverInfo?.CurrentPlayers >= 30
                  ? "text-orange-500"
                  : serverInfo?.CurrentPlayers >= 10
                    ? "text-yellow-500"
                    : serverInfo?.CurrentPlayers === 0
                      ? "text-red-500"
                      : "text-green-500"
            }
          `}
                  >
                    {serverInfo?.CurrentPlayers || 0}
                  </span>
                  <span className="text-white/60">
                    /{serverInfo?.MaxPlayers || 0}
                  </span>
                </div>

                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="w-8 h-8 bg-gray-800/80 rounded-lg flex items-center justify-center hover:bg-gray-700/80 border border-white/10"
                >
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </button>

                <button
                  onClick={resetView}
                  className="w-8 h-8 bg-gray-800/80 rounded-lg flex items-center justify-center hover:bg-gray-700/80 border border-white/10"
                  title="Reset view"
                >
                  <svg
                    className="w-4 h-4 text-white"
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
                </button>
                <div className="bg-gray-800/80 px-2 py-1.5 rounded-lg border border-white/10 text-xs text-white">
                  {Math.round(transform.scale * 100)}%
                </div>
              </div>
            </div>
          </div>

          {/* Map Controls */}
          <div className="absolute top-4 right-4 z-10 flex gap-2">
            <div className="bg-gray-800 p-2 md:p-3 rounded-lg hover:bg-gray-700 border border-gray-700 shadow-lg">
              <span
                className={`${serverInfo?.CurrentPlayers > 35 ? "text-red-500" : serverInfo?.CurrentPlayers >= 30 ? "text-orange-500" : serverInfo?.CurrentPlayers >= 10 ? "text-yellow-500" : serverInfo?.CurrentPlayers === 0 ? "text-red-500" : "text-green-500"}`}
              >
                {serverInfo?.CurrentPlayers}
              </span>
              /{serverInfo?.MaxPlayers}
            </div>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="bg-gray-800 p-2 md:p-3 rounded-lg hover:bg-gray-700 border border-gray-700 shadow-lg"
            >
              <svg
                className="w-4 h-4 md:w-5 md:h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
            <button
              onClick={resetView}
              className="bg-gray-800 p-2 md:p-3 rounded-lg hover:bg-gray-700 border border-gray-700 shadow-lg"
              title="Reset view"
            >
              <svg
                className="w-4 h-4 md:w-5 md:h-5 text-white"
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
            </button>

            <div className="bg-gray-800 p-2 md:p-3 rounded-lg text-xs md:text-sm border border-gray-700 shadow-lg text-white">
              {Math.round(transform.scale * 100)}%
            </div>
          </div>

          {/* Map Image - Scaled container */}
          <div
            style={{
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
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
              className="select-none pointer-events-none"
              style={{
                width: MAP_IMAGE_SIZE,
                height: MAP_IMAGE_SIZE,
                display: "block"
              }}
              onLoad={() => centerMap()}
              onError={(e) => (e.target.src = MAP_STYLES["normal-locations"])}
            />
          </div>

          {/* Markers - Separate container, not scaled */}
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
              const screenX = m.x * transform.scale + transform.x;
              const screenY = m.y * transform.scale + transform.y;
              const baseSize = 15;
              const scaleFactor = 0.3 / transform.scale;
              const scaledSize = Math.max(
                12,
                Math.min(20, baseSize * Math.min(scaleFactor, 2))
              );

              return (
                <div
                  key={m.player.Player}
                  style={{
                    position: "absolute",
                    left: screenX,
                    top: screenY,
                    transform: "translate(-50%, -50%)",
                    zIndex:
                      selectedPlayer?.Player === m.player.Player ? 30 : 10,
                    pointerEvents: "auto"
                  }}
                  onMouseEnter={() => {
                    if (nameDisplay === "hover") {
                      setSelectedPlayer(m.player);
                    }
                  }}
                  onMouseLeave={() => {
                    if (nameDisplay === "hover") {
                      setSelectedPlayer(null);
                    }
                  }}
                >
                  {/* Username - Above the icon */}
                  {(nameDisplay === "always" ||
                    selectedPlayer?.Player === m.player.Player) && (
                    <div
                      className="absolute whitespace-nowrap"
                      style={{
                        left: "50%",
                        bottom: "100%",
                        transform: "translateX(-50%)",
                        marginBottom: "4px",
                        zIndex: 40
                      }}
                    >
                      <div className="bg-gray-900/90 backdrop-blur-sm px-2 py-1 rounded text-xs text-white border border-gray-700 shadow-lg">
                        {m.player.Player.split(":")[0]} ({m.player?.Callsign})
                      </div>
                    </div>
                  )}

                  {/* Player Icon */}
                  <div
                    className={`rounded-full border-2 border-white cursor-pointer transition-all hover:brightness-110 ${getTeamColor(m.team)} ${
                      selectedPlayer?.Player === m.player.Player
                        ? "ring-2 ring-white"
                        : ""
                    }`}
                    style={{
                      width: `${scaledSize}px`,
                      height: `${scaledSize}px`,
                      boxShadow: "0 2px 4px rgba(0,0,0,0.3)"
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePlayerPopup(m.player);
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Player Popup */}
          {selectedPlayer && (
            <div className="absolute bottom-4 right-4 bg-gray-800 p-5 rounded-xl w-80 z-50 border border-gray-700 shadow-2xl">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl ${getTeamColor(selectedPlayer.Team)} flex items-center justify-center text-2xl shadow-lg`}
                  >
                    👤
                  </div>
                  <div>
                    <div className="font-bold text-lg">
                      {selectedPlayer.Player.split(":")[0]}
                    </div>
                    <span className="text-xs text-gray-400">
                      {selectedPlayer.Team}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPlayer(null)}
                  className="text-gray-400 hover:text-white"
                >
                  <svg
                    className="w-5 h-5"
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
                </button>
              </div>

              {selectedPlayer.Location && (
                <div className="border-t border-gray-700 pt-3">
                  <h3 className="text-sm text-gray-400 mb-2">Location</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-900 rounded-lg p-2 text-center">
                      <div className="text-xs text-gray-400">X</div>
                      <div className="font-mono">
                        {Math.round(selectedPlayer.Location.LocationX)}
                      </div>
                    </div>
                    <div className="bg-gray-900 rounded-lg p-2 text-center">
                      <div className="text-xs text-gray-400">Z</div>
                      <div className="font-mono">
                        {Math.round(selectedPlayer.Location.LocationZ)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => setSelectedPlayer(null)}
                className="mt-4 w-full py-2 bg-gray-700 rounded-lg hover:bg-gray-600 text-sm transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>

        {/* Settings Modal */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          mapStyle={mapStyle}
          setMapStyle={setMapStyle}
          nameDisplay={nameDisplay}
          setNameDisplay={setNameDisplay}
          MAP_STYLES={MAP_STYLES}
        />
      </div>
    </>
  );
}

const SidebarContent = ({
  serverInfo,
  players,
  staff,
  joinLogs,
  queue,
  killLogs,
  commandLogs,
  modCalls,
  vehicles,
  selectedPlayer,
  togglePlayerPopup,
  getTeamColor,
  nameDisplay,
  setSelectedPlayer
}) => {
  return (
    <div className="space-y-4">
      <Dropdown title="Server Status" icon="🖥️">
        <ServerStatusContent serverInfo={serverInfo} />
      </Dropdown>

      {players.length > 0 && (
        <Dropdown
          title={`Players (${Object.values(players).reduce((sum, team) => sum + team.length, 0)})`}
          icon="👥"
          defaultOpen={true}
        >
          <PlayersContent
            players={players}
            selectedPlayer={selectedPlayer}
            togglePlayerPopup={togglePlayerPopup}
            getTeamColor={getTeamColor}
            nameDisplay={nameDisplay}
            setSelectedPlayer={setSelectedPlayer}
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
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="bg-gray-700/50 rounded-lg overflow-hidden border border-gray-600">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-600 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-white">{icon}</span>
          <span className="font-medium text-white">{title}</span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-300 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
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
      <div
        className={`transition-all duration-300 ease-in-out ${isOpen ? "max-h-96" : "max-h-0"} overflow-y-auto`}
      >
        <div className="p-4 border-t border-gray-600">{children}</div>
      </div>
    </div>
  );
};

const ServerStatusContent = ({ serverInfo }) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-300">Server Name</span>
      <span className="text-sm font-medium text-white">{serverInfo?.Name}</span>
    </div>
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-300">Players</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-white">
          {serverInfo?.CurrentPlayers}/{serverInfo?.MaxPlayers}
        </span>
        <div className="w-16 h-1.5 bg-gray-600 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${serverInfo?.CurrentPlayers / serverInfo?.MaxPlayers > 0.8 ? "bg-red-500" : "bg-green-500"}`}
            style={{
              width: `${((serverInfo?.CurrentPlayers || 0) / (serverInfo?.MaxPlayers || 1)) * 100}%`
            }}
          />
        </div>
      </div>
    </div>
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-300">Join Key</span>
      <span className="font-mono text-xs bg-gray-900 px-2 py-1 rounded text-green-400">
        {serverInfo?.JoinKey || "N/A"}
      </span>
    </div>
  </div>
);

const PlayersContent = ({
  players,
  selectedPlayer,
  togglePlayerPopup,
  getTeamColor,
  nameDisplay,
  setSelectedPlayer
}) => (
  <div className="space-y-4">
    {Object.entries(players).map(([team, members]) => (
      <div key={team}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${getTeamColor(team)}`} />
            <span className="text-sm font-medium text-gray-300">{team}</span>
          </div>
          <span className="text-xs bg-gray-600 px-2 py-0.5 rounded-full text-gray-300">
            {members.length}
          </span>
        </div>
        <div className="space-y-1">
          {members.map((player) => (
            <div
              key={player.Player}
              onClick={() => togglePlayerPopup(player)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${selectedPlayer?.Player === player.Player ? "bg-gray-600" : "hover:bg-gray-600"}`}
              onMouseEnter={() => {
                if (nameDisplay === "hover") {
                  setSelectedPlayer(player);
                }
              }}
              onMouseLeave={() => {
                if (nameDisplay === "hover") {
                  setSelectedPlayer(null);
                }
              }}
            >
              <div className={`w-2 h-2 rounded-full ${getTeamColor(team)}`} />
              <span className="flex-1 text-sm text-gray-200 truncate">
                {player.Player.split(":")[0]}
              </span>
              {player.Location && (
                <span className="text-xs text-gray-400">
                  {player.Location?.BuildingNumber}{" "}
                  {player.Location?.StreetName}, ({player.Location?.PostalCode})
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

const StaffContent = ({ staff }) => (
  <div className="space-y-4">
    {["Admins", "Mods", "Helpers"].map((role) => (
      <div key={role}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-300">{role}</span>
          <span className="text-xs bg-gray-600 px-2 py-0.5 rounded-full text-gray-300">
            {staff[role] ? Object.keys(staff[role]).length : 0}
          </span>
        </div>
        <div className="space-y-1">
          {staff[role] &&
            Object.values(staff[role]).map((name, i) => (
              <div
                key={i}
                className="px-3 py-1.5 text-sm text-gray-300 bg-gray-600 rounded-lg"
              >
                {name}
              </div>
            ))}
        </div>
      </div>
    ))}
  </div>
);

const JoinLogsContent = ({ joinLogs }) => (
  <div className="space-y-1">
    {joinLogs.slice(0, 20).map((log, i) => (
      <div
        key={i}
        className="flex items-center gap-2 px-2 py-1.5 text-xs bg-gray-600 rounded border border-gray-500"
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${log.Join ? "bg-green-500" : "bg-red-500"}`}
        />
        <span className="text-blue-300">{log.Player?.split(":")[0]}</span>
        <span className="text-gray-400">({log.Player?.split(":")[1]})</span>
        <span className="text-gray-400">{log.Join ? "joined" : "left"}</span>
        <span className="text-gray-500 ml-auto">
          {new Date(log.Timestamp * 1000).toLocaleTimeString()}
        </span>
      </div>
    ))}
  </div>
);

const QueueContent = ({ queue }) => (
  <div className="space-y-1">
    {queue.slice(0, 20).map((player, i) => (
      <div
        key={i}
        className="flex items-center gap-2 px-2 py-1.5 text-xs bg-gray-600 rounded border border-gray-500"
      >
        <span className="text-gray-400">#{i + 1}</span>
        <span className="text-yellow-300">{player}</span>
      </div>
    ))}
  </div>
);

const KillLogsContent = ({ killLogs }) => (
  <div className="space-y-1">
    {killLogs.slice(0, 20).map((kill, i) => (
      <div
        key={i}
        className="flex items-center gap-1 px-2 py-1.5 text-xs bg-gray-600 rounded border border-gray-500"
      >
        <span className="text-red-300">
          {kill.Killer?.split(":")[0] || "?"}
        </span>
        <span className="text-gray-400">→</span>
        <span className="text-green-300">
          {kill.Killed?.split(":")[0] || "?"}
        </span>
        <span className="text-gray-500 ml-auto">
          {new Date(kill.Timestamp * 1000).toLocaleTimeString()}
        </span>
      </div>
    ))}
  </div>
);

const CommandLogsContent = ({ commandLogs }) => (
  <div className="space-y-1">
    {commandLogs.slice(0, 20).map((cmd, i) => (
      <div
        key={i}
        className="px-2 py-1.5 text-xs bg-gray-600 rounded border border-gray-500"
      >
        <span className="text-purple-300">{cmd.Player?.split(":")[0]}</span>
        <span className="text-gray-400 ml-1">
          ({cmd.Player?.split(":")[1]})
        </span>
        <span className="text-gray-300 ml-2">"{cmd.Command}"</span>
        <span className="text-gray-500 float-right">
          {new Date(cmd.Timestamp * 1000).toLocaleTimeString()}
        </span>
      </div>
    ))}
  </div>
);

const ModCallsContent = ({ modCalls }) => (
  <div className="space-y-1">
    {modCalls.slice(0, 20).map((call, i) => (
      <div
        key={i}
        className="flex items-center gap-1 px-2 py-1.5 text-xs bg-gray-600 rounded border border-gray-500"
      >
        <span className="text-yellow-300">{call.Caller?.split(":")[0]}</span>
        <span className="text-gray-400">→</span>
        <span className="text-purple-300">{call.Moderator?.split(":")[0]}</span>
        <span className="text-gray-500 ml-auto">
          {new Date(call.Timestamp * 1000).toLocaleTimeString()}
        </span>
      </div>
    ))}
  </div>
);

const VehiclesContent = ({ vehicles }) => (
  <div className="space-y-1">
    {vehicles.slice(0, 20).map((vehicle, i) => (
      <div
        key={i}
        className="relative bg-gray-600 rounded border border-gray-500 overflow-hidden"
      >
        {/* Color bar */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5"
          style={{ backgroundColor: vehicle.ColorHex || "#888" }}
        />

        <div className="pl-4 p-2">
          <div className="flex items-center justify-between">
            <span className="text-cyan-300 text-xs">{vehicle.Name}</span>
            {vehicle.Texture && vehicle.Texture !== "Livery Name" && (
              <span className="text-gray-400 text-[10px]">
                {vehicle.Texture}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between mt-1">
            <span className="text-gray-400 text-[10px]">{vehicle.Owner}</span>
            {vehicle.ColorName && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: `${vehicle.ColorHex}20`,
                  color: vehicle.ColorHex
                }}
              >
                {vehicle.ColorName}
              </span>
            )}
          </div>
        </div>
      </div>
    ))}
  </div>
);

const SettingsModal = ({
  isOpen,
  onClose,
  mapStyle,
  setMapStyle,
  nameDisplay,
  setNameDisplay,
  MAP_STYLES
}) => {
  const [showLocations, setShowLocations] = useState(
    mapStyle.includes("locations")
  );
  const [mapBase, setMapBase] = useState(
    mapStyle.includes("winter") ? "winter" : "normal"
  );
  useEffect(() => {
    if (showLocations) {
      setMapStyle(`${mapBase}-locations`);
    } else {
      setMapStyle(mapBase);
    }
  }, [mapBase, showLocations, setMapStyle]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-gray-800 rounded-xl w-full max-w-md border border-gray-700 shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg
              className="w-6 h-6"
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
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Map Theme - Toggle Switch */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-400">
                Map Theme
              </label>
              <button
                onClick={() =>
                  setMapBase(mapBase === "normal" ? "winter" : "normal")
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  mapBase === "winter" ? "bg-blue-600" : "bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    mapBase === "winter" ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Toggle between normal and winter map themes.
            </p>
          </div>

          {/* Locations - Toggle Switch */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-400">
                Locations
              </label>
              <button
                onClick={() => setShowLocations(!showLocations)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  showLocations ? "bg-blue-600" : "bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showLocations ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Show or hide postal codes and street names on the map.
            </p>
          </div>

          {/* Player Names - Toggle Switch */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-400">
                Player Names
              </label>
              <button
                onClick={() =>
                  setNameDisplay(nameDisplay === "hover" ? "always" : "hover")
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  nameDisplay === "always" ? "bg-blue-600" : "bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    nameDisplay === "always" ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Always show player names or only on hover/click.
            </p>
          </div>
        </div>

        <div className="p-6 border-t border-gray-700">
          <button
            onClick={onClose}
            className="w-full py-3 bg-blue-600 rounded-lg text-white font-medium hover:bg-blue-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
