# CompetitionOS — Architecture & Design Specification

> **Version:** 1.0  
> **Status:** Draft  
> **Author:** Senior Product Architect

---

## Table of Contents

1. [Product Requirements Document (PRD)](#1-product-requirements-document-prd)
2. [Domain Model](#2-domain-model)
3. [Bounded Contexts](#3-bounded-contexts)
4. [Ubiquitous Language](#4-ubiquitous-language)
5. [User Personas](#5-user-personas)
6. [User Stories](#6-user-stories)
7. [Functional Requirements](#7-functional-requirements)
8. [Non-functional Requirements](#8-non-functional-requirements)
9. [Entity Relationship Diagram](#9-entity-relationship-diagram)
10. [Aggregate Roots](#10-aggregate-roots)
11. [Domain Events](#11-domain-events)
12. [API Design](#12-api-design)
13. [Database Design](#13-database-design)
14. [Frontend Information Architecture](#14-frontend-information-architecture)
15. [UI Sitemap](#15-ui-sitemap)
16. [Navigation](#16-navigation)
17. [MVP Scope](#17-mvp-scope)
18. [Future Roadmap](#18-future-roadmap)
19. [Risks](#19-risks)
20. [Technical Architecture](#20-technical-architecture)

---

## 1. Product Requirements Document (PRD)

### 1.1 Product Summary

CompetitionOS is a multi-tenant, configurable competition management SaaS platform. It enables organizations to create, manage, and operate competitions of any kind — gaming, sports, academic, corporate, or community — without hardcoding game-specific logic. The platform treats "competition" as the foundational primitive, with games as optional metadata.

### 1.2 Problem Statement

Existing competition management tools are either:
- **Game-specific** (e.g., tournament software built for a single esport title)
- **Too rigid** (cannot adapt to different formats, rules, or scoring systems)
- **Single-tenant** (no organization/multi-competition support)
- **Manual** (no automation for fixtures, brackets, standings, or scheduling)

Organizations running diverse competitions (e.g., a corporate event with chess, pool, and hackathon) must stitch together multiple tools or use spreadsheets.

### 1.3 Target Audience

- Esports organizations (universities, gaming cafes, pro leagues)
- Sports leagues (amateur, semi-pro, school)
- Educational institutions (inter-house competitions, academic olympiads)
- Corporate event organizers (team-building, hackathons)
- Community groups (church leagues, charity tournaments)
- Event management companies (B2B white-label)

### 1.4 Key Differentiators

- **Competition-first, game-agnostic**: No hardcoded game logic
- **Pluggable format engine**: League, tournament, championship — all configurable
- **Rule engine**: Every scoring parameter is configurable per competition
- **Blueprints**: One-click competition templates
- **AI agents**: Orchestrate, not rule — AI never contains business logic
- **Audit trail**: Every mutation is recorded with undo support
- **Multi-tenant by design**: Organizations, members, roles, permissions

### 1.5 Business Goals

1. Achieve vertical-agnostic adoption (esports, sports, education, corporate)
2. Enable non-technical users to launch competitions in under 5 minutes
3. Support 10,000+ concurrent competitions per tenant
4. Zero hardcoded rules — all scoring parameters configurable via UI
5. < 500ms P99 API response for read operations
6. Blueprint marketplace for community-driven templates

---

## 2. Domain Model

### 2.1 Core Domain — Competition Engine

```
Organization
 ├── Members (1..*)
 ├── Roles / Permissions
 ├── Blueprints (0..*)
 └── Competitions (0..*)
      ├── Events (1..*)
      │    ├── Format (League | Tournament | Championship | Custom)
      │    ├── Rules (configurable rule set)
      │    ├── Stages (0..*) — e.g., Group Stage → Knockout
      │    │    └── Rounds (1..*)
      │    │         └── Matches (1..*)
      │    │              ├── Participants (2..*)
      │    │              ├── Results (0..1)
      │    │              └── Scores (0..*)
      │    ├── Participants (0..*)
      │    ├── Standings (generated)
      │    └── Schedule (generated)
      ├── Registration Policy
      └── Championship Settings (if applicable)
```

### 2.2 Supporting Sub-domains

```
Identity & Access ─► Organizations, Members, Roles, Permissions
Registration     ─► Entry, Eligibility, Invites, QR codes
Scheduling       ─► Fixtures, Matchdays, Venues, Time slots
Notifications    ─► Email, Push, In-app
Statistics       ─► Player stats, Head-to-head, Achievements
Audit            ─► Event log, Snapshots, Undo
AI Agents        ─► Orchestration layer (no business rules)
Billing          ─► Plans, Subscriptions, Usage metering (future)
```

---

## 3. Bounded Contexts

### 3.1 Context Map

```
┌─────────────────────┐     ┌──────────────────────┐
│   Identity & Access  │◄────│   Registration       │
│   (Core)             │     │   (Supporting)       │
└──────────┬──────────┘     └──────────┬───────────┘
           │                           │
           ▼                           ▼
┌─────────────────────┐     ┌──────────────────────┐
│   Competition       │◄────│   Scheduling          │
│   Engine (Core)     │     │   (Supporting)        │
│                     │     │                       │
│  ┌───────────────┐  │     │  Fixtures, Matchdays  │
│  │ Format Engine │  │     │  Venues, Time Slots   │
│  │ (Core/Generic)│  │     └──────────────────────┘
│  │  • League     │  │                ▲
│  │  • Tournament │  │                │
│  │  • Championship│ │                ▼
│  └───────────────┘  │     ┌──────────────────────┐
│  ┌───────────────┐  │     │   Match Management   │
│  │ Rule Engine   │  │     │   (Core)             │
│  │ (Core/Generic)│  │     │                      │
│  └───────────────┘  │     │  Score, Finalize,    │
└──────────┬──────────┘     │  Results, Status      │
           │                └──────────────────────┘
           ▼
┌─────────────────────┐     ┌──────────────────────┐
│   Statistics        │     │   Audit Trail         │
│   (Supporting)      │     │   (Generic)           │
└─────────────────────┘     └──────────────────────┘
           ▲                           ▲
           │                           │
┌──────────┴──────────┐     ┌──────────┴───────────┐
│   AI Agent Layer    │     │   Blueprint Engine   │
│   (Generic)         │     │   (Supporting)        │
└─────────────────────┘     └──────────────────────┘
           ▲
           │
┌──────────┴──────────┐
│   Notifications     │
│   (Generic)         │
└─────────────────────┘
```

### 3.2 Context Descriptions

| Bounded Context | Type | Description |
|---|---|---|
| **Identity & Access** | Core | Organizations, members, roles, permissions. Multi-tenant foundation. |
| **Competition Engine** | Core | Competition lifecycle, format execution, rule evaluation. The heart of the system. |
| **Format Engine** | Core/Generic | Pluggable format implementations (League, Tournament, etc.). Strategy pattern. |
| **Rule Engine** | Core/Generic | Configurable rule evaluation. No hardcoded values. |
| **Match Management** | Core | Match lifecycle — creation, scoring, finalization, status transitions. |
| **Registration** | Supporting | Entry management, invites, QR codes, eligibility checks. |
| **Scheduling** | Supporting | Fixture generation, matchday creation, venue/time management. |
| **Statistics** | Supporting | Player/team statistics aggregation, head-to-head, achievements. |
| **Audit Trail** | Generic | Event sourcing for undo support, compliance, transparency. |
| **AI Agent Layer** | Generic | Orchestration agents — never contain business rules. |
| **Blueprint Engine** | Supporting | Template creation, sharing, import/export. |
| **Notifications** | Generic | Multi-channel notification dispatch. |
| **Billing** | Supporting | Subscription management, usage metering (future). |

---

## 4. Ubiquitous Language

| Term | Definition |
|---|---|
| **Organization** | A tenant — the owning entity for competitions, members, and blueprints. |
| **Member** | A user who belongs to one or more organizations with assigned roles. |
| **Competition** | A top-level container for one or more Events (e.g., "Boxfusion Gaming Championship"). |
| **Event** | A single competitive activity within a Competition (e.g., "EA FC League"). Has a Format and Rules. |
| **Format** | The structural pattern of an Event — League, Tournament, Championship, Custom. Pluggable. |
| **Rule** | A configurable key-value parameter that governs scoring, progression, or behavior. |
| **Rule Set** | A collection of Rules applied to an Event or Format. |
| **Stage** | A phase within an Event (e.g., Group Stage → Knockout). Some Formats have multiple stages. |
| **Round** | A round within a Stage (e.g., Matchday 1, Quarter-finals). |
| **Match** | A single contest between 2+ Participants. |
| **Participant** | An individual or team competing in an Event. |
| **Entry** | A registration request to join a Competition or Event. |
| **Result** | The outcome of a Match — winner, scores, status. |
| **Standings** | A calculated ranking of Participants based on Event Rules. |
| **Fixture** | A scheduled Match between designated Participants. |
| **Bracket** | A visual representation of tournament progression (Winner's, Loser's, Finals). |
| **Blueprint** | A reusable template containing Competition/Event/Rules configuration. |
| **Championship** | A meta-format — a series of Events over time with cumulative points leading to Finals. |
| **Seed** | A predetermined rank used for bracket placement. |
| **BYE** | A free pass for a Participant when the bracket has an uneven number. |
| **Playoff** | A post-season knockout phase following a League Stage. |
| **Qualification** | The process of determining which Participants advance to the next Stage. |
| **Podium** | Top 3/4/8 finishers in an Event (configurable). |
| **Head-to-Head** | A tiebreaker comparing results between tied Participants. |
| **Achievement** | A milestone-based badge or award earned by a Participant. |
| **Snapshot** | An immutable record of aggregate state at a point in time (for undo). |
| **Audit Entry** | A single recorded mutation in the event log. |

---

## 5. User Personas

### 5.1 Tournament Director — Thabo

- **Role**: Organizer of a university esports league
- **Goals**: Create a semester-long competition with 4 games, auto-generate fixtures, track standings, qualify top 4 to finals
- **Needs**: Blueprint for next semester, QR check-in, role-based access for moderators
- **Pain Points**: Currently using spreadsheets + discord polls — no automation

### 5.2 League Administrator — Priya

- **Role**: Corporate event manager at a large tech company
- **Goals**: Monthly gaming nights with point accumulation, season leaderboard, automated scheduling
- **Needs**: Configurable scoring (participation points, placement points), email notifications, PDF reports
- **Pain Points**: Manual point tracking, no historical stats, hard to scale to 500+ employees

### 5.3 Competitor — Jordan

- **Role**: Player in multiple competitions
- **Goals**: Register once, join multiple events, track personal stats, receive notifications
- **Needs**: Clean UI, mobile-friendly, one-click registration, see head-to-head record
- **Pain Points**: Forgetting match times, no unified profile across events

### 5.4 Referee/Moderator — Carlos

- **Role**: Match official for fighting game tournaments
- **Goals**: Input match results quickly, handle disputes, finalize matches
- **Needs**: Mobile-optimized score entry, dispute workflow, match history
- **Pain Points**: Too many clicks to enter a simple "Player A beat Player B" result

### 5.5 System Administrator — Amara

- **Role**: Manages the platform itself
- **Goals**: Monitor tenant usage, ensure uptime, manage feature flags
- **Needs**: Admin dashboard, audit log access, performance metrics
- **Pain Points**: No visibility into tenant activity, hard to debug issues

---

## 6. User Stories

### 6.1 Organization Management

```
As a Tournament Director
I want to create an organization
So that I can manage competitions under my brand

As a Tournament Director
I want to invite members with specific roles
So that I can delegate competition management

As a System Administrator
I want to suspend an organization
So that I can enforce terms of service
```

### 6.2 Competition & Event Management

```
As a Tournament Director
I want to create a Competition with multiple Events
So that participants can join different activities under one umbrella

As a Tournament Director
I want to configure Format-specific Rules for each Event
So that scoring and progression match my requirements

As a Tournament Director
I want to set registration policies per Event
So that I control who can join and when

As a Tournament Director
I want to duplicate a Competition
So that I can quickly set up recurring events
```

### 6.3 Registration

```
As a Competitor
I want to register for a Competition
So that I can participate in its Events

As a Competitor
I want to join using an invite link or QR code
So that I don't need to search for the competition

As a Competitor
I want to register for multiple Events at once
So that I save time

As a Tournament Director
I want to manually add or remove participants
So that I can manage special cases
```

### 6.4 League Management

```
As a Tournament Director
I want to generate fixtures automatically
So that I don't have to create matchups manually

As a Tournament Director
I want to configure home/away (double round robin)
So that my league mirrors real sports formats

As a Tournament Director
I want standings to update automatically after each match
So that participants always see current rankings

As a Tournament Director
I want to qualify top N participants to playoffs
So that the league transitions to a knockout phase
```

### 6.5 Tournament Management

```
As a Tournament Director
I want to generate a Single Elimination bracket
So that matches proceed in a knockout format

As a Tournament Director
I want to generate a Double Elimination bracket
So that participants get a second chance

As a Tournament Director
I want to configure seeding manually or automatically
So that top players don't meet early

As a Tournament Director
I want to handle BYEs automatically
So that brackets balance correctly

As a Tournament Director
I want a Swiss system for large pools
So that participants play a fixed number of rounds
```

### 6.6 Match Management

```
As a Referee
I want to enter a simple winner-only result
So that fighting game matches are recorded quickly

As a Referee
I want to enter detailed scores (goals, rounds, points)
So that tiebreakers have data to resolve

As a Referee
I want to mark a match as disputed
So that the Tournament Director can review

As a Tournament Director
I want to undo the last result entry
So that mistakes are fixable
```

### 6.7 Championship Management

```
As a Tournament Director
I want to configure a monthly points series
So that participants accumulate points over time

As a Tournament Director
I want to define point values for each placement
So that higher placements earn more

As a Tournament Director
I want to auto-qualify top participants to a finals event
So that the season concludes with a championship

As a Competitor
I want to see my season standings
So that I know my qualification status
```

### 6.8 Statistics & Analytics

```
As a Competitor
I want to view my win/loss record across all events
So that I can track my performance

As a Competitor
I want to see head-to-head records against other players
So that I know my rivalry stats

As a Tournament Director
I want to see participation and engagement metrics
So that I can report to stakeholders
```

### 6.9 Blueprints

```
As a Tournament Director
I want to save a Competition as a Blueprint
So that I can reuse the configuration

As a Tournament Director
I want to share a Blueprint with other organizations
So that the community benefits from templates

As a Tournament Director
I want to import a Blueprint from JSON
So that I can migrate from other systems
```

### 6.10 AI Agents

```
As a Tournament Director
I want the AI Competition Architect to recommend a format
Based on participant count and time constraints

As a Tournament Director
I want the AI Fixture Generator to propose an optimal schedule
Balancing availability, venue capacity, and match duration

As a Tournament Director
I want the AI Rules Assistant to explain rule implications
When configuring complex rule sets
```

---

## 7. Functional Requirements

### 7.1 Organization Management

| ID | Requirement |
|---|---|
| F-ORG-01 | System SHALL support multi-tenant organizations |
| F-ORG-02 | Organizations SHALL have a unique slug/domain |
| F-ORG-03 | System SHALL support role-based access control (Owner, Admin, Moderator, Referee, Member) |
| F-ORG-04 | Organizations MAY have custom branding (logo, colors, domain) |
| F-ORG-05 | Members MAY belong to multiple organizations |
| F-ORG-06 | Roles SHALL have granular permissions (create, read, update, delete per resource) |

### 7.2 Competition Management

| ID | Requirement |
|---|---|
| F-COMP-01 | A Competition SHALL contain one or more Events |
| F-COMP-02 | A Competition SHALL have a name, description, logo, and date range |
| F-COMP-03 | Competition visibility SHALL be Public, Private (by invite), or Hidden (by link) |
| F-COMP-04 | A Competition MAY reference a Game as optional metadata |
| F-COMP-05 | A Competition MAY be duplicated in-place |
| F-COMP-06 | A Competition MAY be soft-deleted (with configurable retention period) |

### 7.3 Event Management

| ID | Requirement |
|---|---|
| F-EVT-01 | Each Event SHALL have exactly one Format |
| F-EVT-02 | Each Event SHALL have a Rule Set |
| F-EVT-03 | Events SHALL support participant type: Individual or Team |
| F-EVT-04 | Events MAY have a maximum participant count |
| F-EVT-05 | Events MAY have a minimum participant count |
| F-EVT-06 | Events SHALL have a status: Draft, Open, InProgress, Completed, Cancelled |
| F-EVT-07 | Participants MAY join one or more Events within a Competition |
| F-EVT-08 | Events within a Competition MAY share participants |

### 7.4 Format Engine

| ID | Requirement |
|---|---|
| F-FMT-01 | The Format Engine SHALL support: League, SingleElimination, DoubleElimination, Swiss, GroupStage, Ladder, Custom |
| F-FMT-02 | Formats SHALL be pluggable — adding a new format MUST NOT require changes to existing formats |
| F-FMT-03 | Each Format SHALL define its Stage lifecycle (e.g., GroupStage → Bracket) |
| F-FMT-04 | Each Format SHALL define its Match generation algorithm |
| F-FMT-05 | Each Format SHALL define its Standings/Progression calculation |
| F-FMT-06 | Custom Formats MAY be uploaded as configuration (JSON/YAML) |

### 7.5 Rule Engine

| ID | Requirement |
|---|---|
| F-RULE-01 | Rules SHALL be key-value pairs scoped to an Event's Format |
| F-RULE-02 | Rules SHALL have a type: Number, Boolean, String, Selection, JSON |
| F-RULE-03 | Rules SHALL have a default value per Format |
| F-RULE-04 | The Rule Engine SHALL evaluate rules without hardcoded logic |
| F-RULE-05 | Rule changes to an InProgress Event SHALL be flagged with a warning |
| F-RULE-06 | Rules SHALL support validation constraints (min, max, required, regex) |

### 7.6 Registration

| ID | Requirement |
|---|---|
| F-REG-01 | Registration SHALL be open, invite-only, approval-required, or closed |
| F-REG-02 | Invite links SHALL support expiration |
| F-REG-03 | QR codes SHALL be generated per Competition and per Event |
| F-REG-04 | Participants MAY register for multiple Events simultaneously |
| F-REG-05 | Registration SHALL enforce Event capacity limits |
| F-REG-06 | Registration SHALL check eligibility rules (e.g., max events per participant) |
| F-REG-07 | Tournament Directors MAY manually register or remove participants |

### 7.7 Match Management

| ID | Requirement |
|---|---|
| F-MATCH-01 | Matches SHALL support 2-player (default) and multi-participant (e.g., FFA) |
| F-MATCH-02 | Matches SHALL support simple (winner-only) and detailed (scores) results |
| F-MATCH-03 | Match results SHALL trigger automatic standing/bracket updates |
| F-MATCH-04 | Matches MAY be disputed — requiring admin review |
| F-MATCH-05 | Match statuses: Scheduled, InProgress, Completed, Disputed, Cancelled, Walkover |
| F-MATCH-06 | Completed matches MAY be undone (within a configurable window) |
| F-MATCH-07 | Match undo SHALL reverse all downstream effects |

### 7.8 League Engine

| ID | Requirement |
|---|---|
| F-LEAGUE-01 | League SHALL support Single Round Robin and Double Round Robin |
| F-LEAGUE-02 | Fixture generation SHALL use circle method algorithm |
| F-LEAGUE-03 | Standings SHALL be calculated from the Rule Set (win points, draw points, etc.) |
| F-LEAGUE-04 | Standings SHALL support tiebreakers: H2H, Goal Difference, Goals Scored, Custom |
| F-LEAGUE-05 | League SHALL support qualification: Top N advance to next Stage |
| F-LEAGUE-06 | League MAY split into divisions/groups with promotion/relegation |

### 7.9 Tournament Engine

| ID | Requirement |
|---|---|
| F-TOUR-01 | Single Elimination SHALL generate a balanced bracket with BYEs |
| F-TOUR-02 | Double Elimination SHALL generate Winner's and Loser's brackets |
| F-TOUR-03 | Double Elimination MAY support bracket reset for finals |
| F-TOUR-04 | Swiss SHALL pair participants with similar records each round |
| F-TOUR-05 | Group Stage SHALL split participants into groups, each running Round Robin |
| F-TOUR-06 | Bracket visualization SHALL update in real-time as matches complete |

### 7.10 Championship Engine

| ID | Requirement |
|---|---|
| F-CHAMP-01 | A Championship SHALL define a series of Events over a date range |
| F-CHAMP-02 | The Championship SHALL define a points schedule (e.g., 1st=10, 2nd=7, ...) |
| F-CHAMP-03 | Points SHALL accumulate across Events |
| F-CHAMP-04 | Season standings SHALL be calculated from accumulated points |
| F-CHAMP-05 | Championship SHALL support qualification thresholds for Finals |
| F-CHAMP-06 | Participation points SHALL be configurable |

### 7.11 Statistics

| ID | Requirement |
|---|---|
| F-STAT-01 | Player statistics SHALL include Wins, Losses, Draws, Win% |
| F-STAT-02 | Statistics SHALL be filterable by Competition, Event, and date range |
| F-STAT-03 | Head-to-head records SHALL be calculated between any two participants |
| F-STAT-04 | Achievements SHALL be milestone-based (e.g., 10 wins, first tournament win) |
| F-STAT-05 | Statistics SHALL be cachable with configurable TTL |

### 7.12 Audit Trail

| ID | Requirement |
|---|---|
| F-AUDIT-01 | Every state mutation SHALL create an Audit Entry |
| F-AUDIT-02 | Audit Entries SHALL include: actor, action, resource, timestamp, diff, snapshot |
| F-AUDIT-03 | Audit Entries SHALL be immutable |
| F-AUDIT-04 | The system SHALL support undo via snapshot restoration |
| F-AUDIT-05 | Audit logs SHALL be queryable by resource, actor, action, and date range |
| F-AUDIT-06 | Audit retention SHALL be configurable per organization |

### 7.13 Notifications

| ID | Requirement |
|---|---|
| F-NOTIF-01 | Notifications SHALL support Email, Push, and In-app channels |
| F-NOTIF-02 | Notification preferences SHALL be configurable per member |
| F-NOTIF-03 | Match reminders SHALL be sent N minutes before scheduled time |
| F-NOTIF-04 | Result confirmation SHALL be sent after match finalization |
| F-NOTIF-05 | Standing changes SHALL trigger notifications for affected participants |
| F-NOTIF-06 | Invitations SHALL be delivered via email with a direct link |

### 7.14 Blueprints

| ID | Requirement |
|---|---|
| F-BLUE-01 | A Blueprint SHALL capture: Competition, Events, Formats, and Rule Sets |
| F-BLUE-02 | Blueprints SHALL be exportable as JSON |
| F-BLUE-03 | Blueprints SHALL be importable from JSON with validation |
| F-BLUE-04 | Blueprints MAY be shared between organizations |
| F-BLUE-05 | Blueprints SHALL support versioning |
| F-BLUE-06 | Blueprints MAY have a marketplace (future) |

---

## 8. Non-functional Requirements

### 8.1 Performance

| ID | Requirement |
|---|---|
| NFR-PERF-01 | Read API P99 latency SHALL be < 500ms |
| NFR-PERF-02 | Write API P99 latency SHALL be < 1000ms |
| NFR-PERF-03 | Bracket/Standings calculation SHALL complete in < 2s for 1000 participants |
| NFR-PERF-04 | Dashboard page load SHALL be < 2s (First Contentful Paint) |
| NFR-PERF-05 | Fixture generation for 100 participants SHALL complete in < 3s |
| NFR-PERF-06 | System SHALL support 10,000 concurrent API requests per tenant |

### 8.2 Scalability

| ID | Requirement |
|---|---|
| NFR-SCAL-01 | System SHALL scale horizontally (stateless application layer) |
| NFR-SCAL-02 | Database SHALL support read replicas |
| NFR-SCAL-03 | System SHALL support 1M+ participants per tenant |
| NFR-SCAL-04 | System SHALL support 10M+ matches overall |
| NFR-SCAL-05 | Caching layer SHALL be distributed (Redis) |
| NFR-SCAL-06 | Background jobs SHALL use a message queue (RabbitMQ / SQS) |

### 8.3 Availability

| ID | Requirement |
|---|---|
| NFR-AVAIL-01 | System SHALL target 99.9% uptime |
| NFR-AVAIL-02 | Planned maintenance SHALL be notified 7 days in advance |
| NFR-AVAIL-03 | Database SHALL have automated backups every 6 hours |
| NFR-AVAIL-04 | System SHALL support multi-region deployment (future) |

### 8.4 Security

| ID | Requirement |
|---|---|
| NFR-SEC-01 | All API traffic SHALL use HTTPS/TLS 1.3 |
| NFR-SEC-02 | Authentication SHALL use JWT with short-lived access tokens (15min) |
| NFR-SEC-03 | Refresh tokens SHALL be rotate-on-use |
| NFR-SEC-04 | All inputs SHALL be validated and sanitized |
| NFR-SEC-05 | Rate limiting SHALL be applied per-tenant and per-endpoint |
| NFR-SEC-06 | Audit logs SHALL NOT contain PII or secrets |
| NFR-SEC-07 | Data SHALL be encrypted at rest (AES-256) |
| NFR-SEC-08 | RBAC SHALL be enforced at the API gateway layer |

### 8.5 Data Integrity

| ID | Requirement |
|---|---|
| NFR-DATA-01 | Competition state SHALL be eventually consistent within 5s |
| NFR-DATA-02 | Match results SHALL be strongly consistent (no double-finalization) |
| NFR-DATA-03 | Standings and brackets SHALL be recalculated within 10s of match finalization |
| NFR-DATA-04 | Audit logs SHALL be append-only with no deletion |
| NFR-DATA-05 | Undo operations SHALL restore full aggregate consistency |

### 8.6 Maintainability

| ID | Requirement |
|---|---|
| NFR-MAINT-01 | New Format implementations SHALL NOT require changes to existing code (Strategy + Plugin pattern) |
| NFR-MAINT-02 | All domain logic SHALL be testable in isolation (unit tests) |
| NFR-MAINT-03 | API documentation SHALL be auto-generated (OpenAPI 3.0) |
| NFR-MAINT-04 | Code SHALL follow DDD with clear separation between domain, application, and infrastructure |
| NFR-MAINT-05 | Feature flags SHALL be used for gradual rollouts |

### 8.7 Observability

| ID | Requirement |
|---|---|
| NFR-OBS-01 | All services SHALL emit structured logs (JSON) |
| NFR-OBS-02 | Distributed tracing SHALL be implemented (OpenTelemetry) |
| NFR-OBS-03 | Metrics SHALL be collected for: request rate, latency, error rate, saturation |
| NFR-OBS-04 | Business metrics SHALL be tracked: active competitions, matches/day, registrations |
| NFR-OBS-05 | Alerts SHALL be configured for P1 (down) and P2 (degraded) incidents |

---

## 9. Entity Relationship Diagram

```
┌─────────────────┐       ┌──────────────────────┐
│   Organization   │       │   OrganizationMember  │
├─────────────────┤       ├──────────────────────┤
│ id (PK)         │──1:N──│ organization_id (FK)  │
│ name             │       │ member_id (FK)        │
│ slug             │       │ role (Enum)           │
│ logo_url         │       │ permissions (JSONB)   │
│ settings (JSONB) │       │ joined_at             │
│ created_at       │       └──────────────────────┘
│ updated_at       │                  │
└─────────────────┘                  │
         │ 1                         │ N
         │                           │
         │ N                 ┌───────┴────────┐
         │                   │     Member      │
         ▼                   ├────────────────┤
┌─────────────────┐          │ id (PK)         │
│    Blueprint     │          │ email            │
├─────────────────┤          │ display_name     │
│ id (PK)          │          │ avatar_url       │
│ organization_id  │          │ auth_provider_id │
│ name              │          │ created_at       │
│ description       │          └─────────────────┘
│ config (JSONB)    │
│ version           │                 ▲
│ is_public         │                 │
│ created_at        │                 │ 1
│ updated_at        │                 │
└─────────────────┘                 │ N
         │                  ┌────────┴────────┐
         │ 1:N              │   Participant    │
         ▼                  ├─────────────────┤
┌─────────────────┐         │ id (PK)          │
│   Competition    │         │ member_id (FK)   │
├─────────────────┤         │ event_id (FK)    │
│ id (PK)          │──1:N──►│ team_id (FK)     │
│ organization_id  │         │ seed             │
│ blueprint_id (FK)│         │ status           │
│ name              │         │ registered_at    │
│ description       │         └─────────────────┘
│ logo_url          │                   │
│ visibility (Enum) │                   │ N
│ game (JSONB)      │                   │
│ date_start        │                   ▼
│ date_end          │         ┌─────────────────┐
│ status (Enum)     │         │    Team         │
│ created_at        │         ├─────────────────┤
│ updated_at        │         │ id (PK)          │
└─────────────────┘         │ name             │
         │ 1                 │ member_ids (FK)  │
         │                   │ avatar_url       │
         │ N                 │ created_at       │
         ▼                   └─────────────────┘
┌─────────────────┐
│     Event        │
├─────────────────┤
│ id (PK)          │
│ competition_id   │
│ name              │
│ format (Enum)     │
│ participant_type  │
│ max_participants  │
│ min_participants  │
│ status (Enum)     │
│ config (JSONB)    │
│ date_start        │
│ date_end          │
│ created_at        │
│ updated_at        │
└───┬─────────────┘
    │ 1
    │
    │ N
    ▼
┌─────────────────┐       ┌─────────────────┐
│    RuleSet       │       │      Rule        │
├─────────────────┤       ├─────────────────┤
│ id (PK)          │──1:N──│ id (PK)          │
│ event_id (FK)    │       │ ruleset_id (FK)  │
│ name              │       │ key (string)     │
│ created_at       │       │ value (JSONB)    │
│ updated_at       │       │ type (Enum)      │
└─────────────────┘       │ validation (JSONB)│
                           │ created_at       │
                           └─────────────────┘

┌─────────────────┐
│     Stage        │
├─────────────────┤
│ id (PK)          │
│ event_id (FK)    │──1:N
│ name              │
│ type (Enum)       │
│ order_index       │
│ config (JSONB)    │
│ created_at       │
└─────────────────┘
         │ 1
         │
         │ N
         ▼
┌─────────────────┐
│     Round        │
├─────────────────┤
│ id (PK)          │
│ stage_id (FK)    │──1:N
│ name              │
│ round_number     │
│ config (JSONB)    │
│ created_at       │
└─────────────────┘
         │ 1
         │
         │ N
         ▼
┌─────────────────┐       ┌─────────────────┐
│     Match        │       │   MatchResult    │
├─────────────────┤       ├─────────────────┤
│ id (PK)          │──1:1──│ id (PK)          │
│ round_id (FK)    │       │ match_id (FK)    │
│ bracket_group    │       │ winner_id        │
│   (Enum)         │       │ scores (JSONB)   │
│ status (Enum)    │       │ is_walkover      │
│ scheduled_at     │       │ notes             │
│ venue             │       │ finalized_by     │
│ config (JSONB)    │       │ finalized_at     │
│ created_at       │       └─────────────────┘
└─────────────────┘
         │ 1:N
         ▼
┌─────────────────┐
│  MatchParticipant │
├─────────────────┤
│ match_id (FK)    │
│ participant_id   │
│ position (seed)  │
│ result (Enum)    │
│ score             │
└─────────────────┘

┌──────────────────────┐
│     Standing          │
├──────────────────────┤
│ id (PK)               │
│ event_id (FK)         │
│ participant_id (FK)   │
│ stage_id (FK)         │
│ rank                  │
│ points                │
│ wins                  │
│ losses                │
│ draws                 │
│ stats (JSONB)         │
│ calculated_at         │
└──────────────────────┘

┌──────────────────────┐
│   ChampionshipPoints  │
├──────────────────────┤
│ id (PK)               │
│ championship_id       │
│ participant_id        │
│ total_points          │
│ events_played         │
│ placement_history     │
│ calculated_at         │
└──────────────────────┘

┌───────────────────┐   ┌───────────────────┐
│   AuditEntry       │   │   Notification    │
├───────────────────┤   ├───────────────────┤
│ id (PK)            │   │ id (PK)            │
│ organization_id    │   │ member_id         │
│ actor_id           │   │ channel (Enum)    │
│ action (string)    │   │ type (Enum)       │
│ resource_type      │   │ title             │
│ resource_id        │   │ body              │
│ diff (JSONB)       │   │ data (JSONB)      │
│ snapshot (JSONB)   │   │ read_at           │
│ metadata (JSONB)   │   │ delivered_at      │
│ created_at         │   │ created_at        │
└───────────────────┘   └───────────────────┘

┌───────────────────┐
│   Statistic        │
├───────────────────┤
│ id (PK)            │
│ participant_id    │
│ event_id (FK)      │
│ competition_id(FK) │
│ metric (string)    │
│ value (JSONB)      │
│ updated_at         │
└───────────────────┘
```

---

## 10. Aggregate Roots

### 10.1 Aggregate Selection (DDD)

| Aggregate Root | Entity | Invariants | Notes |
|---|---|---|---|
| **Organization** | OrganizationMember | Unique slug; owner always exists; role hierarchy | High-traffic; separate bounded context via ID |
| **Competition** | Event | Events belong to exactly one Competition; visibility constraints | Moderate writes; high reads for public view |
| **Event** | Stage, Round, RuleSet, Standing | Format determines lifecycle; rules apply to all matches | Core aggregate; most complex consistency boundary |
| **Match** | MatchParticipant, MatchResult | Single finalization; score after finalized is immutable | Very high throughput; eventual consistency to parent aggregates |
| **Participant** | (none - value object in Event context) | Unique per Event | Often queried independently, but no own aggregate |
| **Blueprint** | (none - self-contained) | Version increments; import validates schema | Low churn; simple CRUD |
| **Championship** | ChampionshipPoints | Points accumulate monotonically; qualification deterministic | Seasonal; moderate writes |

### 10.2 Consistency Boundaries

| Decision | Rationale |
|---|---|
| Match is its own aggregate | High write throughput. Finalizing a match must not lock the Event aggregate. Event standings recalculate asynchronously. |
| Stage/Round inside Event aggregate | Stage lifecycle is tightly coupled to Event. A new stage cannot exist without an Event. |
| Standing is separate but eventually consistent | Standing recalculation is triggered by domain events, not inline. This avoids write contention on the Event during high-match-volume periods. |
| Participant is cross-cutting but owned by Event context | Participant identity is simple; what matters is their relationship to Events. We use a Participant view model shared across contexts. |

---

## 11. Domain Events

### 11.1 Event Catalog

| Event | Publisher | Subscribers | Description |
|---|---|---|---|
| `CompetitionCreated` | Competition | Notification, Audit | A new competition was created |
| `CompetitionPublished` | Competition | Registration (opens), Notification | Competition opened for registration |
| `EventCreated` | Event | Format Engine (init), Audit | A new event was created within a competition |
| `EventStarted` | Event | Scheduling (generate fixtures), Notification | Event moved to InProgress |
| `EventCompleted` | Event | Statistics, Championship, Notification | All matches finalized, event is done |
| `ParticipantRegistered` | Registration | Event (capacity check), Notification | A member registered for an event |
| `ParticipantDroppedOut` | Registration | Event, Match (walkover), Standing | Participant removed from event |
| `MatchScheduled` | Scheduling | Notification, Event | Match assigned time/venue |
| `MatchStarted` | Match Management | Audit, Notification | Match moved to InProgress |
| `MatchResultSubmitted` | Match Management | Match (validation), Audit | Result entered, awaiting finalization |
| `MatchFinalized` | Match Management | Standing/Bracket (recalc), Statistics, Championship, Notification | Result is official, trigger downstream |
| `MatchDisputed` | Match Management | Notification (admin), Audit | Participant contested the result |
| `MatchDisputeResolved` | Match Management | Standing/Bracket (recalc), Audit | Admin resolved the dispute |
| `MatchUndone` | Match Management | Standing/Bracket (recalc), Statistics, Audit | Match result was undone |
| `StandingsRecalculated` | Competition Engine | Notification, Statistics | Standings updated after batch of changes |
| `BracketUpdated` | Tournament Engine | Notification, UI (real-time) | Tournament bracket changed |
| `StageCompleted` | Event | Event (advance to next stage) | All matches in a stage are complete |
| `QualificationDetermined` | Competition Engine | Event (generate next stage), Notification | Qualifiers identified |
| `ChampionshipPointsAwarded` | Championship | Championship Standing, Notification | Points allocated for event placement |
| `BlueprintCreated` | Blueprint Engine | (none) | Blueprint saved for reuse |
| `BlueprintShared` | Blueprint Engine | Notification | Blueprint shared with another org |
| `AuditSnapshotCreated` | Audit | (persistence) | State snapshot for undo |

### 11.2 Event Storming Notes

The hottest path is:
```
MatchFinalized → StandingsRecalculated / BracketUpdated → Notification
```

This must be:
1. Asynchronous (event bus / message queue)
2. Idempotent (recalculation can retry)
3. Batch-aware (multiple match finalizations in quick succession should debounce)

**Recommendation**: Debounce StandingsRecalculated — collect match finalization events for 500ms before triggering a recalculation.

---

## 12. API Design

### 12.1 Design Principles

- RESTful (not RPC) for CRUD operations
- Consistent URL structure: `/organizations/{orgSlug}/{resource}`
- Pagination: cursor-based (not offset) for all list endpoints
- Versioning: URL prefix `/v1/` (or accept header)
- Error format: RFC 7807 (Problem Details)
- Idempotency: POST mutations accept `Idempotency-Key` header for retry safety
- Caching: `ETag` + `If-None-Match` for GET resources
- WebSocket for real-time (bracket updates, live scores)

### 12.2 API Endpoints

```
# ─────────────────────────────────────────────
# Organizations
# ─────────────────────────────────────────────
GET    /v1/organizations                              # List organizations
POST   /v1/organizations                              # Create organization
GET    /v1/organizations/{orgSlug}                    # Get organization
PATCH  /v1/organizations/{orgSlug}                    # Update organization
DELETE /v1/organizations/{orgSlug}                    # Soft-delete organization

# Members
GET    /v1/organizations/{orgSlug}/members             # List members
POST   /v1/organizations/{orgSlug}/members/invite      # Invite member
PATCH  /v1/organizations/{orgSlug}/members/{memberId}  # Update role/permissions
DELETE /v1/organizations/{orgSlug}/members/{memberId}  # Remove member

# ─────────────────────────────────────────────
# Competitions
# ─────────────────────────────────────────────
GET    /v1/organizations/{orgSlug}/competitions                                    # List competitions
POST   /v1/organizations/{orgSlug}/competitions                                    # Create competition
GET    /v1/organizations/{orgSlug}/competitions/{compId}                           # Get competition
PATCH  /v1/organizations/{orgSlug}/competitions/{compId}                           # Update competition
DELETE /v1/organizations/{orgSlug}/competitions/{compId}                           # Soft-delete
POST   /v1/organizations/{orgSlug}/competitions/{compId}/duplicate                 # Duplicate
POST   /v1/organizations/{orgSlug}/competitions/{compId}/publish                   # Publish
POST   /v1/organizations/{orgSlug}/competitions/{compId}/archive                   # Archive

# ─────────────────────────────────────────────
# Events
# ─────────────────────────────────────────────
GET    /v1/organizations/{orgSlug}/competitions/{compId}/events                    # List events
POST   /v1/organizations/{orgSlug}/competitions/{compId}/events                    # Create event
GET    /v1/organizations/{orgSlug}/competitions/{compId}/events/{eventId}          # Get event
PATCH  /v1/organizations/{orgSlug}/competitions/{compId}/events/{eventId}          # Update event
DELETE /v1/organizations/{orgSlug}/competitions/{compId}/events/{eventId}          # Delete event
POST   /v1/organizations/{orgSlug}/competitions/{compId}/events/{eventId}/start    # Start event
POST   /v1/organizations/{orgSlug}/competitions/{compId}/events/{eventId}/complete # Complete event

# ─────────────────────────────────────────────
# Rules
# ─────────────────────────────────────────────
GET    /v1/organizations/{orgSlug}/competitions/{compId}/events/{eventId}/rules            # Get rule set
PUT    /v1/organizations/{orgSlug}/competitions/{compId}/events/{eventId}/rules            # Replace rule set
PATCH  /v1/organizations/{orgSlug}/competitions/{compId}/events/{eventId}/rules            # Update specific rules

# ─────────────────────────────────────────────
# Participants / Registration
# ─────────────────────────────────────────────
GET    /v1/organizations/{orgSlug}/competitions/{compId}/events/{eventId}/participants      # List participants
POST   /v1/organizations/{orgSlug}/competitions/{compId}/events/{eventId}/participants      # Register (self)
POST   /v1/organizations/{orgSlug}/competitions/{compId}/events/{eventId}/register          # Admin register
DELETE /v1/organizations/{orgSlug}/competitions/{compId}/events/{eventId}/participants/{pId} # Remove participant

# ─────────────────────────────────────────────
# Stages & Rounds
# ─────────────────────────────────────────────
GET    /v1/organizations/{orgSlug}/competitions/{compId}/events/{eventId}/stages             # List stages
POST   /v1/organizations/{orgSlug}/competitions/{compId}/events/{eventId}/stages             # Add stage
GET    /v1/organizations/{orgSlug}/competitions/{compId}/events/{eventId}/stages/{stageId}/rounds  # List rounds

# ─────────────────────────────────────────────
# Matches
# ─────────────────────────────────────────────
GET    /v1/organizations/{orgSlug}/competitions/{compId}/events/{eventId}/matches            # List matches
GET    /v1/organizations/{orgSlug}/competitions/{compId}/events/{eventId}/matches/{matchId}  # Get match
PATCH  /v1/organizations/{orgSlug}/competitions/{compId}/events/{eventId}/matches/{matchId}  # Update match (scheduling)
POST   /v1/organizations/{orgSlug}/competitions/{compId}/events/{eventId}/matches/{matchId}/submit-result    # Submit result
POST   /v1/organizations/{orgSlug}/competitions/{compId}/events/{eventId}/matches/{matchId}/finalize         # Finalize match
POST   /v1/organizations/{orgSlug}/competitions/{compId}/events/{eventId}/matches/{matchId}/dispute          # Dispute match
POST   /v1/organizations/{orgSlug}/competitions/{compId}/events/{eventId}/matches/{matchId}/resolve-dispute  # Resolve dispute
POST   /v1/organizations/{orgSlug}/competitions/{compId}/events/{eventId}/matches/{matchId}/undo             # Undo match

# ─────────────────────────────────────────────
# Standings / Brackets
# ─────────────────────────────────────────────
GET    /v1/organizations/{orgSlug}/competitions/{compId}/events/{eventId}/standings     # Get standings
GET    /v1/organizations/{orgSlug}/competitions/{compId}/events/{eventId}/bracket       # Get bracket data (for tournament formats)

# ─────────────────────────────────────────────
# Championship
# ─────────────────────────────────────────────
GET    /v1/organizations/{orgSlug}/competitions/{compId}/championship/standings         # Season standings
PATCH  /v1/organizations/{orgSlug}/competitions/{compId}/championship/points-schedule   # Update points config

# ─────────────────────────────────────────────
# Statistics
# ─────────────────────────────────────────────
GET    /v1/members/{memberId}/statistics                              # Member global stats
GET    /v1/members/{memberId}/head-to-head/{opponentId}               # Head-to-head
GET    /v1/members/{memberId}/achievements                            # Member achievements

# ─────────────────────────────────────────────
# Blueprints
# ─────────────────────────────────────────────
GET    /v1/organizations/{orgSlug}/blueprints                         # List blueprints
POST   /v1/organizations/{orgSlug}/blueprints                         # Create blueprint from competition
GET    /v1/organizations/{orgSlug}/blueprints/{blueprintId}           # Get blueprint
DELETE /v1/organizations/{orgSlug}/blueprints/{blueprintId}           # Delete blueprint
POST   /v1/organizations/{orgSlug}/blueprints/import                  # Import from JSON
POST   /v1/organizations/{orgSlug}/blueprints/{blueprintId}/duplicate # Duplicate
POST   /v1/organizations/{orgSlug}/blueprints/from-competition/{compId}  # Save as blueprint

# ─────────────────────────────────────────────
# Audit
# ─────────────────────────────────────────────
GET    /v1/organizations/{orgSlug}/audit                              # Query audit log
POST   /v1/organizations/{orgSlug}/audit/{auditId}/undo               # Undo a specific action

# ─────────────────────────────────────────────
# Notifications
# ─────────────────────────────────────────────
GET    /v1/members/{memberId}/notifications                           # List notifications
PATCH  /v1/members/{memberId}/notifications/{notifId}/read            # Mark as read
PATCH  /v1/members/{memberId}/notification-preferences                # Update preferences

# ─────────────────────────────────────────────
# AI Agents
# ─────────────────────────────────────────────
POST   /v1/ai/recommend-format                                        # Competition Architect
POST   /v1/ai/generate-fixtures                                       # Fixture Generator
POST   /v1/ai/explain-rules                                           # Rules Assistant
POST   /v1/ai/suggest-schedule                                        # Scheduling Assistant
POST   /v1/ai/analyze-standings                                       # Standings Assistant
POST   /v1/ai/player-insights                                         # Analytics Assistant
```

### 12.3 WebSocket Events (Real-time)

```
match.scheduled       # New match scheduled
match.started         # Match is in progress
match.result          # Match result submitted (not yet finalized)
match.finalized       # Match result official
match.disputed        # Match disputed
match.undo            # Match undone
standing.updated      # Standings recalculated
bracket.updated       # Bracket re-rendered
event.started         # Event began
event.completed       # Event completed
notification.new      # New notification
```

---

## 13. Database Design

### 13.1 Technology Choices

| Component | Technology | Rationale |
|---|---|---|
| **Primary Database** | PostgreSQL 16 | Strong consistency, JSONB for flexible config, mature ecosystem, excellent for relational DDD |
| **Cache** | Redis 7 | Distributed caching, pub/sub for real-time, rate limiting |
| **Search** | PostgreSQL full-text (MVP) → Elasticsearch (post-MVP) | Reduce operational complexity in early stages |
| **Message Queue** | RabbitMQ | Reliable delivery, routing flexibility, dead-lettering for retries |
| **Time-series** | TimescaleDB (future) | Match analytics over time, usage metrics |

### 13.2 Schema Design Key Decisions

1. **JSONB for flexible attributes**: Rules, config, scores — anything that varies by format or organization. JSONB in PostgreSQL supports indexing (`GIN`) for queryable paths.

2. **Enum vs. String vs. Reference Table**:
   - **Format types**: Enum (finite, changes with deploys)
   - **Rules**: Key-value in RuleSet/Rule tables (dynamic, user-configurable)
   - **Roles**: Reference table (OrgRole) — organizations may create custom roles

3. **Soft deletes**: `deleted_at` timestamp on Organization, Competition, Event. Hard delete only for match/participant undo operations.

4. **Audit table**: Append-only, partitioned by month. Snapshots stored as JSONB.

5. **Multi-tenant isolation**: Row-level security (RLS) using `organization_id`. Every query implicitly scoped.

### 13.3 Indexing Strategy

| Table | Index | Type | Purpose |
|---|---|---|---|
| `competitions` | (organization_id, status) | B-tree | Dashboard listing |
| `events` | (competition_id) | B-tree | Event listing per competition |
| `events` | (organization_id, status) | B-tree | Cross-competition queries |
| `matches` | (event_id, round_id) | B-tree | Match listing |
| `matches` | (status, scheduled_at) | B-tree | Upcoming matches |
| `matches` | (participant_ids) | GIN | Player match history |
| `audit_entries` | (organization_id, created_at) | B-tree | Audit log queries |
| `audit_entries` | (resource_type, resource_id) | B-tree | Resource history |
| `standings` | (event_id, stage_id, rank) | B-tree | Standings display |

### 13.4 Partitioning

- `audit_entries`: Partition by month (`created_at`)
- `matches`: Partition by event (when event count > 100K)
- `notifications`: Partition by month (`created_at`)

---

## 14. Frontend Information Architecture

### 14.1 Structure

```
App Root
├── Public (no auth)
│   ├── Landing Page
│   ├── Pricing
│   ├── Docs
│   ├── Blog
│   └── Login / Register
│
├── Member (auth, personal)
│   ├── Dashboard
│   ├── My Competitions
│   ├── My Matches (upcoming / past)
│   ├── My Statistics
│   ├── My Achievements
│   ├── Notifications
│   └── Profile / Settings
│
├── Organization (auth, scoped to org)
│   ├── Dashboard (org overview)
│   ├── Competitions
│   │   ├── List
│   │   ├── Create (with blueprint selection)
│   │   └── [Competition Detail]
│   │       ├── Overview
│   │       ├── Events
│   │       │   └── [Event Detail]
│   │       │       ├── Overview
│   │       │       ├── Participants
│   │       │       ├── Stages / Rounds
│   │       │       ├── Matches
│   │       │       │   └── [Match Detail] (score entry, bracket position)
│   │       │       ├── Standings
│   │       │       ├── Bracket (tournament formats)
│   │       │       ├── Schedule
│   │       │       └── Settings / Rules
│   │       └── Championship (if championship format)
│   │           ├── Season Standings
│   │           ├── Events History
│   │           └── Finals
│   ├── Members
│   ├── Blueprints
│   ├── Settings (org branding, roles, notifications)
│   └── Audit Log
│
├── Admin (platform-wide)
│   ├── Organizations (manage tenants)
│   ├── Usage & Billing
│   ├── Feature Flags
│   ├── System Health
│   └── Audit (cross-tenant)
│
└── Shared Components
    ├── Bracket View (interactive SVG/Canvas)
    ├── Standings Table (sortable, filterable)
    ├── Fixture List (calendar view)
    ├── Score Entry (minimal for fighting games, detailed for football)
    └── QR Code / Invite Link generator
```

### 14.2 Key UX Principles

1. **Progressive disclosure**: New users see a simplified view. Advanced configuration is available but not required.
2. **Default-sensible**: Picking "League" format auto-populates sensible rules (3 pts win, 1 pt draw, 0 pts loss).
3. **Bracket as first-class UI**: Interactive bracket visualization with drag-to-expand, hover for match details.
4. **Mobile-first**: Score entry, match listing, and standings must be optimized for mobile referees and players.
5. **Real-time**: Bracket and standings update without page refresh via WebSocket.

---

## 15. UI Sitemap

```
/                                       Landing Page
/login                                  Login
/register                               Register

/app                                    App Dashboard (member)
/app/competitions                       My Competitions
/app/matches                            My Matches
/app/statistics                         My Statistics
/app/achievements                       My Achievements
/app/notifications                      My Notifications
/app/settings                           My Settings

/o/{orgSlug}                            Org Dashboard
/o/{orgSlug}/competitions               List Competitions
/o/{orgSlug}/competitions/new           Create Competition
/o/{orgSlug}/competitions/{compId}      Competition Overview
/o/{orgSlug}/competitions/{compId}/events/{eventId}          Event Overview
/o/{orgSlug}/competitions/{compId}/events/{eventId}/participants  Participants
/o/{orgSlug}/competitions/{compId}/events/{eventId}/matches       Matches List
/o/{orgSlug}/competitions/{compId}/events/{eventId}/matches/{mId} Match Detail
/o/{orgSlug}/competitions/{compId}/events/{eventId}/standings     Standings
/o/{orgSlug}/competitions/{compId}/events/{eventId}/bracket       Bracket View
/o/{orgSlug}/competitions/{compId}/events/{eventId}/schedule      Schedule
/o/{orgSlug}/competitions/{compId}/events/{eventId}/settings      Event Settings/Rules
/o/{orgSlug}/competitions/{compId}/championship                    Championship View
/o/{orgSlug}/members                     Org Members
/o/{orgSlug}/blueprints                 Blueprints
/o/{orgSlug}/settings                   Org Settings
/o/{orgSlug}/audit                      Audit Log

/admin                                  Admin Dashboard
/admin/organizations                    Manage Tenants
/admin/feature-flags                    Feature Flags
/admin/health                           System Health
```

---

## 16. Navigation

### 16.1 Top Navigation (Member — Post-Login)

```
[Logo]  Dashboard  |  My Competitions  |  My Matches  |  [Notifications]  [Profile ▾]
                                                                    ├── My Statistics
                                                                    ├── My Achievements
                                                                    ├── Settings
                                                                    └── Logout
```

### 16.2 Side Navigation (Organization Context)

```
[Organization Name / Logo]
├── Dashboard
├── Competitions
│   ├── All
│   └── Create New [+]
├── Members
├── Blueprints
├── Settings
└── Audit Log

[Switch Organization ▾]
```

### 16.3 Event Sub-navigation (Within Event Detail)

```
[Event Name]
├── Overview      (summary, stats)
├── Participants   (list, registration)
├── Matches        (list, calendar)
├── Standings      (or Bracket, depending on format)
├── Schedule       (fixtures, matchdays)
└── Settings       (rules, configuration)
```

---

## 17. MVP Scope

### 17.1 MVP Definition

A functional competition management platform supporting the most common competition formats. The MVP should be capable of running a real-world competition end-to-end.

### 17.2 MVP Features

| Feature | Scope | Notes |
|---|---|---|
| Organizations | Create, manage members, basic roles (Owner, Admin, Referee) | No custom roles in MVP |
| Competitions | Create, edit, delete, duplicate | No advanced visibility options |
| Events | Create with Format selection, Rule configuration | Formats: League, SingleElimination, DoubleElimination |
| League Format | Single Round Robin, automated fixtures, standings with tiebreakers | Win/Draw/Loss points configurable |
| Tournament Format | Single & Double Elimination brackets, automated BYEs | Seeding: manual only |
| Registration | Open registration (no invite), manual admin registration | No invite links or QR codes in MVP |
| Match Management | Winner-only result, detailed score entry, finalize, dispute | No undo in MVP (manual override only) |
| Participant Management | View participants, remove, manually add | |
| Standings | Auto-calculated, displayed in table | |
| Brackets | Interactive bracket view for tournament formats | Read-only, no drag-to-reorder |
| Basic Statistics | Wins, losses, draws per participant per event | |
| Audit | Basic event log (who did what, when) | No undo in MVP |
| Notifications | In-app only | No email/push in MVP |
| Blueprints | Save competition as blueprint, create from blueprint | No import/export or sharing in MVP |

### 17.3 MVP Exclusions (Explicitly Out of Scope)

- Double Round Robin (home/away)
- Swiss format
- Group Stage format
- Ladder format
- Custom format
- Championship engine
- QR code / invite link registration
- Email / push notifications
- Undo operations
- AI agents
- Blueprint marketplace / sharing
- White-label / custom domains
- Billing / subscriptions
- Multi-region deployment
- Elasticsearch (PostgreSQL full-text is sufficient)

### 17.4 MVP Target Metrics

| Metric | Target |
|---|---|
| Participants per event | Up to 64 (single elimination) / 32 (league) |
| Events per competition | Up to 10 |
| Concurrent matches (per org) | Up to 50 simultaneously |
| API response time (P99) | < 500ms |
| Standings calc time (32 participants) | < 1s |

---

## 18. Future Roadmap

### Phase 1 — MVP (Months 1-4)
- Organizations, Members, Roles
- Competitions & Events
- League (Single RR) + Single/Double Elim formats
- Open registration + manual admin registration
- Match management (result entry, finalize, dispute)
- Standings & brackets
- Basic in-app notifications
- Blueprints (save + create from)

### Phase 2 — Core Expansion (Months 5-7)
- Double Round Robin (home/away)
- Swiss format
- Group Stage → Knockout
- Invite links + QR code registration
- Email notifications (transactional)
- Match undo with audit restoration
- Participant statistics dashboard
- Advanced tiebreakers (H2H, goal diff, custom)

### Phase 3 — Championship & Scale (Months 8-10)
- Championship engine (points series, season standings, finals qualification)
- Ladder format
- Custom format (JSON configuration)
- Push notifications (Web Push)
- Blueprint sharing between orgs
- Import/export blueprints
- Caching layer (Redis) for standings/brackets
- Read replicas for PostgreSQL

### Phase 4 — AI & Platform (Months 11-13)
- AI Competition Architect (format recommendation)
- AI Fixture Generator (smart scheduling)
- AI Rules Assistant (explain implications)
- AI Standings Assistant (insights)
- AI Analytics Assistant (player insights)
- Blueprint marketplace
- Admin system dashboard & health monitoring
- Feature flags system

### Phase 5 — Enterprise (Months 14-16)
- White-label / custom domains
- SSO / SAML authentication
- Advanced RBAC (custom roles per org)
- Billing & subscriptions
- Usage metering
- Multi-region deployment
- SOC 2 / GDPR compliance
- API rate limiting per tier

---

## 19. Risks

### 19.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Format Engine becomes coupled to specific formats | Medium | High | Strict Strategy pattern with plugin interface. CI enforces no format-specific imports in core engine. |
| Standings recalculation latency at scale | Medium | High | Eventually consistent model. Debounce recalculation triggers. Consider materialized view for hot standings. |
| Match undo cascading to complex bracket states | Low | High | Snapshot-based undo restores aggregate root, not individual fields. Comprehensive property tests for undo. |
| JSONB queries slow as data grows | Medium | Medium | Index JSONB paths with GIN. Extract critical fields to columns. Archive old events. |
| Real-time bracket/standing updates overwhelming clients | Low | Medium | WebSocket batching. Client-side debounce. Throttle updates to 1 per 500ms per event. |

### 19.2 Product Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Too configurable = too complex for non-technical users | High | High | Blueprints as starting point. Progressive disclosure in UI. AI Architect to recommend configurations. |
| Competition metadata spans too many use cases | Medium | Medium | Focus on esports + sports for MVP. Extend to education/corporate in Phase 2 based on feedback. |
| Users expect game-specific features (e.g., MMR, Elo) | High | Medium | Provide basic Elo as a configurable rule, not game-specific logic. Document that advanced ranking is a config option. |
| Blueprint marketplace needs moderation | Low | Low | Manual review for MVP marketplace. Reports + automated scanning of JSON config post-MVP. |

---

## 20. Technical Architecture

### 20.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Client Layer                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │   Web    │  │  Mobile  │  │   API    │  │  WebSocket        │  │
│  │ (React)  │  │  (PWA)   │  │  Client  │  │  (real-time)      │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬──────────┘  │
└───────┼──────────────┼─────────────┼─────────────────┼─────────────┘
        │              │             │                 │
┌───────┼──────────────┼─────────────┼─────────────────┼─────────────┐
│       │              │             │                 │             │
│  ┌────▼──────────────▼─────────────▼─────────────────▼──────────┐  │
│  │                 CDN / Load Balancer (CloudFront / CloudFlare) │  │
│  └──────────────────────────────┬───────────────────────────────┘  │
│                                 │                                  │
│  ┌──────────────────────────────▼───────────────────────────────┐  │
│  │                   API Gateway (Kong / AWS API GW)             │  │
│  │  • Rate limiting   • Auth (JWT validation)   • Request logging │  │
│  │  • RBAC enforcement  • CORS   • Request/response transform    │  │
│  └──────────────────────────────┬───────────────────────────────┘  │
│                                 │                                  │
│  ┌──────────────────────────────▼───────────────────────────────┐  │
│  │                   Application Layer (K8s / ECS)              │  │
│  │                                                              │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐  │  │
│  │  │ Identity &   │ │ Competition  │ │ Match Management     │  │  │
│  │  │ Access API   │ │ Engine API   │ │ API                  │  │  │
│  │  └──────────────┘ └──────────────┘ └──────────────────────┘  │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐  │  │
│  │  │ Registration │ │ Blueprint    │ │ AI Agent             │  │  │
│  │  │ API          │ │ Engine API   │ │ Gateway              │  │  │
│  │  └──────────────┘ └──────────────┘ └──────────────────────┘  │  │
│  └──────────────────────────────┬───────────────────────────────┘  │
│                                 │                                  │
│  ┌──────────────────────────────▼───────────────────────────────┐  │
│  │                   Service Layer (Internal)                    │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │  │
│  │  │ Format   │ │ Rule     │ │Standings │ │ Championship   │  │  │
│  │  │ Engine   │ │ Engine   │ │Calculator│ │ Engine         │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────────────┘  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │  │
│  │  │Scheduler │ │Fixture   │ │Statistics│ │ Notification   │  │  │
│  │  │          │ │Generator │ │Engine    │ │ Dispatcher     │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────────────┘  │  │
│  └──────────────────────────────┬───────────────────────────────┘  │
│                                 │                                  │
│  ┌──────────────────────────────▼───────────────────────────────┐  │
│  │               Event Bus / Message Queue (RabbitMQ)           │  │
│  │  • Domain events    • Background jobs    • Retry/dead-letter  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                 │                                  │
│  ┌──────────────────────────────▼───────────────────────────────┐  │
│  │                     Data Layer                                │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐  │  │
│  │  │  PostgreSQL   │ │    Redis     │ │  Object Storage      │  │  │
│  │  │  (Primary)    │ │  (Cache +    │ │  (S3 / CloudFlare    │  │  │
│  │  │  + Read       │ │   Pub/Sub)   │ │   R2 for avatars,    │  │  │
│  │  │   Replicas)   │ │              │ │   logos, blueprints) │  │  │
│  │  └──────────────┘ └──────────────┘ └──────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                  Observability Stack                          │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────┐  │  │
│  │  │OpenTele. │ │ Loki     │ │  Grafana │ │  Sentry        │  │  │
│  │  │ Traces   │ │ Logs     │ │  Metrics │ │  Errors         │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 20.2 Technology Stack Recommendation

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend** | React 18 + TypeScript + Next.js 14 (App Router) | SSR for SEO, partial hydration, App Router for nested layouts matching sitemap |
| **State Management** | Zustand (global) + React Query (server state) | Minimal boilerplate, excellent caching/fetching |
| **Real-time** | WebSocket via Socket.IO | Fallback to polling, room-based scoping per event |
| **UI Library** | Tailwind CSS + shadcn/ui | Utility-first, accessible, composable |
| **Bracket Visualization** | Custom SVG/Canvas via D3.js | Full control over bracket rendering and animations |
| **API Framework** | FastAPI (Python) or NestJS (Node.js) | FastAPI: performance, pydantic validation, auto OpenAPI. NestJS: if team prefers TS end-to-end. |
| **Language** | TypeScript (frontend) / Python or TypeScript (backend) | Consistency vs. performance trade-off. Python for ML/AI integration (Phase 4). |
| **Database ORM** | Prisma (TS) or SQLAlchemy (Python) | Type-safe queries, migration management |
| **Background Jobs** | Celery (Python) / BullMQ (Node) | Reliable queue processing with schedule support |
| **Infrastructure** | Docker + Kubernetes (AWS EKS / GKE) | Portability, auto-scaling, service mesh ready |
| **CI/CD** | GitHub Actions | Tight GitHub integration, matrix builds, deploy to K8s |

### 20.3 Key Architecture Decisions

#### ADR-01: Monolith First, Modular Monolith
**Decision**: Build as a modular monolith with strict package boundaries mirroring bounded contexts.
**Rationale**: MVP-stage monolithic deployment reduces operational complexity. Package boundaries enforce module isolation. Extract to microservices when performance or team scaling demands it.
**Consequence**: Requires strong CI enforcement of dependency rules (e.g., `competition-engine` must not import `ai-agent`).

#### ADR-02: Event-Driven for Cross-Context Communication
**Decision**: Domain events via message queue for all cross-context communication.
**Rationale**: Decouples bounded contexts. Enables eventual consistency for standings/brackets. Supports retry and dead-letter for failures.
**Consequence**: Complex debugging (mitigated by OpenTelemetry tracing). Event schema versioning required.

#### ADR-03: Read Models for Performance
**Decision**: Standings, brackets, and statistics are computed asynchronously and cached as read models.
**Rationale**: Match finalization is the hot path. Computing standings inline would block write throughput. Read models can be stale by up to 5s (per NFR-DATA-01).
**Consequence**: Cache invalidation logic under high concurrent finalizations requires careful debouncing.

#### ADR-04: Strategy Pattern for Format Engine
**Decision**: Each competition format implements a `FormatStrategy` interface.
```python
class FormatStrategy:
    def create_stages(self, participants, config) -> List[Stage]
    def generate_matches(self, stage) -> List[Match]
    def calculate_standings(self, stage, rules) -> List[Standing]
    def validate_rules(self, rules) -> ValidationResult
```
**Rationale**: New formats are added by implementing a single interface — no changes to the event lifecycle. Enables the "Custom" format (upload JSON that implements the contract).
**Consequence**: Requires a plugin discovery mechanism. Validation must ensure custom formats cannot execute arbitrary code.

#### ADR-05: Snapshot-based Undo (Not Event Sourcing)
**Decision**: Store aggregate snapshots in the audit log for undo, rather than full event sourcing.
**Rationale**: Full event sourcing adds significant complexity (snapshotting, projection rebuilding). Snapshot-based undo is simpler: restore the entire aggregate root and emit a compensating domain event.
**Consequence**: Higher storage cost per snapshot (mitigated by periodic snapshotting with differential). Cannot rebuild state from scratch (acceptable — not needed for MVP).

### 20.4 Security Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐
│  Browser     │────►│  API Gateway│────►│  Auth Service    │
│  (JWT stored │     │  - Validate │     │  - Verify JWT    │
│   in httpOnly│     │    JWT      │     │  - Check tenant  │
│   cookie)    │     │  - Rate lim │     │  - RBAC check    │
└─────────────┘     │  - CORS     │     └──────────────────┘
                    └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ PostgreSQL  │
                    │ RLS enabled │
                    │ org_id col  │
                    └─────────────┘
```

- **Authentication**: JWT (15min access + 7-day rotating refresh token)
- **Tenant Isolation**: Row-Level Security on PostgreSQL using `organization_id`
- **API Security**: Rate limiting per route per tenant (configurable)
- **Input Validation**: Request validation at the API boundary (Pydantic / class-validator)
- **Audit**: All writes logged with actor, action, diff, snapshot

### 20.5 Deployment Architecture (MVP)

```
┌──────────────┐     ┌──────────────┐
│  CloudFront   │────►│  ALB (NLB)   │
│  CDN + WAF    │     │  (HTTPS)    │
└──────────────┘     └──────┬───────┘
                            │
                    ┌───────▼───────┐
                    │  ECS Fargate  │
                    │  (API Server) │
                    │  * 2 tasks,   │
                    │    auto-scale │
                    └───────┬───────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
       ┌──────▼────┐ ┌─────▼─────┐ ┌─────▼─────┐
       │ PostgreSQL │ │  Elasti-  │ │  RabbitMQ │
       │  RDS       │ │  Cache   │ │  (Amazon  │
       │  (1 inst,  │ │ (Redis)  │ │   MQ)     │
       │  multi-AZ) │ │          │ │           │
       └───────────┘ └──────────┘ └───────────┘
```

---

## Architectural Recommendations & Challenges

### What Works Well

1. **Competition abstraction**: Building around "competition" rather than "game" is the right call. It unlocks the broadest TAM and avoids the trap of becoming yet another esports tournament tool.

2. **Match as its own aggregate**: Given the high write throughput, isolating match finalization from the event aggregate prevents lock contention.

3. **Strategy pattern for formats**: Clean separation, testable in isolation, extensible via plugin. This is textbook DDD done right.

4. **Snapshot-based undo**: Pragmatic choice over full event sourcing. The complexity of event sourcing would delay MVP significantly.

### What Needs Reconsideration

1. **Monolith vs. Microservices**: A monolith-first approach is correct for MVP, but the `match-finalized-handler` chain (finalize → recalculate standings → recalculate bracket → notify → update stats) must be async and resilient even within a monolith. I recommend an in-process event bus that can be swapped to RabbitMQ later without changing domain logic.

2. **Row-Level Security in PostgreSQL**: RLS is elegant but adds query overhead. For high-traffic endpoints like standings (read by all participants), consider a separate read-optimized view that embeds `organization_id` rather than relying on RLS.

3. **AI Agent Architecture**: The spec says "AI must only orchestrate, never contain business rules." This is critical. I recommend:
   - AI agents receive a sanitized context (no PII, no cross-tenant data)
   - AI agents return proposals (JSON), not commands
   - All AI outputs are validated against the Rule Engine before execution
   - A human-in-the-loop approval step for any destructive AI action

4. **Team Support**: The current model supports individual participants well. Teams need more thought: team membership changes mid-competition? Substitute players? Team captains? This is likely Phase 2 but should be considered in the identity model from the start.

5. **Custom Format Security**: The spec says custom formats may be uploaded as JSON/YAML. This is a security risk (arbitrary configuration execution). Recommend sandboxing: custom configs cannot reference external resources, must pass strict schema validation, and are rate-limited.

### Suggested Improvements

| # | Improvement | Rationale |
|---|---|---|
| 1 | **Add team entity now** | Even if MVP is individual-only, add the Team table and participant_type enum. Changing aggregates post-launch is expensive. |
| 2 | **Debounce standings recalcs** | Batch multiple match finalizations before recalculating. Use a 500ms window. |
| 3 | **Materialized standings view** | For large leagues, compute standings via a materialized view refreshed by the debounced recalculation. |
| 4 | **API versioning from day 1** | Even if only v1 exists, the `/v1/` prefix sets expectations for future breaking changes. |
| 5 | **Idempotency on match finalization** | Network retries could double-finalize. Use idempotency keys or unique constraints on (match_id, finalized_at). |
| 6 | **Feature flags system** | Build a simple feature flag table from day 1. Essential for gradual rollouts, beta programs, and kill-switches. |
| 7 | **Progressive web app** | Make the frontend installable as PWA from MVP. Many referees will use phones on-site with spotty connectivity. Offline match entry is a stretch goal but PWA shell is easy. |

---

## Conclusion

CompetitionOS has a strong architectural foundation. The competition-first, game-agnostic approach is the right strategic bet. The modular monolith with event-driven communication provides a pragmatic path to scale.

Key success factors:
1. **Strict adherence to domain boundaries** (prevent the format engine from leaking into match management)
2. **Async everything for the hot path** (match finalization → standings recalculation)
3. **Blueprint-driven onboarding** (reducing configuration complexity is the #1 UX priority)
4. **AI as proposal engine** (never let AI touch business rules directly)

The MVP scope defined above (Section 17) is achievable in 4 months with a team of 4-6 engineers and will validate the core value proposition.
