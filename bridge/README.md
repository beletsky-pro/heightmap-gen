# HeightmapGen Bridge

Локальный мост между веб-генератором (https://beletsky-pro.github.io/heightmap-gen/) и запущенным 3ds Max 2026. Один клик в браузере → материал и Displace-модификатор в Max.

## Как это работает

```
Browser (web app)  ──HTTP+CORS──▶  Python server   ──watch dir──▶  MAXScript
http://...github.io                127.0.0.1:7878                  3ds Max 2026
```

1. **Python server** принимает POST с base64-PNG от веб-приложения и кладёт `.ms` файл в очередь `%TEMP%\HeightmapGen\queue\`.
2. **MaxBridge.ms** — MAXScript внутри 3ds Max — каждые 500 мс смотрит в очередь и автоматически исполняет любой найденный `.ms`.
3. Этот `.ms` собирает Physical Material с Bump/Roughness, добавляет `Tessellate → UVWMap → Displace` модификаторы и применяет к выделенному объекту.

## Требования

- Windows 10/11
- Python 3.8+ (только стандартная библиотека, никаких pip-пакетов)
- 3ds Max 2026

## Установка

### 1. Python-сервер (одноразово)

Распакуй папку `bridge/` куда удобно, например `D:\HeightmapGenBridge\`. Дважды кликни `run.cmd`. Откроется консольное окно:

```
HeightmapGen Bridge v1.0.0
listening on http://127.0.0.1:7878
queue:  C:\Users\you\AppData\Local\Temp\HeightmapGen\queue
assets: C:\Users\you\AppData\Local\Temp\HeightmapGen\assets
```

Окно нужно держать открытым пока работаешь. Можно свернуть.

### 2. MAXScript-watcher в 3ds Max (одноразово)

Открой 3ds Max → меню **Scripting → Run Script…** → выбери `bridge\MaxBridge.ms`. В Listener'е появится:
```
[HG] bridge watcher: started (poll C:\...\HeightmapGen\queue\ every 500ms)
```

Чтобы watcher автозагружался при старте Max — скопируй `MaxBridge.ms` в:
```
%LOCALAPPDATA%\Autodesk\3dsMax\2026 - 64bit\ENU\scripts\Startup\
```

Команды управления (в Listener'е):
```
hgStop()     -- остановить
hgStart()    -- запустить
hgStatus()   -- статус
```

## Использование

1. В 3ds Max выдели объект.
2. В браузере открой https://beletsky-pro.github.io/heightmap-gen/, настрой материал.
3. Нажми кнопку **«Применить в 3ds Max»**.
4. Через ~500 мс в Max появится Physical Material + стек модификаторов с твоей картой.

Подсказки в Listener'е:
- `[HG] applying 1730000123_abc12345.ms` — обработка нового задания.
- `[HG] applied to 'Box001' base=C:/Users/.../assets/abc12345/` — успех.

## Что собирает скрипт

На выделенный объект:
- **Material:** PhysicalMaterial с base color + Normal_Bump → normal map + Roughness map.
- **Modifier stack** (снизу вверх):
  - `Tessellate` (по умолчанию 2 итерации)
  - `UVWMap` (shrinkwrap, 100×100×100)
  - `Displace` (strength = `displacementScale` из веб-приложения, map = heightmap16)

Все настройки `Tessellate / UVWMap / Displace strength` зеркальны архитектуре `ConcreteMoldTexture.ms`.

## Безопасность

- Сервер слушает **только** `127.0.0.1` — недоступен из локальной сети.
- CORS: разрешает любой `Origin`, чтобы и `github.io`, и локальный dev-сервер работали.
- Файлы складываются во `%TEMP%\HeightmapGen\` — Windows автоматически чистит при освобождении диска.

## Структура

```
bridge/
├── server.py           # HTTP-сервер (stdlib only)
├── apply_template.ms   # шаблон применяемого MAXScript
├── MaxBridge.ms        # poller на стороне 3ds Max
├── run.cmd             # Windows launcher
├── run.sh              # Linux/Mac launcher (для разработки)
└── README.md
```

## Troubleshooting

**Веб-приложение пишет «Bridge offline»**
→ Не запущен `run.cmd` или server.py упал. Перезапусти.

**Веб «Applied», но в Max ничего не появилось**
→ MaxBridge.ms не запущен. Проверь Listener: `hgStatus()`.

**`bitmaptexture filename:...` падает**
→ Путь содержит non-ASCII символы. Перенеси `bridge/` в путь без кириллицы.

**Хочу поменять порт**
→ `python server.py --port 9000`. В веб-приложении пока порт жёстко зашит — для смены нужна правка кода.
