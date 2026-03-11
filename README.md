<div align="center">

# Kyra — AI Assistant for Volto

**Intelligent content assistant for Plone/Volto editors**
DeepL translation · AI chat · Prompt management · Widget customization

[![Version](https://img.shields.io/badge/version-1.0-blue.svg)](https://github.com/interaktivgmbh/volto-interaktiv-kyra)
[![License](https://img.shields.io/badge/license-GPL--2.0-green.svg)](LICENSE)
[![Plone](https://img.shields.io/badge/Plone-6-orange.svg)](https://plone.org)
[![Volto](https://img.shields.io/badge/Volto-18+-purple.svg)](https://github.com/plone/volto)

<br/>

<img src="showcase/bot-showcase.gif" alt="Kyra AI Assistant — Animated Showcase" width="100%" />

<sub>17 animated scenes — <a href="showcase/bot-showcase.svg">open interactive version</a></sub>

</div>

---

## Features

| Feature | Description |
|:--------|:------------|
| **DeepL Translation** | Translate pages or subtrees with glossary support |
| **Translation Sync** | Detect and update outdated translations |
| **AI Chat** | Streaming chat with citations and page context |
| **Text Selection** | Select text on page as targeted AI context |
| **Prompt Manager** | Curated prompt library with compare view |
| **Chat History** | Pin, archive, rename conversations |
| **Glossary** | DeepL glossary for consistent terminology |
| **Tag Mappings** | Keyword translation mappings |
| **Customization** | Custom icon, accent color and chat name |

---

## Contents

> **Features** — [Translation](#translation) · [Translation Sync](#translation-sync) · [AI Chat](#ai-chat) · [Text Selection](#text-selection) · [Prompts](#prompt-management) · [History](#chat-history) · [Customization](#customization)
>
> **Technical** — [Architecture](#architecture) · [API Endpoints](#api-endpoints) · [Installation](#installation) · [Configuration](#configuration) · [Troubleshooting](#troubleshooting)

---

## Translation

Full DeepL integration in the editor workflow.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#dbeafe', 'primaryBorderColor': '#2563eb', 'primaryTextColor': '#111', 'lineColor': '#2563eb', 'signalColor': '#2563eb', 'signalTextColor': '#111', 'labelTextColor': '#111', 'actorBkg': '#1d4ed8', 'actorTextColor': '#fff', 'actorBorder': '#1e40af', 'actorLineColor': '#64748b', 'noteBkgColor': '#fef3c7', 'noteBorderColor': '#d97706', 'noteTextColor': '#111'}}}%%
sequenceDiagram
    participant Editor
    participant Kyra
    participant Plone
    participant DeepL

    Editor->>Kyra: Click + → Translate
    Kyra->>Editor: Scope? Page / Subtree
    Editor->>Kyra: This page only
    Kyra->>Editor: Target language?
    Editor->>Kyra: English
    Kyra->>Plone: POST translate
    Plone->>DeepL: Translate blocks
    DeepL-->>Plone: Translated content
    Plone-->>Kyra: Result
    Kyra->>Editor: Page updated
```

- **Scope**: Single page or entire subtree with subpages
- **Languages**: DE to EN (extensible)
- **Modes**: Full overwrite or incremental (only changed blocks)
- **Glossary**: DeepL glossary entries respected during translation
- **Tag Mapping**: Keywords translated via configured mappings
- **Progress**: Visual overlay on the page during translation

### Glossary Management

Header menu, then **DeepL Glossary**: Add term pairs manually or bulk-import via CSV. Entries are synced to DeepL and used during all translations.

### Tag Mappings

Header menu, then **Tag Mappings**: Define per-language keyword translations. Tags without mapping are excluded from translated output.

---

## Translation Sync

Automatic detection and resolution of outdated translations.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#dbeafe', 'primaryBorderColor': '#2563eb', 'primaryTextColor': '#111', 'lineColor': '#475569', 'tertiaryColor': '#f0fdf4'}}}%%
flowchart LR
    A["Page modified"] --> B{"Translations\nexist?"}
    B -->|Yes| C["Compare\ntimestamps"]
    C --> D{"Outdated?"}
    D -->|Yes| E["Badge on\nlauncher"]
    E --> F["Sync card\nin chat"]
    F --> G["Re-translate"]
    D -->|No| I["Up to date"]
    B -->|No| J["No action"]

    style A fill:#dbeafe,stroke:#2563eb,color:#111
    style E fill:#fee2e2,stroke:#dc2626,color:#111
    style G fill:#dbeafe,stroke:#2563eb,color:#111
    style I fill:#dcfce7,stroke:#16a34a,color:#111
    style J fill:#f1f5f9,stroke:#94a3b8,color:#111
    style B fill:#fff,stroke:#475569,color:#111
    style D fill:#fff,stroke:#475569,color:#111
```

1. The translation status endpoint compares modification timestamps
2. Launcher button shows badge with outdated count
3. Sync card lists stale translations with URLs
4. One-click re-translation of affected pages

---

## AI Chat

Context-aware streaming chat with citations.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#dbeafe', 'primaryBorderColor': '#2563eb', 'primaryTextColor': '#111', 'lineColor': '#2563eb', 'signalColor': '#2563eb', 'signalTextColor': '#111', 'labelTextColor': '#111', 'actorBkg': '#1d4ed8', 'actorTextColor': '#fff', 'actorBorder': '#1e40af', 'actorLineColor': '#64748b', 'noteBkgColor': '#fef3c7', 'noteBorderColor': '#d97706', 'noteTextColor': '#111'}}}%%
sequenceDiagram
    participant Editor
    participant Kyra
    participant Plone
    participant AI as AI Gateway

    Editor->>Kyra: Sends message
    Note over Kyra: Attaches page context<br/>or selected text
    Kyra->>Plone: POST chat endpoint
    Plone->>AI: Forward with context
    AI-->>Plone: SSE stream tokens
    Plone-->>Kyra: Token-by-token
    Kyra->>Editor: Live rendering
    Note over Kyra,Editor: Citations appended
```

- **Streaming** via Server-Sent Events with real-time rendering
- **Citations** with source links and snippets
- **Feedback** — rate responses with thumbs up or down
- **File Upload** — attach documents for additional context
- **Context Modes** — current page content or selected text
- **Abort** — cancel in-flight requests

---

## Text Selection

Select any text on the page to use it as targeted AI context.

- Selection detected via mouseup events
- Context tag **Selected Text** appears in the composer
- Dismissible to reset to page context
- Selected text sent alongside the prompt for targeted responses

---

## Prompt Management

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#dbeafe', 'primaryBorderColor': '#2563eb', 'primaryTextColor': '#111', 'lineColor': '#475569'}}}%%
flowchart TD
    A["Admin creates prompt"] --> B["Stored via Prompts API"]
    B --> C["Prompt Picker\nin chat"]
    B --> D["Prompt Manager\nControl Panel"]
    C --> E["Editor picks prompt"]
    E --> F["AI processes\nwith context"]
    F --> G{"Compare View"}
    G -->|"Apply"| H["Text replaced\non page"]
    G -->|"Retry"| F
    G -->|"Cancel"| I["Dismissed"]

    style A fill:#dbeafe,stroke:#2563eb,color:#111
    style B fill:#e0e7ff,stroke:#4f46e5,color:#111
    style C fill:#dbeafe,stroke:#2563eb,color:#111
    style D fill:#dbeafe,stroke:#2563eb,color:#111
    style F fill:#e0e7ff,stroke:#4f46e5,color:#111
    style G fill:#fef3c7,stroke:#d97706,color:#111
    style H fill:#dcfce7,stroke:#16a34a,color:#111
    style I fill:#f1f5f9,stroke:#94a3b8,color:#111
```

**Three ways to use prompts:**

1. **Prompt Picker** — browse saved prompts by category in the chat panel
2. **Prompt Manager** — full CRUD at Site Setup, AI Prompt Manager
3. **Free-Text** — type any custom prompt directly

**Compare View**: After processing, editors see Original vs. Result side-by-side with actions: Apply, Retry, Edit, Cancel.

---

## Chat History

- Persistent per-user conversation history in localStorage
- **Pin** important conversations to the top
- **Archive** conversations without deleting
- **Rename** conversation titles
- **Bulk actions** for multi-select delete and archive
- Auto-generated titles from first message content

---

## Customization

Personalize via the settings drawer:

| Option | Description |
|:-------|:------------|
| **Launcher Icon** | Upload custom image or SVG |
| **Icon Color** | 8 preset colors |
| **Accent Color** | 6 presets: blue, green, amber, red, purple, pink |
| **Chat Name** | Replace default assistant name |

---

## Architecture

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#dbeafe', 'primaryBorderColor': '#2563eb', 'primaryTextColor': '#111', 'lineColor': '#475569', 'clusterBkg': '#f1f5f9', 'clusterBorder': '#94a3b8'}}}%%
flowchart TD
    subgraph Frontend["Volto Frontend"]
        L["Launcher Button"] --> P["Chat Panel"]
        P --> Chat["Messages"]
        P --> Comp["Composer"]
        P --> Set["Settings"]
        P --> Hist["History"]
        P --> Gloss["Glossary"]
        P --> Tags["Tag Mappings"]
        P --> Prom["Prompt Picker"]
    end

    subgraph Backend["Plone Backend"]
        C1["Chat API"]
        C2["Translate API"]
        C3["Prompts API"]
        C4["Glossary API"]
        C5["Tag Mappings API"]
        C6["Translation Status"]
        C7["Capabilities"]
    end

    subgraph Services["External Services"]
        GW["AI Gateway"]
        DL["DeepL API"]
        KC["Keycloak"]
    end

    Chat <--> C1
    Comp --> C2
    Prom <--> C3
    Gloss <--> C4
    Tags <--> C5
    L --> C6
    L --> C7
    C1 --> GW
    C1 --> KC
    C2 --> DL

    style L fill:#1d4ed8,stroke:#1e40af,color:#fff
    style P fill:#dbeafe,stroke:#2563eb,color:#111
    style GW fill:#e0e7ff,stroke:#4f46e5,color:#111
    style DL fill:#e0e7ff,stroke:#4f46e5,color:#111
    style KC fill:#e0e7ff,stroke:#4f46e5,color:#111
    style C1 fill:#fff,stroke:#2563eb,color:#111
    style C2 fill:#fff,stroke:#2563eb,color:#111
    style C3 fill:#fff,stroke:#2563eb,color:#111
    style C4 fill:#fff,stroke:#2563eb,color:#111
    style C5 fill:#fff,stroke:#2563eb,color:#111
    style C6 fill:#fff,stroke:#2563eb,color:#111
    style C7 fill:#fff,stroke:#2563eb,color:#111
```

### Permissions

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#dbeafe', 'primaryBorderColor': '#2563eb', 'primaryTextColor': '#111', 'lineColor': '#475569', 'clusterBkg': '#f1f5f9', 'clusterBorder': '#94a3b8'}}}%%
flowchart LR
    subgraph Roles
        ANON["Anonymous"]
        EDITOR["Editor"]
        ADMIN["Admin"]
    end

    subgraph Access
        F1["Chat read-only"]
        F2["Chat full access"]
        F3["Translation"]
        F4["Prompt Picker"]
        F5["Prompt Manager"]
        F6["Glossary"]
        F7["Tag Mappings"]
        F8["Settings Panel"]
    end

    ANON --> F1
    EDITOR --> F2
    EDITOR --> F3
    EDITOR --> F4
    ADMIN --> F5
    ADMIN --> F6
    ADMIN --> F7
    ADMIN --> F8

    style ANON fill:#f1f5f9,stroke:#64748b,color:#111
    style EDITOR fill:#dbeafe,stroke:#2563eb,color:#111
    style ADMIN fill:#1d4ed8,stroke:#1e40af,color:#fff
    style F1 fill:#fff,stroke:#94a3b8,color:#111
    style F2 fill:#fff,stroke:#2563eb,color:#111
    style F3 fill:#fff,stroke:#2563eb,color:#111
    style F4 fill:#fff,stroke:#2563eb,color:#111
    style F5 fill:#fff,stroke:#1d4ed8,color:#111
    style F6 fill:#fff,stroke:#1d4ed8,color:#111
    style F7 fill:#fff,stroke:#1d4ed8,color:#111
    style F8 fill:#fff,stroke:#1d4ed8,color:#111
```

---

## API Endpoints

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `POST` | `/@ai-chat` | Send message, receive streaming response |
| `POST` | `/@ai-chat-upload` | Upload file for chat context |
| `POST` | `/@ai-feedback` | Submit message rating |
| `POST` | `/@ai-translate` | Translate page or subtree |
| `GET` | `/@ai-translation-status` | Outdated translation report |
| `GET/POST/PATCH/DELETE` | `/@ai-prompts` | Prompt CRUD |
| `GET/POST/DELETE` | `/@ai-glossary` | Glossary management |
| `GET/POST/DELETE` | `/@ai-tag-mappings` | Tag mapping management |
| `GET` | `/@ai-capabilities` | Feature flags and permissions |

---

## Installation

### Prerequisites

- **Plone 6** with [interaktiv.kyra](https://github.com/interaktivgmbh/interaktiv.kyra) backend addon
- **Volto 18+** with `@kitconcept/volto-light-theme`

### Setup

**1.** Add to `mrs.developer.json`:

```json
{
  "volto-interaktiv-kyra": {
    "output": "packages",
    "package": "@interaktiv.de/volto-interaktiv-kyra",
    "url": "git@github.com:interaktivgmbh/volto-interaktiv-kyra.git",
    "path": "src",
    "branch": "main"
  }
}
```

**2.** Register in `package.json`:

```json
{
  "addons": ["@interaktiv.de/volto-interaktiv-kyra"],
  "dependencies": {
    "@interaktiv.de/volto-interaktiv-kyra": "workspace:*"
  }
}
```

**3.** Install:

```bash
pnpm install
```

---

## Configuration

Navigate to **Site Setup, Kyra AI Settings**:

| Setting | Description |
|:--------|:------------|
| `gateway_url` | AI gateway endpoint (required) |
| `keycloak_realms_url` | Keycloak auth URL (required) |
| `keycloak_client_id` | OAuth client ID (required) |
| `keycloak_client_secret` | OAuth client secret (required) |
| `domain_id` | Domain identifier, default: `plone` |
| `deepl_api_key` | DeepL API key for translations |

---

## Troubleshooting

<details>
<summary><strong>Launcher button not visible</strong></summary>

- Verify `interaktiv.kyra` is installed in Plone
- Check `addons` in your project's `package.json`

</details>

<details>
<summary><strong>Translation fails</strong></summary>

- Check `deepl_api_key` in control panel
- Ensure backend can reach `api.deepl.com`

</details>

<details>
<summary><strong>Chat errors</strong></summary>

- Verify `gateway_url` and Keycloak credentials
- Check Plone instance logs

</details>

<details>
<summary><strong>Missing menu items</strong></summary>

- Glossary, tag mappings and prompt manager require editor or admin permissions
- Check capabilities endpoint response

</details>

---

<div align="center">

**Built with** [Plone](https://plone.org) · [Volto](https://github.com/plone/volto) · [DeepL](https://www.deepl.com)

**Maintained by** [Interaktiv GmbH](https://www.interaktiv.de)

</div>
