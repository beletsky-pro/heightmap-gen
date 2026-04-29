// Shared noise library — included via vite-plugin-glsl #include

precision highp float;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

vec3 hash33(vec3 p) {
  p = vec3(
    dot(p, vec3(127.1, 311.7, 74.7)),
    dot(p, vec3(269.5, 183.3, 246.1)),
    dot(p, vec3(113.5, 271.9, 124.6))
  );
  return fract(sin(p) * 43758.5453);
}

float hash14(vec4 p) {
  p = fract(p * vec4(0.1031, 0.1030, 0.0973, 0.1099));
  p += dot(p, p.wzxy + 33.33);
  return fract((p.x + p.y) * (p.z + p.w));
}

vec4 hash44(vec4 p) {
  p = vec4(
    dot(p, vec4(127.1, 311.7,  74.7,  3.7)),
    dot(p, vec4(269.5, 183.3, 246.1, 17.3)),
    dot(p, vec4(113.5, 271.9, 124.6, 53.7)),
    dot(p, vec4(247.3,  17.1,  79.2, 12.9))
  );
  return fract(sin(p) * 43758.5453);
}

// Classic 3D value noise
float vnoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(
      mix(hash13(i + vec3(0,0,0)), hash13(i + vec3(1,0,0)), u.x),
      mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), u.x), u.y),
    mix(
      mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), u.x),
      mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), u.x), u.y),
    u.z);
}

// 4D gradient noise (for tileable via torus projection)
float gnoise4(vec4 p) {
  vec4 i = floor(p);
  vec4 f = fract(p);
  vec4 u = f * f * (3.0 - 2.0 * f);
  float result = 0.0;
  for (int dx = 0; dx <= 1; dx++) {
    for (int dy = 0; dy <= 1; dy++) {
      for (int dz = 0; dz <= 1; dz++) {
        for (int dw = 0; dw <= 1; dw++) {
          vec4 o = vec4(float(dx), float(dy), float(dz), float(dw));
          float w = mix(1.0 - u.x, u.x, o.x)
                  * mix(1.0 - u.y, u.y, o.y)
                  * mix(1.0 - u.z, u.z, o.z)
                  * mix(1.0 - u.w, u.w, o.w);
          result += w * hash14(i + o);
        }
      }
    }
  }
  return result;
}

// FBM на 4D-ноисе для бесшовности.
// uv ∈ [0,1)², оборачиваем в тор; scale задаёт частоту базы.
vec4 toTorus(vec2 uv, float scale) {
  float r = scale / 6.28318530718;
  float a = uv.x * 6.28318530718;
  float b = uv.y * 6.28318530718;
  return vec4(r * cos(a), r * sin(a), r * cos(b), r * sin(b));
}

float fbmTorus(vec2 uv, float scale, int octaves, float lacunarity, float gain) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    float s = scale * pow(lacunarity, float(i));
    sum += amp * gnoise4(toTorus(uv, s));
    norm += amp;
    amp *= gain;
  }
  return sum / max(norm, 0.0001);
}

// Voronoi (Worley) на 3D с целочисленным mod для tileable.
// uv ∈ [0,1)², gridSize задаёт количество ячеек по стороне (целое).
// Возвращает vec3(F1, F2, cellHash) где cellHash — uniform hash клетки-победителя.
vec3 voronoiTile(vec2 uv, float gridSize, float seed) {
  vec2 p = uv * gridSize;
  vec2 ip = floor(p);
  vec2 fp = fract(p);
  float f1 = 1e9;
  float f2 = 1e9;
  vec3 winnerHash = vec3(0.0);
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      vec2 g = vec2(float(dx), float(dy));
      vec2 cell = mod(ip + g, vec2(gridSize));
      vec3 jitter = hash33(vec3(cell, seed));
      vec2 offs = jitter.xy;
      vec2 r = g + offs - fp;
      float d = dot(r, r);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        winnerHash = jitter;
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  return vec3(sqrt(f1), sqrt(f2), winnerHash.z);
}

float remapContrast(float h, float contrast) {
  return clamp(0.5 + (h - 0.5) * contrast, 0.0, 1.0);
}

