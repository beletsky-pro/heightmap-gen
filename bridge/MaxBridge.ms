-- =====================================================================
-- MaxBridge.ms — слушатель очереди HeightmapGen Bridge.
--
-- Делает две вещи:
--   1. Каждые 500 мс через WinForms Timer проверяет %TEMP%/HeightmapGen/queue/
--      и применяет любой найденный *.ms (триггерится по *.trigger файлу).
--   2. По #selectionSetChanged callback пишет инфу о текущем выделении в
--      %TEMP%/HeightmapGen/selection.json — веб-приложение опрашивает её
--      через bridge и подсказывает значения displace strength по bbox.
--
-- Установка:
--   1. Запустить bridge/run.cmd (или server.py) на этом же ПК.
--   2. В 3ds Max: Scripting → Run Script → выбрать этот файл.
--   3. (опционально) Скопировать MaxBridge.ms в:
--        %LOCALAPPDATA%\Autodesk\3dsMax\<version>\ENU\scripts\Startup\
--      чтобы автозагружался при старте Max.
--
-- Управление:
--   hgStop() | hgStart() | hgStatus() | hgPushSelection()
-- =====================================================================

global hgBridgeTimer
global hgBridgeQueueDir
global hgBridgeSelectionPath

fn hgGetRoot = (
  local d = (sysInfo.tempdir + "HeightmapGen\\")
  if not (doesDirectoryExist d) do makeDir d all:true
  d
)

fn hgGetQueueDir = (
  local d = (hgGetRoot()) + "queue\\"
  if not (doesDirectoryExist d) do makeDir d all:true
  d
)

fn hgGetSelectionPath = (
  (hgGetRoot()) + "selection.json"
)

-- ---- Queue processing ------------------------------------------------
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

-- ---- Selection info writer -------------------------------------------
fn hgEscapeJsonStr s = (
  -- Очень простой эскейп, достаточный для имени объекта и system unit-строк.
  s = substituteString s "\\" "\\\\"
  s = substituteString s "\""  "\\\""
  s
)

fn hgPushSelection = (
  if hgBridgeSelectionPath == undefined do hgBridgeSelectionPath = hgGetSelectionPath()
  local f = createFile hgBridgeSelectionPath
  if f == undefined do return ok
  try (
    if selection.count == 0 then (
      format "{\"hasSelection\":false}" to:f
    ) else (
      local obj = selection[1]
      local bb = obj.boundingBox
      local mn = bb.min
      local mx = bb.max
      local sz = mx - mn
      local cls = classOf obj.baseObject as string
      -- Face selection?
      local faceCount = 0
      try (
        if classOf obj.baseObject == Editable_Poly then (
          local s = polyop.getFaceSelection obj
          if s != undefined then faceCount = s.numberSet
        ) else if classOf obj.baseObject == Editable_Mesh then (
          local s = getFaceSelection obj
          if s != undefined then faceCount = s.numberSet
        )
      ) catch ()
      local unit = units.SystemType as string
      format "{" to:f
      format "\"hasSelection\":true," to:f
      format "\"name\":\"%\"," (hgEscapeJsonStr obj.name) to:f
      format "\"class\":\"%\"," (hgEscapeJsonStr cls) to:f
      format "\"bboxMin\":[%,%,%]," mn.x mn.y mn.z to:f
      format "\"bboxMax\":[%,%,%]," mx.x mx.y mx.z to:f
      format "\"size\":[%,%,%]," sz.x sz.y sz.z to:f
      format "\"selectedFaces\":%," faceCount to:f
      format "\"unit\":\"%\"" (hgEscapeJsonStr unit) to:f
      format "}" to:f
    )
  ) catch ()
  close f
)

-- ---- Lifecycle -------------------------------------------------------
fn hgStop = (
  if hgBridgeTimer != undefined do (
    try (
      hgBridgeTimer.Enabled = false
      hgBridgeTimer.Dispose()
    ) catch ()
    hgBridgeTimer = undefined
    print "[HG] bridge watcher: stopped"
  )
  callbacks.removeScripts id:#hgBridgeSel
)

fn hgStart = (
  hgBridgeQueueDir = hgGetQueueDir()
  hgBridgeSelectionPath = hgGetSelectionPath()
  if hgBridgeTimer == undefined or not hgBridgeTimer.Enabled do (
    hgBridgeTimer = dotNetObject "System.Windows.Forms.Timer"
    hgBridgeTimer.Interval = 500
    dotNet.addEventHandler hgBridgeTimer "Tick" hgProcessOnce
    hgBridgeTimer.Enabled = true
    format "[HG] bridge watcher: started (poll %)\n" hgBridgeQueueDir
  )
  -- Selection callback
  callbacks.removeScripts id:#hgBridgeSel
  callbacks.addScript #selectionSetChanged "hgPushSelection()" id:#hgBridgeSel
  callbacks.addScript #nodePostDelete       "hgPushSelection()" id:#hgBridgeSel
  hgPushSelection()
  format "[HG] selection writer: %\n" hgBridgeSelectionPath
)

fn hgStatus = (
  local running = (hgBridgeTimer != undefined and hgBridgeTimer.Enabled)
  format "[HG] watcher: % | queue: % | selection.json: %\n" \
    (if running then "running" else "stopped") \
    hgBridgeQueueDir \
    hgBridgeSelectionPath
)

callbacks.removeScripts id:#hgBridgeReset
callbacks.addScript #systemPostReset "hgStart()" id:#hgBridgeReset

hgStart()
