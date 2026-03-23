# ERD

현재 앱의 SQLite 스키마 기준 ERD입니다.

```mermaid
erDiagram
    task_templates {
        text id PK
        text title
        text category
        text memo
        integer is_active
        text created_at
        text updated_at
    }

    recurrence_rules {
        text id PK
        text template_id FK
        text repeat_type
        text repeat_days
        text starts_on
        integer is_active
        text created_at
        text updated_at
    }

    task_tickets {
        text id PK
        text template_id FK
        text recurrence_rule_id FK
        text reminder_rule_id FK
        text task_date
        text status
        text opened_at
        text completed_at
        text created_at
        text updated_at
    }

    reminder_rules {
        text id PK
        text template_id FK
        integer delay_minutes
        text message
        integer repeat_interval_minutes
        integer max_alert_count
        integer is_active
        text created_at
        text updated_at
    }

    reminder_events {
        text id PK
        text rule_id FK
        text task_ticket_id FK
        text scheduled_at
        text sent_at
        text status
        integer repeat_interval_minutes
        integer max_alert_count
        integer sent_count
        text completed_at
        text notification_request_id
    }

    task_templates ||--o{ recurrence_rules : "has"
    task_templates ||--o{ task_tickets : "materializes"
    recurrence_rules ||--o{ task_tickets : "generates"
    task_templates ||--o| reminder_rules : "owns"
    reminder_rules ||--o{ reminder_events : "creates"
    task_tickets ||--o{ reminder_events : "targets"
```

## 메모
- `task_templates`는 루틴 템플릿입니다.
- `recurrence_rules`는 반복 규칙입니다.
- `task_tickets`는 날짜별 실제 수행 티켓입니다.
- `task_tickets.reminder_rule_id`는 티켓 생성 시점의 알림 규칙 연결 정보를 스냅샷으로 가집니다.
- `reminder_rules`는 템플릿당 최대 1개의 활성 알림 규칙을 가집니다.
- `reminder_rules`는 지연 시간, 반복 간격, 최대 알림 횟수를 가집니다.
- `reminder_events`는 티켓 실행 이후 생성되는 알림 이벤트입니다.
