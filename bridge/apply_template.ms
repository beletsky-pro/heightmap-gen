-- =====================================================================
-- HeightmapGen Bridge — apply script
-- Generated: {{TIMESTAMP}}
-- Применяет сгенерированные карты к выделенному объекту.
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

  -- Безопасный фолбэк для height: если 16-bit нет, используем 8-bit.
  if not (doesFileExist heightPath) and (doesFileExist height8Path) do (
    heightPath = height8Path
  )

  if selection.count == 0 then (
    messageBox "Heightmap Gen: выделите объект перед применением." beep:false title:"Heightmap Gen"
  ) else if not (doesFileExist heightPath) then (
    messageBox ("Heightmap Gen: heightmap не найден.\n" + heightPath) beep:false title:"Heightmap Gen"
  ) else (
    local obj = selection[1]
    local objName = obj.name

    -- ---- Material (PhysicalMaterial 2026) ------------------------------
    if applyMat then (
      try (
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

        obj.material = pm
      ) catch (
        format "[HG] material error: %\n" (getCurrentException())
      )
    )

    -- ---- Modifier stack: Tessellate → UVWMap → Displace ----------------
    if tessIters > 0 do (
      try (
        local tess = Tessellate()
        tess.iterations = tessIters
        tess.tension = 0.0
        tess.type = 0
        addModifier obj tess
      ) catch (
        format "[HG] tessellate error: %\n" (getCurrentException())
      )
    )

    if addUVW do (
      try (
        local uvw = UVWMap()
        uvw.maptype = 4  -- shrinkwrap
        uvw.length = 100
        uvw.width = 100
        uvw.height = 100
        addModifier obj uvw
      ) catch (
        format "[HG] uvw error: %\n" (getCurrentException())
      )
    )

    try (
      local d = Displace()
      d.strength = dispScale
      d.decay = 0
      d.map = bitmaptexture filename:heightPath
      addModifier obj d
    ) catch (
      format "[HG] displace error: %\n" (getCurrentException())
    )

    redrawViews()
    format "[HG] applied to '%' base=%\n" objName base
  )
)
