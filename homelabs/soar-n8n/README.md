# 🤖 SOAR Automation with n8n

## Overview

This project documents the development of a SOAR-style automation workflow built with n8n.

The workflow automates the initial analysis of security alerts by extracting IOCs from raw logs, enriching them with threat intelligence sources, mapping MITRE ATT&CK techniques, and generating a structured incident report delivered directly to Slack.

The primary goal was to reduce repetitive Tier 1 SOC analyst tasks and accelerate the triage process.

---

## Objective

Build an automated workflow capable of:

- Receiving security logs through Slack
- Extracting IOCs from any log format
- Enriching indicators using multiple intelligence sources
- Mapping MITRE ATT&CK techniques
- Assessing severity
- Delivering actionable recommendations

The workflow was designed to be source-agnostic, allowing it to process logs from Wazuh, Let'sDefend, Palo Alto, and other platforms.

---

## Architecture

<p align="center">
  <img src="images/workflow-overview.png" width="900">
</p>

### Workflow

```text
Slack Trigger
      ↓
Gemini IOC Extraction
      ↓
Data Normalization
      ↓
AbuseIPDB Enrichment
      ↓
VirusTotal Enrichment
      ↓
AI Threat Analysis
      ↓
Slack Report Delivery
```

The final workflow consists of 13 sequential nodes designed for stability and predictable execution. :contentReference[oaicite:2]{index=2}

---

## Technology Stack

| Component | Purpose |
|------------|----------|
| n8n | SOAR Platform |
| Slack | Input & Output Channel |
| Gemini 2.0 Flash | IOC Extraction & Threat Analysis |
| AbuseIPDB | IP Reputation |
| VirusTotal | IOC Enrichment |
| JavaScript | Data Normalization |

---

## Key Features

### IOC Extraction with AI

Gemini receives the raw log and extracts:

- IP addresses
- Domains
- URLs
- Hashes
- CVEs
- Commands
- Usernames
- Hostnames

This allows the workflow to process multiple log formats without custom parsers. :contentReference[oaicite:3]{index=3}

### Threat Intelligence Enrichment

The workflow automatically queries:

- AbuseIPDB
- VirusTotal

and consolidates reputation data, detections, malicious engines, and related intelligence. :contentReference[oaicite:4]{index=4}

### MITRE ATT&CK Mapping

The final AI analysis maps observed activity to relevant ATT&CK techniques and tactics while generating recommended response actions. :contentReference[oaicite:5]{index=5}

### Automated Reporting

A professional incident report is delivered directly to Slack, eliminating manual formatting and accelerating analyst response. :contentReference[oaicite:6]{index=6}

---

## Validation Results

### Scenario 1 – Living-off-the-Land Attack

Results:

- Identified regsvr32 abuse
- Detected Microsoft typosquatting domain
- Confirmed malicious hash detection through VirusTotal
- Classified severity as Critical
- Generated response recommendations
- Mapped relevant MITRE ATT&CK techniques

### Scenario 2 – CVE-2024-3400

Results:

- Identified CVE exploitation
- Detected command injection indicators
- Detected path traversal behavior
- Generated MITRE ATT&CK mappings
- Produced automated incident report

:contentReference[oaicite:7]{index=7}

---

## Lessons Learned

- Sequential workflows proved more reliable than parallel branches.
- Explicit node references improved workflow stability.
- AI-based IOC extraction removed dependency on log-specific parsers.
- Error handling is essential when working with external intelligence APIs.
- SOAR automation can significantly reduce manual triage workload.

:contentReference[oaicite:8]{index=8}

---

## Skills Demonstrated

- Security Automation
- SOAR Concepts
- Threat Intelligence Enrichment
- IOC Analysis
- MITRE ATT&CK Mapping
- Workflow Design
- API Integration
- JavaScript
- Incident Triage

---

## Portfolio Case Study

Full interactive documentation:

[View Complete Case Study](TU_URL)
