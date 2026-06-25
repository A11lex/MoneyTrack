Set-Location $PSScriptRoot
& 'C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m uvicorn app.main:app --host 127.0.0.1 --port 8001
