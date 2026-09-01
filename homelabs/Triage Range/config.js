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
  "3-1": { answer: "T1068", acceptable: ["1068", "t1068"] }
};
