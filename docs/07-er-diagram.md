# 07 - Entity Relationship Diagram

Source: `database/schema.sql`, derived from `00 FP-ENG-05-01 Rev.02` (equipment calibration register).

```mermaid
erDiagram
    USERS ||--o{ NOTIFICATION_LOG : receives
    EQUIPMENT ||--o{ EQUIPMENT_CAPABILITY : "has"
    EQUIPMENT ||--o{ CALIBRATION_HISTORY : "calibrated in"
    CALIBRATION_HISTORY ||--o{ NOTIFICATION_LOG : triggers

    USERS {
        int user_id PK
        varchar full_name
        varchar email
        varchar password_hash
        enum role
        varchar line_user_id
        timestamp created_at
    }

    EQUIPMENT {
        int equipment_id PK
        int equipment_no
        varchar name
        varchar model
        varchar manufacturer
        varchar serial_number
        varchar category
        varchar location
        enum status
        varchar status_note
        text remarks
    }

    EQUIPMENT_CAPABILITY {
        int capability_id PK
        int equipment_id FK
        varchar measurement_purpose
        varchar measurement_range
        varchar instrument_accuracy
        varchar product_operating_range
        varchar acceptance_criteria
    }

    CALIBRATION_HISTORY {
        int calibration_id PK
        int equipment_id FK
        varchar responsible_person
        varchar calibration_frequency
        date calibration_date
        date next_calibration_date
        varchar certificate_path
    }

    NOTIFICATION_LOG {
        int notification_id PK
        int calibration_id FK
        int user_id FK
        enum notification_type
        varchar channel
        enum status
        timestamp sent_at
    }
```

## Relationship notes

- **equipment (1) → equipment_capability (N)**: one instrument can measure multiple things.
  Example from the source sheet: the *kVp Meter (Piranha 557, CB2-14060199)* has two
  capability rows — `kVp` and `Exposure Time` — sharing one equipment record. This is the
  table the **Decision Support System** queries when matching a requirement against
  equipment.
- **equipment (1) → calibration_history (N)**: calibration happens against the whole
  physical instrument, not a single capability channel — in the source sheet, every
  capability row under one instrument repeats the same "last/next calibration date".
  This table is append-only, so unlike the spreadsheet (which only shows the latest
  cycle) the database keeps full history.
- **calibration_history (1) → notification_log (N)**: each due date can trigger up to five
  reminder events (30/14/7 days before, on due date, overdue).
- **users (1) → notification_log (N)**: tracks who a LINE reminder was sent to, for audit.
- `equipment.status` is normalized into an ENUM; the original free-text value (e.g.
  `"ยกเลิกการใช้งาน 1/25"`, `"ส่งแคล 19 Jun 2026"`) is preserved in `status_note` since the
  source data encodes dates/reasons inline that don't cleanly fit an enum.
- `equipment.manufacturer` and `equipment.category` are reserved columns — the source
  sheet doesn't currently track manufacturer, and category is inferred from `name`
  until a dedicated field is populated.
