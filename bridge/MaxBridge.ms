-- =====================================================================
-- MaxBridge.ms — слушатель очереди HeightmapGen Bridge.
--
-- Опрашивает %TEMP%/HeightmapGen/queue/ каждые 500мс через WinForms Timer
-- (фаер на UI-потоке, безопасно для MAXScript).
--
-- Использование:
--   1. Запустить server.py на этом же ПК
--   2. В 3ds Max: Scripting → Run Script → выбрать этот файл
--   3. (опционально) Скопировать MaxBridge.ms в:
--        %LOCALAPPDATA%\Autodesk\3dsMax\<version>\ENU\scripts\Startup\
--      чтобы автозагружался при старте Max.
--
-- Управление в командной строке:
--   hgStop()    — остановить watcher
--   hgStart()   — стартовать (если был остановлен)
--   hgStatus()  — текущее состояние
-- =====================================================================

global hgBridgeTimer
global hgBridgeQueueDir

fn hgGetQueueDir = (
  local d = (sysInfo.tempdir + "HeightmapGen\\queue\\")
  if not (doesDirectoryExist d) do makeDir d all:true
  d
)

fn hgProcessOnce = (
  if hgBridgeQueueDir == undefined do hgBridgeQueueDir = hgGetQueueDir()
  local triggers = getFiles (hgBridgeQueueDir + "*.trigger")
  for t in triggers do (
    local msPath = (substituteString t ".trigger" ".ms")
    try (
      if doesFileExist msPath then (
        format "[HG] applying %\n" (filenameFromPath msPath)
        fileIn msPath
      ) else (
        format "[HG] missing .ms for %\n" t
      )
    ) catch (
      format "[HG] error: %\n" (getCurrentException())
    )
    try (deleteFile t) catch ()
    try (deleteFile msPath) catch ()
  )
)

fn hgStop = (
  if hgBridgeTimer != undefined do (
    try (
      hgBridgeTimer.Enabled = false
      hgBridgeTimer.Dispose()
    ) catch ()
    hgBridgeTimer = undefined
    print "[HG] bridge watcher: stopped"
  )
)

fn hgStart = (
  if hgBridgeTimer != undefined and hgBridgeTimer.Enabled do (
    print "[HG] bridge watcher: already running"
    return ok
  )
  hgBridgeQueueDir = hgGetQueueDir()
  hgBridgeTimer = dotNetObject "System.Windows.Forms.Timer"
  hgBridgeTimer.Interval = 500
  dotNet.addEventHandler hgBridgeTimer "Tick" hgProcessOnce
  hgBridgeTimer.Enabled = true
  format "[HG] bridge watcher: started (poll % every %ms)\n" hgBridgeQueueDir 500
)

fn hgStatus = (
  local running = (hgBridgeTimer != undefined and hgBridgeTimer.Enabled)
  format "[HG] bridge watcher: % | queue: %\n" \
    (if running then "running" else "stopped") \
    (if hgBridgeQueueDir != undefined then hgBridgeQueueDir else "(none)")
)

callbacks.removeScripts id:#hgBridge
callbacks.addScript #systemPostReset "hgStart()" id:#hgBridge

hgStart()
