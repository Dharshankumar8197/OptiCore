@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ". '%~dp0scripts\common.ps1'; Show-BrainAnimation -DurationSeconds 0 -HeaderText 'OptiCore AI Server - 3D Neural Visualizer' -SubHeaderText 'YOLO26s 20 Classes Point Cloud' -BottomText '[Press Any Key to Return]'"
endlocal
