@echo off
REM HeightmapGen Bridge — Windows launcher.
REM Запускает Python-сервер из этой же папки. Требует Python 3.8+ в PATH.

setlocal
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo Python не найден в PATH. Установите Python 3.8+ с python.org
  echo и запустите этот файл повторно.
  pause
  exit /b 1
)

echo Запуск HeightmapGen Bridge...
echo Чтобы остановить — закройте это окно.
echo.
python server.py %*
