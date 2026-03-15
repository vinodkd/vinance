#!/bin/bash
mkdir -p /usr/share/icons/hicolor/512x512/apps
cp /usr/share/icons/hicolor/0x0/apps/vinance.png /usr/share/icons/hicolor/512x512/apps/vinance.png 2>/dev/null || true
gtk-update-icon-cache -f /usr/share/icons/hicolor 2>/dev/null || true
