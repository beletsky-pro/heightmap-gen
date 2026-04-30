-- =====================================================================
-- HeightmapGen Bridge — apply script
-- Generated: {{TIMESTAMP}}
-- Применяет сгенерированные карты к выделенному объекту.
-- При наличии face-selection (Editable_Poly / Editable_Mesh) — заворачивает
-- материал в Multi/Sub-Object и присваивает выбранным граням свой matID.
-- Idempotent: повторное применение заменяет существующий HG-слот и HG-модификаторы.
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
  local applyMode  = "{{APPLY_MODE}}"  -- "auto" | "object" | "faces"

  if not (doesFileExist heightPath) and (doesFileExist height8Path) do (
    heightPath = height8Path
  )

  -- ---- Утилиты ---------------------------------------------------------
  fn hgIsOurModifier m = (
    if m == undefined then false else (
      matchPattern m.name pattern:"HG_*"
    )
  )

  fn hgRemoveOurModifiers obj = (
    local i = obj.modifiers.count
    while i > 0 do (
      if hgIsOurModifier obj.modifiers[i] do deleteModifier obj i
      i -= 1
    )
  )

  fn hgGetFaceSelection obj = (
    -- Возвращает (BitArray) выделенных граней, либо undefined если нет
    -- сабобъектного выделения. Поддерживает Editable_Poly и Editable_Mesh.
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
    -- Ищем существующий слот с таким же именем материала
    for i = 1 to multi.numsubs do (
      if multi.materialList[i] != undefined and multi.materialList[i].name == nm do return i
    )
    0
  )

  fn hgEnsureMulti obj = (
    -- Возвращает Multi/Sub материал на объекте, оборачивая существующий
    -- материал в первый слот, если нужно.
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

  fn hgApplyMaterialToFaces obj faceSel pm = (
    -- Берём (или создаём) Multi/Sub, заменяем/добавляем HG-слот, ставим matID
    local multi = hgEnsureMulti obj
    local slot = hgFindMultiSlotByName multi matName
    if slot == 0 then (
      multi.numsubs = multi.numsubs + 1
      slot = multi.numsubs
      multi.materialIdList[slot] = slot
    )
    multi.materialList[slot] = pm

    -- Назначаем matID = slot для выделенных граней
    local cls = classOf obj.baseObject
    if cls == Editable_Poly then (
      polyop.setFaceMatID obj faceSel slot
    ) else if cls == Editable_Mesh then (
      meshop.setFaceMatID obj faceSel slot
    )
    update obj
    slot
  )

  fn hgApplyMaterialWhole obj pm = (
    obj.material = pm
  )

  -- ---- Основная логика -------------------------------------------------
  if selection.count == 0 then (
    messageBox "Heightmap Gen: выделите объект перед применением." beep:false title:"Heightmap Gen"
  ) else if not (doesFileExist heightPath) then (
    messageBox ("Heightmap Gen: heightmap не найден.\n" + heightPath) beep:false title:"Heightmap Gen"
  ) else (
    local obj = selection[1]
    local objName = obj.name

    -- Решаем: faces или object?
    local faceSel = undefined
    if applyMode != "object" do faceSel = hgGetFaceSelection obj
    if applyMode == "faces" and faceSel == undefined do (
      messageBox "Heightmap Gen: face-selection отсутствует. Применяю к объекту." beep:false
    )
    local useFaces = (faceSel != undefined)

    -- Удалить ранее наложенные HG-модификаторы (idempotent)
    hgRemoveOurModifiers obj

    -- ---- Material ------------------------------------------------------
    if applyMat then (
      try (
        local pm = hgBuildPhysicalMaterial()
        if useFaces then (
          local slot = hgApplyMaterialToFaces obj faceSel pm
          format "[HG] material applied to % faces (slot %)\n" faceSel.numberSet slot
        ) else (
          hgApplyMaterialWhole obj pm
        )
      ) catch (
        format "[HG] material error: %\n" (getCurrentException())
      )
    )

    -- ---- Modifier stack ------------------------------------------------
    -- Для faces-режима стек не накладываем: Displace в Max не фильтруется
    -- по граням. Если нужно деформировать только эти грани — отделите их
    -- (Detach) и применяйте отдельно.
    if not useFaces then (
      if tessIters > 0 do (
        try (
          local tess = Tessellate()
          tess.name = "HG_Tessellate"
          tess.iterations = tessIters
          tess.tension = 0.0
          tess.type = 0
          addModifier obj tess
        ) catch (format "[HG] tess error: %\n" (getCurrentException()))
      )
      if addUVW do (
        try (
          local uvw = UVWMap()
          uvw.name = "HG_UVWMap"
          uvw.maptype = 4
          uvw.length = 100
          uvw.width = 100
          uvw.height = 100
          addModifier obj uvw
        ) catch (format "[HG] uvw error: %\n" (getCurrentException()))
      )
      try (
        local d = Displace()
        d.name = "HG_Displace"
        d.strength = dispScale
        d.decay = 0
        d.map = bitmaptexture filename:heightPath
        addModifier obj d
      ) catch (format "[HG] disp error: %\n" (getCurrentException()))
    )

    redrawViews()
    if useFaces then (
      format "[HG] applied to % faces of '%' base=%\n" faceSel.numberSet objName base
    ) else (
      format "[HG] applied to '%' base=%\n" objName base
    )
  )
)
