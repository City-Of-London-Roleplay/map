// pages/index.js
import { useEffect, useState, useRef, useCallback } from "react";

export default function Home() {
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
  const [mapSize, setMapSize] = useState({ width: 3121, height: 3121 });

  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const lastOffset = useRef({ x: 0, y: 0 });

  const [transform, setTransform] = useState({
    scale: 1,
    x: 0,
    y: 0
  });

  const MAP_SIZE = 3121; // Game world size
  const MAP_IMAGE_SIZE = 3121; // Image pixel size

  // Fetch data
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

      // Calculate markers
      const newMarkers = {};
      Object.entries(playersRes).forEach(([team, members]) => {
        members.forEach((p) => {
          if (p.Location) {
            const { x, y } = worldToMap(
              p.Location.LocationX,
              p.Location.LocationZ
            );
            newMarkers[p.Player] = {
              x,
              y,
              player: p,
              team,
              id: p.Player
            };
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
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Center map on initial load
  useEffect(() => {
    if (containerRef.current && mapRef.current) {
      centerMap();
    }
  }, [mapRef.current]);

  // Convert world coords to map coords
  const worldToMap = (x, z) => {
    // Game world: (0,0) to (3000,3000) where 0,0 is bottom left
    // Map image: (0,0) to (3121,3121) where 0,0 is top left
    return {
      x: (x / MAP_SIZE) * MAP_IMAGE_SIZE,
      y: (z / MAP_SIZE) * MAP_IMAGE_SIZE // Flip Y
    };
  };

  const centerMap = () => {
    if (!containerRef.current || !mapRef.current) return;

    const container = containerRef.current.getBoundingClientRect();
    const mapWidth = MAP_IMAGE_SIZE;
    const mapHeight = MAP_IMAGE_SIZE;

    setTransform({
      scale: 0.3,
      x: (container.width - mapWidth) / 2,
      y: (container.height - mapHeight) / 2
    });
  };

  // Map drag handlers
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    isDragging.current = true;
    dragStart.current = {
      x: e.clientX - transform.x,
      y: e.clientY - transform.y
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    e.preventDefault();

    setTransform((prev) => ({
      ...prev,
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
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

    // Calculate mouse position relative to map
    const mapX = (mouseX - transform.x) / transform.scale;
    const mapY = (mouseY - transform.y) / transform.scale;

    // Calculate new scale
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(0.3, transform.scale * delta), 3);

    // Adjust offset to zoom towards mouse
    setTransform({
      scale: newScale,
      x: mouseX - mapX * newScale,
      y: mouseY - mapY * newScale
    });
  };

  const getTeamColor = (team) => {
    switch (team?.toLowerCase()) {
      case "police":
        return "bg-blue-500";
      case "sheriff":
        return "bg-green-900";
      case "fire":
        return "bg-red-600";
      case "dot":
        return "bg-orange-500";
      default:
        return "bg-gray-500";
    }
  };

  const getTeamBadgeColor = (team) => {
    switch (team?.toLowerCase()) {
      case "police":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "sheriff":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "fire":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "dot":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  const focusOnPlayer = useCallback(
    (playerKey) => {
      const marker = markers[playerKey];
      if (!marker || !containerRef.current) return;

      const container = containerRef.current.getBoundingClientRect();

      setTransform({
        scale: 2, // Zoom in a bit when focusing
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

  const resetView = () => {
    centerMap();
  };

  // --- Render ---
  return (
    <div className="flex h-screen overflow-hidden bg-gray-900 text-white">
      {/* Sidebar */}
      <div className="w-96 b backdrop-blur-xl p-5 overflow-y-auto space-y-4 shadow-2xl scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
        {/* Header with glass morphism */}
        <div className="flex items-center justify-between mb-8 relative">
          <div className="relative flex items-center gap-3">
            <div>
              <h1 className="text-4xl font-bold tracking-tight">
                <span className="bg-gradient-to-r from-green-600 to-green-500 bg-clip-text text-transparent">
                  City{" "}
                </span>
                <span className="bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">
                  Of{" "}
                </span>
                <span className="bg-gradient-to-r from-gray-400 to-gray-300 bg-clip-text text-transparent">
                  London
                </span>
              </h1>
              <p className="text-xs text-gray-400">Live Map</p>
            </div>
          </div>
          {isLoading && (
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500 rounded-full blur-md opacity-50 animate-pulse"></div>
              <div className="relative w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>

        <Dropdown title="Server Status" icon="🖥️" accentColor="green">
          <div className="relative bg-gray-800/90 rounded-xl p-5 mt-4 border border-white/10 shadow-lg backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                SERVER STATUS
              </h2>
              <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium border border-green-500/30">
                ONLINE
              </span>
            </div>

            <div className="space-y-3">
              {/* Server Name */}
              <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-white/5">
                <span className="text-gray-400 flex items-center gap-2 text-sm">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                  Server Name
                </span>
                <span className="font-medium text-white text-sm truncate max-w-[180px]">
                  {serverInfo?.Name}
                </span>
              </div>

              {/* Players */}
              <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-white/5">
                <span className="text-gray-400 flex items-center gap-2 text-sm">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                  Players
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-white text-sm">
                    {serverInfo?.CurrentPlayers}/{serverInfo?.MaxPlayers}
                  </span>
                  <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        serverInfo?.CurrentPlayers / serverInfo?.MaxPlayers >
                        0.8
                          ? "bg-red-500"
                          : "bg-green-500"
                      }`}
                      style={{
                        width: `${((serverInfo?.CurrentPlayers || 0) / (serverInfo?.MaxPlayers || 1)) * 100}%`
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Join Key */}
              <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg border border-white/5">
                <span className="text-gray-400 flex items-center gap-2 text-sm">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                    />
                  </svg>
                  Join Key
                </span>
                <span className="font-mono text-xs bg-gray-900 px-3 py-1.5 rounded-lg border border-white/10 text-green-400">
                  {serverInfo?.JoinKey || "N/A"}
                </span>
              </div>
            </div>
          </div>
        </Dropdown>

        {/* Players Section with enhanced styling */}
        <Dropdown
          title={`Players (${Object.values(players).reduce((sum, team) => sum + team.length, 0)})`}
          icon={
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
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          }
          defaultOpen={true}
          accentColor="blue"
        >
          {Object.entries(players).map(([team, members]) => (
            <div key={team} className="mb-4 last:mb-0">
              <div className="flex items-center justify-between my-2 px-2">
                <span className="font-semibold text-sm uppercase tracking-wider text-gray-400">
                  {team}
                </span>
                <span className="text-xs bg-gray-700 px-2 py-1 rounded-full text-gray-300 border border-white/5">
                  {members.length}
                </span>
              </div>
              <div className="space-y-1">
                {members.map((player) => (
                  <div
                    key={player.Player}
                    className={`group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 
                ${
                  selectedPlayer?.Player === player.Player
                    ? "bg-gradient-to-r from-blue-600/30 to-purple-600/30 border border-blue-500/50 shadow-lg shadow-blue-500/10"
                    : "hover:bg-white/5 border border-transparent"
                }`}
                    onClick={() => togglePlayerPopup(player)}
                  >
                    <div
                      className={`w-2.5 h-2.5 rounded-full shadow-lg ${getTeamColor(team)}`}
                    ></div>
                    <span className="flex-1 truncate text-sm font-medium text-gray-200">
                      {player.Player.split(":")[0]}
                    </span>
                    {player.Location && (
                      <span className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">
                        📍
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Dropdown>

        {/* Staff Section */}
        <Dropdown
          title={`Staff (${["Admins", "Mods", "Helpers"].reduce((sum, r) => sum + (staff[r] ? Object.keys(staff[r]).length : 0), 0)})`}
          icon={
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
                d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
          accentColor="purple"
        >
          {["Admins", "Mods", "Helpers"].map((role) => (
            <div key={role} className="mb-4 last:mb-0">
              <div className="flex items-center justify-between my-2 px-2">
                <span className="font-semibold text-sm uppercase tracking-wider text-gray-400">
                  {role}
                </span>
                <span className="text-xs bg-gray-700 px-2 py-1 rounded-full text-gray-300 border border-white/5">
                  {staff[role] ? Object.keys(staff[role]).length : 0}
                </span>
              </div>
              <div className="space-y-1">
                {staff[role] &&
                  Object.values(staff[role]).map((name, i) => (
                    <div
                      key={i}
                      className="px-3 py-1.5 text-sm text-gray-300 hover:bg-white/5 rounded-lg transition-colors truncate border border-transparent hover:border-white/5"
                    >
                      {name}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </Dropdown>

        {/* Join Logs */}
        <Dropdown
          title={`Join Logs (${joinLogs.length})`}
          icon="📝"
          accentColor="blue"
        >
          <div className="space-y-1 mt-3">
            {joinLogs.slice(0, 20).map((log, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-2 py-1.5 text-xs bg-white/5 rounded border border-white/5"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${log.Join ? "bg-green-500" : "bg-red-500"}`}
                ></span>
                <span className="text-blue-300 font-medium">
                  {log.Player?.split(":")[0]}
                </span>
                <span className="text-white/40">
                  ({log.Player?.split(":")[1]})
                </span>
                <span className="text-white/40">
                  {log.Join ? "joined" : "left"}
                </span>
                <span className="text-white/30 ml-auto text-[10px]">
                  {new Date(log.Timestamp * 1000).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </Dropdown>

        {/* Queue */}
        <Dropdown
          title={`Queue (${queue.length})`}
          icon="⏳"
          accentColor="yellow"
        >
          <div className="space-y-1 mt-3">
            {queue.slice(0, 20).map((player, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-2 py-1.5 text-xs bg-white/5 rounded border border-white/5"
              >
                <span className="text-white/40">#{i + 1}</span>
                <span className="text-yellow-300 font-medium">{player}</span>
              </div>
            ))}
          </div>
        </Dropdown>

        {/* Kill Logs */}
        <Dropdown
          title={`Kill Logs (${killLogs.length})`}
          icon="💀"
          accentColor="red"
        >
          <div className="space-y-1 mt-3">
            {killLogs.slice(0, 20).map((kill, i) => (
              <div
                key={i}
                className="flex items-center gap-1 px-2 py-1.5 text-xs bg-white/5 rounded border border-white/5"
              >
                <span className="text-red-300 font-medium">
                  {kill.Killer?.split(":")[0] || "?"}
                </span>
                <span className="text-white/40">→</span>
                <span className="text-green-300 font-medium">
                  {kill.Killed?.split(":")[0] || "?"}
                </span>
                <span className="text-white/30 ml-auto text-[10px]">
                  {new Date(kill.Timestamp * 1000).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </Dropdown>

        {/* Command Logs */}
        <Dropdown
          title={`Commands (${commandLogs.length})`}
          icon="⌨️"
          accentColor="purple"
        >
          <div className="space-y-1 mt-3">
            {commandLogs.slice(0, 20).map((cmd, i) => (
              <div
                key={i}
                className="px-2 py-1.5 text-xs bg-white/5 rounded border border-white/5"
              >
                <span className="text-purple-300 font-medium">
                  {cmd.Player?.split(":")[0]}
                </span>
                <span className="text-white/40 ml-1">
                  ({cmd.Player?.split(":")[1]})
                </span>
                <span className="text-white/60 ml-2">"{cmd.Command}"</span>
                <span className="text-white/30 float-right text-[10px]">
                  {new Date(cmd.Timestamp * 1000).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </Dropdown>

        {/* Mod Calls */}
        <Dropdown
          title={`Mod Calls (${modCalls.length})`}
          icon="📢"
          accentColor="pink"
        >
          <div className="space-y-1 mt-3">
            {modCalls.slice(0, 20).map((call, i) => (
              <div
                key={i}
                className="flex items-center gap-1 px-2 py-1.5 text-xs bg-white/5 rounded border border-white/5"
              >
                <span className="text-yellow-300 font-medium">
                  {call.Caller?.split(":")[0]}
                </span>
                <span className="text-white/40">→</span>
                <span className="text-purple-300 font-medium">
                  {call.Moderator?.split(":")[0]}
                </span>
                <span className="text-white/30 ml-auto text-[10px]">
                  {new Date(call.Timestamp * 1000).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </Dropdown>

        {/* Vehicles - With Color Bar */}
        <Dropdown
          title={`Vehicles (${vehicles.length})`}
          icon="🚗"
          accentColor="cyan"
        >
          <div className="space-y-1 mt-3">
            {vehicles.slice(0, 20).map((vehicle, i) => (
              <div
                key={i}
                className="relative bg-white/5 rounded border border-white/5 overflow-hidden"
              >
                {/* Color bar on left */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1.5"
                  style={{ backgroundColor: vehicle.ColorHex || "#888" }}
                />

                {/* Vehicle details */}
                <div className="pl-4 p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-cyan-300 font-medium text-xs">
                      {vehicle.Name}
                    </span>
                    {vehicle.Texture && vehicle.Texture !== "Livery Name" && (
                      <span className="text-white/30 text-[10px]">
                        {vehicle.Texture}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <span className="text-white/60 text-[10px]">
                      {vehicle.Owner}
                    </span>
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
        </Dropdown>
      </div>

      {/* Map Container */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-gray-900"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Map Controls */}
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <button
            onClick={resetView}
            className="bg-gray-800/90 backdrop-blur-sm p-3 rounded-lg hover:bg-gray-700/90 transition-all shadow-lg border border-gray-700/50"
            title="Reset view"
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
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
          <div className="bg-gray-800/90 backdrop-blur-sm px-3 py-2 rounded-lg text-sm border border-gray-700/50">
            Zoom: {Math.round(transform.scale * 100)}%
          </div>
        </div>

        {/* Map Image with Transform */}
        <div
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: "0 0",
            position: "absolute",
            top: 0,
            left: 0,
            cursor: isDragging.current ? "grabbing" : "grab",
            transition: isDragging.current ? "none" : "transform 0.1s ease-out",
            width: MAP_IMAGE_SIZE,
            height: MAP_IMAGE_SIZE,
            willChange: "transform"
          }}
          onMouseDown={handleMouseDown}
        >
          <img
            ref={mapRef}
            src="/erlc-map.png"
            alt="Map"
            draggable={false}
            className="select-none pointer-events-none"
            style={{
              width: MAP_IMAGE_SIZE,
              height: MAP_IMAGE_SIZE,
              display: "block"
            }}
            onLoad={() => centerMap()}
          />

          {/* Markers */}
          {Object.values(markers).map((m) => (
            <div
              key={m.player.Player}
              className={`absolute w-5 h-5 rounded-full border-2 border-white shadow-lg cursor-pointer transition-all hover:scale-150 ${getTeamColor(
                m.team
              )} ${
                selectedPlayer?.Player === m.player.Player
                  ? "scale-150 ring-4 ring-white/50 z-20"
                  : "z-10"
              }`}
              style={{
                left: m.x - 10,
                top: m.y - 10,
                boxShadow: "0 2px 10px rgba(0,0,0,0.3)"
              }}
              onClick={() => togglePlayerPopup(m.player)}
            />
          ))}
        </div>

        {/* Player Popup */}
        {selectedPlayer && (
          <div className="absolute bottom-4 right-4 bg-gray-800/95 backdrop-blur-sm p-5 rounded-xl shadow-2xl w-80 z-50 border border-gray-700/50">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-xl ${getTeamColor(selectedPlayer.Team)} flex items-center justify-center text-2xl shadow-lg`}
                >
                  👤
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-lg truncate">
                    {selectedPlayer.Player.split(":")[0]}
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${getTeamBadgeColor(selectedPlayer.Team)}`}
                  >
                    {selectedPlayer.Team}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedPlayer(null)}
                className="text-gray-400 hover:text-white transition-colors"
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
              <div className="space-y-2 border-t border-gray-700 pt-3">
                <h3 className="text-sm font-semibold text-gray-300 mb-2">
                  Location
                </h3>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-gray-700/50 rounded-lg p-2">
                    <div className="text-xs text-gray-400">X</div>
                    <div className="font-mono text-sm">
                      {Math.round(selectedPlayer.Location.LocationX)}
                    </div>
                  </div>

                  <div className="bg-gray-700/50 rounded-lg p-2">
                    <div className="text-xs text-gray-400">Z</div>
                    <div className="font-mono text-sm">
                      {Math.round(selectedPlayer.Location.LocationZ)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setSelectedPlayer(null)}
              className="mt-4 w-full py-2 bg-gradient-to-r from-red-600 to-red-700 rounded-lg hover:from-red-700 hover:to-red-800 transition-all text-sm font-medium shadow-lg"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Modern Dropdown Component
const Dropdown = ({
  title,
  icon,
  children,
  defaultOpen = false,
  accentColor = "blue"
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const accentColors = {
    blue: "from-blue-600 to-blue-400",
    purple: "from-purple-600 to-purple-400",
    green: "from-green-600 to-green-400",
    red: "from-red-600 to-red-400"
  };

  return (
    <div className="relative group">
      <div
        className={`absolute -inset-0.5 bg-gradient-to-r ${accentColors[accentColor]} rounded-xl blur opacity-20 group-hover:opacity-30 transition duration-300`}
      ></div>
      <div className="relative bg-gray-800/90 rounded-xl border border-white/10 overflow-hidden backdrop-blur-sm">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-lg bg-gradient-to-br ${accentColors[accentColor]} bg-opacity-20 flex items-center justify-center`}
            >
              <span className="text-white">{icon}</span>
            </div>
            <span className="font-semibold text-white">{title}</span>
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
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
          className={`transition-all duration-300 ease-in-out ${isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"} overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent`}
        >
          <div className="p-4 pt-0 border-t border-white/5">{children}</div>
        </div>
      </div>
    </div>
  );
};
