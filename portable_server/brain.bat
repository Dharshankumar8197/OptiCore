@echo off
title OptiCore AI Server
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$Host.UI.RawUI.WindowTitle='OptiCore AI Server'; . '%~dp0scripts\common.ps1'; Show-BrainAnimation -DurationSeconds 0 -HeaderText 'OptiCore AI Server' -SubHeaderText 'YOLO26s | 20 Classes Point Cloud' -BottomText '[Running in Background | Close Window or Press Any Key to Exit]'"
endlocal
