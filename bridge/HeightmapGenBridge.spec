# PyInstaller spec for HeightmapGenBridge.exe
# Build: pyinstaller HeightmapGenBridge.spec
#
# Использует --onedir по умолчанию: одна папка `dist/HeightmapGenBridge/`
# с exe + apply_template.ms + рантайм-зависимостями. Запускается мгновенно.

# -*- mode: python ; coding: utf-8 -*-

import os

block_cipher = None

a = Analysis(
    ['server.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('apply_template.ms', '.'),
        ('MaxBridge.ms', '.'),
        ('README.md', '.'),
    ],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Уменьшаем размер: stdlib-only сервер не нуждается в этих модулях
        'tkinter',
        'unittest',
        'pydoc',
        'doctest',
        'xml.etree',
    ],
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='HeightmapGenBridge',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,  # консоль с логами — не GUI
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='HeightmapGenBridge',
)
