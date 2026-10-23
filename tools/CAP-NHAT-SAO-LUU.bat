@echo off
chcp 65001 >nul
rem (c) 2026 Lai Long Charts. Bao luu moi quyen.
rem Lam moi ban sao luu: keo ban moi nhat tu GitHub roi nen lai thanh file zip.
rem Dat file nay trong thu muc chua "lai-long-charts" (vi du E:\LaiLongCharts).
cd /d "%~dp0"
if not exist "lai-long-charts\.git" (
  echo Khong tim thay thu muc lai-long-charts ben canh file nay.
  pause
  exit /b 1
)
echo [1/2] Dang lay ban moi nhat tu GitHub...
git -C lai-long-charts pull
echo [2/2] Dang nen thanh LaiLongCharts-sao-luu.zip ...
if exist LaiLongCharts-sao-luu.zip del LaiLongCharts-sao-luu.zip
tar -a -c -f LaiLongCharts-sao-luu.zip lai-long-charts
echo.
echo Xong! Hay tai file LaiLongCharts-sao-luu.zip len Google Drive.
pause
