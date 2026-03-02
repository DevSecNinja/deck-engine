$projectPath = "C:\code\canvas\deck"
$canvasPath  = "C:\code\canvas"
$edgeProfile = "Profile 2"   # <-- change if needed

# Start Windows Terminal with dev server tab + Copilot tab
Start-Process wt -ArgumentList "new-tab -d $projectPath pwsh -NoExit -Command `"npm run dev`" ; new-tab -d $canvasPath pwsh -NoExit -Command `"copilot --yolo`""

# Wait for server startup
Start-Sleep -Seconds 4

# Launch Edge with specific profile
Start-Process "msedge.exe" -ArgumentList "--profile-directory=`"$edgeProfile`" http://localhost:5175"
