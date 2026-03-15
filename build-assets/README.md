# App icons

Place your app icons here before running `npm run dist`.

| File | Size | Used by |
|------|------|---------|
| `icon.icns` | — | macOS |
| `icon.ico` | — | Windows |
| `icon.png` | 512×512 px | Linux |

## Generating from a single PNG

If you have a 1024×1024 source PNG, you can generate all three with:

```bash
# macOS (requires Xcode command-line tools)
mkdir icon.iconset
sips -z 16 16     icon-1024.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon-1024.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon-1024.png --out icon.iconset/icon_32x32.png
sips -z 64 64     icon-1024.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon-1024.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon-1024.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon-1024.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon-1024.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon-1024.png --out icon.iconset/icon_512x512.png
cp icon-1024.png  icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset -o icon.icns

# Windows .ico (requires ImageMagick)
magick icon-1024.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico

# Linux — just copy/resize to 512x512
cp icon-1024.png icon.png
```

electron-builder will error with a clear message if icons are missing when targeting a specific platform.
