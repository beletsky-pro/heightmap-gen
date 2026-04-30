-- =====================================================================
-- HeightmapGen Bridge — apply script
-- Generated: {{TIMESTAMP}}
--
-- Два режима:
--   "full" — собрать материал + стек модификаторов с нуля.
--   "live" — нашли HG_Displace модификатор → обновили только битмапы и
--            displace.strength через freshenMapFile (без пересборки).
--            Если HG-модификаторов нет, делается fallback на "full".
--
-- Карты лежат в стабильном пути %TEMP%/HeightmapGen/live/, чтобы битмап-
-- объекты в Max могли подхватить новый файл с того же пути.
-- =====================================================================

(
  local base       = @"{{BASE}}/"
  local heightPath    = base + "height16.png"
  local height8Path   = base + "height8.png"
  local normalPath    = base + "normal.png"
  local aoPath        = base + "ao.png"
  local roughnessPath = base + "roughness.png"
  local maskPath      = base + "mask.png"

  local dispScale  = {{DISP_SCALE}}
  local tessIters  = {{TESS_ITERS}}
  local addUVW     = {{ADD_UVW}}
  local applyMat   = {{APPLY_MATERIAL}}
  local matName    = "{{MAT_NAME}}"
  local applyMode  = "{{APPLY_MODE}}"   -- "auto" | "object" | "faces"
  local mode       = "{{MODE}}"         -- "full" | "live"
  local mapping    = "{{MAPPING_TYPE}}" -- "auto" | "planar" | "cylindrical" | "spherical" | "shrinkwrap" | "box"

  if not (doesFileExist heightPath) and (doesFileExist height8Path) do (
    heightPath = height8Path
  )

  -- ---- Утилиты ---------------------------------------------------------
  fn hgIsOurModifier m = (
    if m == undefined then false else (matchPattern m.name pattern:"HG_*")
  )

  fn hgRemoveOurModifiers obj = (
    local i = obj.modifiers.count
    while i > 0 do (
      if hgIsOurModifier obj.modifiers[i] do deleteModifier obj i
      i -= 1
    )
  )

  fn hgFindHGDisplace obj = (
    local found = undefined
    for m in obj.modifiers do (
      if m != undefined and m.name == "HG_Displace" do (found = m; exit)
    )
    found
  )

  fn hgGetFaceSelection obj = (
    local cls = classOf obj.baseObject
    if cls == Editable_Poly then (
      local s = polyop.getFaceSelection obj
      if s != undefined and s.numberSet > 0 then return s
    ) else if cls == Editable_Mesh then (
      local s = getFaceSelection obj
      if s != undefined and s.numberSet > 0 then return s
    )
    undefined
  )

  fn hgDetectMappingType obj = (
    -- Возвращает индекс UVWMap.maptype:
    -- 0=Planar, 1=Cylindrical, 2=Spherical, 3=Shrink Wrap, 4=Box
    -- (в MAXScript нумерация с 0).
    local cls = classOf obj.baseObject
    if cls == Box       then 4
    else if cls == Sphere    then 2
    else if cls == GeoSphere then 2
    else if cls == Cylinder  then 1
    else if cls == Tube      then 1
    else if cls == Cone      then 1
    else if cls == Plane     then 0
    else if cls == Quad_Patch then 0
    else 4  -- по умолчанию Box для произвольной геометрии
  )

  fn hgResolveMapping obj override = (
    if override == "auto"        then return (hgDetectMappingType obj)
    if override == "planar"      then 0
    else if override == "cylindrical" then 1
    else if override == "spherical"   then 2
    else if override == "shrinkwrap"  then 3
    else if override == "box"         then 4
    else 4
  )

  fn hgBuildPhysicalMaterial = (
    local pm = PhysicalMaterial()
    pm.name = matName
    pm.base_color = (color 200 200 200)
    if doesFileExist normalPath do (
      local nbm = Normal_Bump()
      nbm.normal_map = bitmaptexture filename:normalPath
      pm.bump_map = nbm
    )
    if doesFileExist roughnessPath do (
      pm.roughness_map = bitmaptexture filename:roughnessPath
    )
    pm
  )

  fn hgFindMultiSlotByName multi nm = (
    local found = 0
    for i = 1 to multi.numsubs do (
      if multi.materialList[i] != undefined and multi.materialList[i].name == nm do (found = i; exit)
    )
    found
  )

  fn hgEnsureMulti obj = (
    local m = obj.material
    if classOf m == MultiMaterial then return m
    local multi = multimaterial numsubs:1
    multi.name = "HG_MultiSub"
    if m == undefined then (
      multi.materialList[1] = Standard()
      multi.materialList[1].name = "Original"
    ) else (
      multi.materialList[1] = m
    )
    multi.materialIdList[1] = 1
    obj.material = multi
    multi
  )

  fn hgCollectHGMats obj = (
    -- Возвращает все материалы с именем = matName, найденные на объекте
    local mats = #()
    local m = obj.material
    if m == undefined then return mats
    if classOf m == MultiMaterial then (
      for sub in m.materialList do (
        if sub != undefined and sub.name == matName do append mats sub
      )
    ) else (
      if m.name == matName do append mats m
    )
    mats
  )

  fn hgRefreshBitmap b = (
    if b == undefined then return ok
    try (freshenMapFile b) catch (
      try (b.filename = b.filename) catch ()
    )
  )

  fn hgLiveRefresh obj = (
    -- Обновить битмапы в существующих модификаторе и материале без
    -- пересборки стека.
    local d = hgFindHGDisplace obj
    local refreshed = false
    if d != undefined then (
      d.strength = dispScale
      hgRefreshBitmap d.map
      refreshed = true
    )
    for m in (hgCollectHGMats obj) do (
      if m.bump_map != undefined and isProperty m.bump_map "normal_map" then (
        hgRefreshBitmap m.bump_map.normal_map
        refreshed = true
      )
      hgRefreshBitmap m.roughness_map
    )
    redrawViews()
    refreshed
  )

  -- ---- Основная логика -------------------------------------------------
  if selection.count == 0 then (
    if mode != "live" do messageBox "Heightmap Gen: выделите объект." beep:false title:"Heightmap Gen"
  ) else if not (doesFileExist heightPath) then (
    messageBox ("Heightmap Gen: heightmap не найден.\n" + heightPath) beep:false title:"Heightmap Gen"
  ) else (
    local obj = selection[1]
    local objName = obj.name

    -- LIVE: только refresh; если HG_Displace отсутствует — fallback на full
    if mode == "live" and (hgFindHGDisplace obj) != undefined then (
      hgLiveRefresh obj
      format "[HG] live refresh: %\n" objName
    ) else (
      -- FULL apply
      local faceSel = undefined
      if applyMode != "object" do faceSel = hgGetFaceSelection obj
      local useFaces = (faceSel != undefined)

      hgRemoveOurModifiers obj

      if applyMat then (
        try (
          local pm = hgBuildPhysicalMaterial()
          if useFaces then (
            local multi = hgEnsureMulti obj
            local slot = hgFindMultiSlotByName multi matName
            if slot == 0 then (
              multi.numsubs = multi.numsubs + 1
              slot = multi.numsubs
              multi.materialIdList[slot] = slot
            )
            multi.materialList[slot] = pm
            local cls = classOf obj.baseObject
            if cls == Editable_Poly then polyop.setFaceMatID obj faceSel slot
            else if cls == Editable_Mesh then meshop.setFaceMatID obj faceSel slot
            update obj
          ) else (
            obj.material = pm
          )
        ) catch (format "[HG] material error: %\n" (getCurrentException()))
      )

      if not useFaces then (
        if tessIters > 0 do (
          try (
            local tess = Tessellate()
            tess.name = "HG_Tessellate"
            tess.iterations = tessIters
            tess.tension = 0.0
            tess.type = 0
            addModifier obj tess
          ) catch (format "[HG] tess err: %\n" (getCurrentException()))
        )
        if addUVW do (
          try (
            local uvw = UVWMap()
            uvw.name = "HG_UVWMap"
            uvw.maptype = hgResolveMapping obj mapping
            -- Подгоняем размеры гизмо под bbox объекта
            local bb = obj.boundingBox
            local sz = bb.max - bb.min
            uvw.length = (amax 0.001 (abs sz.y))
            uvw.width  = (amax 0.001 (abs sz.x))
            uvw.height = (amax 0.001 (abs sz.z))
            addModifier obj uvw
          ) catch (format "[HG] uvw err: %\n" (getCurrentException()))
        )
        try (
          local d = Displace()
          d.name = "HG_Displace"
          d.strength = dispScale
          d.decay = 0
          d.map = bitmaptexture filename:heightPath
          addModifier obj d
        ) catch (format "[HG] disp err: %\n" (getCurrentException()))
      )

      redrawViews()
      if useFaces then format "[HG] full apply (% faces) on '%'\n" faceSel.numberSet objName
      else            format "[HG] full apply on '%'\n" objName
    )
  )
)
