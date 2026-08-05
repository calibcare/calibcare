# CalibCare — Medical Calibration Equipment Management System

> A web-based Medical Calibration Equipment Management System with Decision Support and LINE Official Account notifications.

---

# Overview

CalibCare is a web application developed for companies that provide medical equipment calibration services.

The purpose of this system is to replace manual Excel-based equipment records with a centralized database capable of managing calibration equipment, monitoring calibration schedules, generating reports, and assisting engineers in selecting suitable calibration equipment for specific calibration tasks.

Unlike a traditional inventory management system, CalibCare integrates a **Decision Support System (DSS)** that evaluates calibration equipment capabilities against user-defined calibration requirements.

---

# Problem Statement

Currently, calibration equipment information is maintained using Microsoft Excel spreadsheets.

Although Excel is easy to use, it presents several operational challenges:

- Equipment records are distributed across multiple files.
- Calibration schedules must be tracked manually.
- No automatic reminder system exists.
- Calibration certificates are difficult to organize.
- Engineers must manually compare equipment specifications before accepting calibration jobs.
- Management lacks dashboards for monitoring calibration resources.

These limitations increase workload, reduce operational efficiency, and increase the possibility of human error.

---

# Project Objectives

## Objective 1

Develop a centralized database for managing calibration equipment information.

The system shall store:

- Equipment information
- Manufacturer
- Model
- Serial Number
- Equipment location
- Calibration status
- Calibration history
- Calibration certificates

---

## Objective 2

Develop an automatic reminder system for annual calibration.

The system shall

- Monitor calibration due dates.
- Send reminders before calibration expires.
- Notify engineers through LINE Official Account.

---

## Objective 3

Develop an equipment monitoring dashboard.

The dashboard shall display

- Total equipment
- Equipment by category
- Equipment by manufacturer
- Available equipment
- Equipment under maintenance
- Equipment approaching calibration due date
- Overdue equipment

This information supports management in resource planning.

---

## Objective 4 (Innovation)

Develop a Decision Support System (DSS) for calibration equipment selection.

Instead of manually reviewing specifications, engineers will enter calibration requirements.

The system will compare those requirements against equipment capabilities stored in the database.

The comparison includes

- Measurement Purpose
- Measurement Range
- Instrument Accuracy
- Product Operating Range
- Acceptance Criteria

The system will recommend the most suitable calibration equipment and explain why the recommendation was made.

---

# Target Users

The system is intended for

- Biomedical Engineers
- Calibration Engineers
- Quality Assurance (QA)
- Engineering Managers
- System Administrators

---

# Key Features

## Equipment Management

- Register calibration equipment
- Update equipment information
- Delete equipment
- Search equipment
- Upload calibration certificates
- Track equipment status

---

## Calibration Management

- Store calibration history
- Record calibration dates
- Record next calibration date
- Upload calibration certificates
- View calibration timeline

---

## Reminder System

Automatically checks calibration schedules every day.

Reminder schedule

- 30 days before due date
- 14 days before due date
- 7 days before due date
- On due date
- Overdue notification

Notifications are delivered through

- LINE Official Account

---

## Decision Support System

This module is the core innovation of the project.

Engineers enter calibration requirements instead of searching manually.

Example input

Flow

0–180 SLPM

Pressure

0–8 bar

Oxygen

21–100 %

The system compares these values with equipment capabilities.

Example output

Suitable Equipment

✔ Gas Flow Analyzer

Model

VT650

Serial Number

5360407

Reason

Flow capability covers requested range.

Pressure capability covers requested range.

Oxygen capability covers requested range.

If equipment does not satisfy every requirement

Result

Not Suitable

Reason

Required Pressure

15 bar

Equipment Maximum

10 bar

---

# Equipment Capability

Each calibration instrument may support multiple measurement capabilities.

Example

Equipment

Gas Flow Analyzer

Model

VT650

Serial Number

5360407

Capabilities

| Measurement Purpose | Measurement Range | Instrument Accuracy | Product Operating Range | Acceptance Criteria |
|---------------------|-------------------|----------------------|--------------------------|---------------------|
| Flow | 0 to ±200 SLPM | ±2% | 0–180 SLPM | ±10% of Setting |
| Pressure | -0.8 to 10 bar | ±1% | 0–0.14 bar | ±0.0026 bar |
| Oxygen | 0–100% | ±1% | 0–100% | ±3% of Reading |

---

# Expected Workflow

```text
Login
   │
   ▼
Dashboard
   │
   ├──────────── Equipment Management
   │
   ├──────────── Calibration Management
   │
   ├──────────── Decision Support
   │
   ├──────────── Reports
   │
   └──────────── Notification System
```

---

# Proposed Technology Stack

## Frontend

- React
- Tailwind CSS
- React Router
- Axios

---

## Backend

- Node.js
- Express.js

---

## Database

- MySQL

---

## Authentication

- JWT

---

## Notification

- LINE Messaging API

---

## Scheduler

- node-cron

---

# Proposed Project Structure

```
medical-calibration-management-system/

docs/
database/
backend/
frontend/
README.md
```

---

# Documentation Roadmap

The project documentation is divided into the following files.

```
docs/

01-project-overview.md

02-software-requirements-specification.md

03-business-requirements.md

04-functional-requirements.md

05-system-architecture.md

06-database-design.md

07-er-diagram.md

08-data-dictionary.md

09-api-specification.md

10-decision-support-algorithm.md

11-line-notification.md

12-user-interface-design.md

13-development-roadmap.md

14-testing-plan.md

15-deployment-guide.md
```

---

# Future Enhancements

- QR Code for every calibration instrument
- Equipment reservation system
- Equipment utilization analysis
- Predictive calibration planning
- Audit log
- Multi-branch support
- Export PDF
- Export Excel
- Mobile responsive interface

---

# Expected Benefits

The proposed system provides

- Centralized equipment database
- Automatic calibration reminders
- Better resource management
- Faster equipment search
- Reduced human error
- Improved operational efficiency
- Decision support for calibration equipment selection
- Better engineering planning
- Digital documentation replacing Excel

---

# Conclusion

The Medical Calibration Equipment Management System is more than a database application.

It combines

- Equipment Management
- Calibration Management
- Notification System
- Reporting Dashboard
- Decision Support System

to improve the efficiency of calibration service operations.

The Decision Support System represents the primary innovation of the project by automatically evaluating calibration equipment capabilities against user-defined calibration requirements and recommending the most suitable equipment for each calibration task.
