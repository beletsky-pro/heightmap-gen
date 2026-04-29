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

// Поры/каверны: бесшовное распределение круглых вмятин на сетке gridSize.
// Только cellHash > density имеет пору. radius — относительный радиус поры внутри ячейки (0..0.5).
// Возвращает глубину вмятины [0..1], где 1 — центр поры, 0 — нет поры.
// Ячейка может быть «слегка деформирована» через jitter центра.
float poresLayer(vec2 uv, float gridSize, float density, float radius, float jitterAmt, float seed) {
  vec2 p = uv * gridSize;
  vec2 ip = floor(p);
  vec2 fp = fract(p);
  float maxDimple = 0.0;
  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      vec2 g = vec2(float(dx), float(dy));
      vec2 cell = mod(ip + g, vec2(gridSize));
      vec3 hash = hash33(vec3(cell, seed));
      // Активна ли пора в этой ячейке?
      if (hash.z < density) continue;
      // Случайный центр (с уменьшенным jitter — поры обычно ближе к центру)
      vec2 center = g + vec2(0.5) + (hash.xy - 0.5) * jitterAmt;
      vec2 r = fp - center;
      float d = length(r);
      // Случайный радиус — от 60% до 100% от заданного, для разнообразия
      float rad = radius * mix(0.6, 1.0, fract(hash.x * 7.31));
      // Глубокая круглая вмятина с мягким краем
      float dimple = 1.0 - smoothstep(rad * 0.6, rad, d);
      // Наклон дна (slight bowl) — squared falloff внутри
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