// Поры/каверны: распределение неровных вмятин на сетке gridSize (бесшовно через mod).
// Только cellHash > (1 - density) имеет пору.
// Радиусы сильно варьируются (0.3..1.4 от base), форма — анизотропная (растянутая под случайным углом),
// край — неровный (sin-периодическая модуляция расстояния).
//
// Параметры:
//   gridSize  — количество ячеек по стороне (бесшовно при целом)
//   density   — доля активных ячеек (0..1)
//   radius    — базовый радиус поры внутри ячейки (0..0.5)
//   jitterAmt — насколько центр сдвигается от середины ячейки (0..1)
//   anisoAmt  — насколько форма растянута/сжата (0 = круг, 1 = сильно эллипсная)
//   wobbleAmt — насколько край изломан (0 = гладкий, 1 = сильно неровный)
//   seed      — random offset
float poresLayer(
  vec2 uv, float gridSize,
  float density, float radius,
  float jitterAmt, float anisoAmt, float wobbleAmt,
  float seed
) {
  vec2 p = uv * gridSize;
  vec2 ip = floor(p);
  vec2 fp = fract(p);
  float maxDimple = 0.0;
  // Сосед-радиус 2: чтобы крупные jittered поры из соседних ячеек не обрезались на границе
  for (int dy = -2; dy <= 2; dy++) {
    for (int dx = -2; dx <= 2; dx++) {
      vec2 g = vec2(float(dx), float(dy));
      vec2 cell = mod(ip + g, vec2(gridSize));
      vec3 h1 = hash33(vec3(cell, seed));
      // Активна ли пора?
      if (h1.z < (1.0 - density)) continue;
      vec3 h2 = hash33(vec3(cell, seed + 41.0));

      // Сильно сдвинутый центр
      vec2 center = g + vec2(0.5) + (h1.xy - 0.5) * jitterAmt * 1.6;
      vec2 r = fp - center;

      // Анизотропия: повернуть и сжать
      float angle = h2.x * 6.283185;
      float cs = cos(angle);
      float sn = sin(angle);
      vec2 rRot = vec2(r.x * cs + r.y * sn, -r.x * sn + r.y * cs);
      // Соотношение сторон от 1:1 до 1:2.5
      float ratio = 1.0 + h2.y * 1.5 * anisoAmt;
      vec2 rScaled = vec2(rRot.x * ratio, rRot.y / ratio);
      float d = length(rScaled);

      // Сильная вариация радиуса: 0.3..1.4
      float rad = radius * (0.3 + 1.1 * fract(h1.x * 7.31 + h2.z * 3.7));

      // Изломанный край: модуляция расстояния синусом по углу-r
      float angR = atan(rScaled.y, rScaled.x);
      float wobble = sin(angR * (3.0 + h2.z * 4.0) + h1.x * 6.28) * 0.18 * wobbleAmt;
      wobble += sin(angR * (7.0 + h1.y * 5.0) + h2.x * 6.28) * 0.10 * wobbleAmt;

      // Vmятина с мягким краем
      float dimple = 1.0 - smoothstep(rad * (0.5 + wobble), rad * (1.0 + wobble), d);
      // Форма дна: чашка
      dimple *= dimple;
      maxDimple = max(maxDimple, dimple);
    }
  }
  return maxDimple;
}

// Волосяные (hairline) трещины: Voronoi F2-F1, очень узкая полоса, опционально модулированная FBM
// для извилистости. amount [0..1], width — относительная ширина (0.005..0.05).
float hairlineCracks(vec2 uv, float gridSize, float width, float wiggleAmp, float wiggleFreq, float seed) {
  // Wiggle: смещаем uv мелким шумом, чтобы линии не были прямыми
  vec2 wuv = uv;
  if (wiggleAmp > 0.001) {
    wuv += (vec2(
      gnoise4(toTorus(uv + vec2(seed * 0.13, 0.0), wiggleFreq)),
      gnoise4(toTorus(uv + vec2(0.0, seed * 0.27), wiggleFreq))
    ) - 0.5) * wiggleAmp;
  }
  vec3 vor = voronoiTile(wuv, gridSize, seed);
  float edge = vor.y - vor.x;
  return 1.0 - smoothstep(0.0, max(0.0001, width), edge);
}
