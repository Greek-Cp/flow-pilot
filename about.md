Berikut versi dokumentasi yang lebih detail dan siap dipakai sebagai spec / blueprint untuk AI engineer atau developer.

⸻

Flow Pilot — AI-Powered Code Flow Visualizer

VS Code Extension + MCP Specification

1. Ringkasan Produk

Flow Pilot adalah Visual Studio Code Extension yang membantu developer memahami alur kode secara visual.

User cukup memberikan instruksi natural seperti:

“Pelajari alur payment system di fitur parent.”
“Visualisasikan alur in-app purchase dari booking → bayar → payment sheet muncul → selesai.”
“Tunjukkan flow login sampai user masuk dashboard.”

Lalu AI melalui MCP akan membaca codebase, menemukan file/fungsi/class yang relevan, membuat diagram flow, dan menyimpan hasilnya ke halaman History.

Tujuan utama Flow Pilot adalah membuat AI bekerja seperti engineer yang membaca codebase, lalu mengubah pemahamannya menjadi visualisasi interaktif.

⸻

2. Tujuan Utama

Flow Pilot harus fokus pada 5 hal utama:

1. Generate flow sesuai instruksi user
    * User memberikan perintah natural language.
    * AI memahami intent user.
    * AI mencari kode yang relevan.
    * AI menghasilkan flow yang sesuai permintaan.
2. Visualisasi mudah dibaca
    * Diagram tidak terlalu penuh.
    * Node memiliki label yang jelas.
    * Relasi antar node mudah dipahami.
    * User bisa memilih mode Sequence Diagram atau Flow Chart.
3. Interaktif
    * Diagram bisa di-zoom.
    * Diagram bisa digeser / pan / swipe.
    * Node bisa diklik.
    * Klik node menampilkan detail di inspector.
    * User bisa lompat ke file dan line kode asli.
4. History tersimpan
    * Setiap hasil generate disimpan otomatis.
    * User bisa membuka ulang flow lama.
    * User bisa melihat flow berdasarkan judul, tanggal, dan tipe diagram.
    * User bisa menghapus flow dari history.
5. Mengikuti style Visual Studio Code
    * Warna, layout, font, spacing, dan UI harus mengikuti theme aktif di VS Code.
    * Mendukung dark theme dan light theme.
    * Tidak memakai warna hardcoded yang bertabrakan dengan theme user.

⸻

3. Target Pengguna

Flow Pilot ditujukan untuk:

* Mobile developer
* Backend developer
* Web developer
* Engineer yang masuk ke project existing
* AI coding workflow user
* Team lead yang ingin memahami flow fitur
* Developer yang ingin refactor tanpa merusak alur lama
* Developer yang ingin dokumentasi otomatis dari codebase

⸻

4. Core User Flow

4.1 User Membuka Extension

Saat extension dibuka, tampilan pertama adalah halaman History.

Jika belum pernah generate flow:

No flow generated yet.
Ask AI to generate your first code flow using MCP.

Jika sudah ada flow:

History
- Payment System Flow
- In-App Purchase Flow
- Login Flow
- Booking Flow

Setiap item history menampilkan:

* Judul flow
* Deskripsi singkat
* Tanggal dibuat
* Tipe diagram
* Jumlah node
* Jumlah file yang dianalisis
* Status: success / failed / partial

⸻

4.2 User Memanggil MCP Tool

User memanggil MCP dari AI assistant / Copilot / agent:

generate_flow: "Tunjukkan alur payment system di fitur parent"

MCP menerima request tersebut dan mulai menganalisis project.

⸻

4.3 AI Memahami Intent

AI harus memahami:

* Fitur apa yang diminta user
* Domain yang dicari
* Entry point kemungkinan
* File yang relevan
* Fungsi penting
* Class penting
* Service / repository / controller / use case yang terlibat
* Relasi antar bagian kode

Contoh intent:

User request:
"Pelajari alur in-app purchase dari booking → bayar → payment sheet muncul → selesai"
AI intent:
- Feature: in-app purchase
- Start point: booking
- Next step: payment trigger
- Next step: payment sheet
- End point: payment completed
- Diagram type recommendation: sequence diagram + flow chart

⸻

4.4 AI Membaca Codebase

AI harus melakukan codebase exploration secara bertahap.

Tahapan minimal:

1. Cari keyword utama dari request user.
2. Cari file terkait.
3. Identifikasi entry point.
4. Identifikasi dependency.
5. Identifikasi function call chain.
6. Identifikasi state change.
7. Identifikasi API call / SDK call / external integration.
8. Identifikasi success path.
9. Identifikasi error path jika terlihat.
10. Buat struktur flow.

Contoh keyword:

payment
purchase
booking
checkout
invoice
paymentSheet
Stripe
IAP
transaction
subscription

⸻

4.5 AI Membuat Flow

AI menghasilkan data flow dalam format internal terlebih dahulu, bukan langsung Mermaid.

Contoh struktur internal:

{
  "title": "Parent Payment Flow",
  "description": "Flow from booking creation until payment completed.",
  "diagramType": "flowchart",
  "nodes": [
    {
      "id": "booking_screen",
      "label": "Booking Screen",
      "type": "ui",
      "file": "lib/features/booking/presentation/booking_screen.dart",
      "lineStart": 24,
      "lineEnd": 90
    },
    {
      "id": "payment_controller",
      "label": "Payment Controller",
      "type": "controller",
      "file": "lib/features/payment/presentation/payment_controller.dart",
      "lineStart": 40,
      "lineEnd": 120
    }
  ],
  "edges": [
    {
      "from": "booking_screen",
      "to": "payment_controller",
      "label": "user taps pay"
    }
  ]
}

Setelah data internal valid, baru dibuat Mermaid.

⸻

5. Diagram yang Didukung

5.1 Flow Chart

Digunakan untuk menampilkan alur logika fitur.

Cocok untuk:

* Login flow
* Payment flow
* Booking flow
* Error handling flow
* Feature lifecycle
* State transition

Contoh:

flowchart TD
  A[Booking Screen] --> B[Create Booking Request]
  B --> C[Payment Controller]
  C --> D[Open Payment Sheet]
  D --> E{Payment Result}
  E -->|Success| F[Mark Payment Completed]
  E -->|Failed| G[Show Error Message]

⸻

5.2 Sequence Diagram

Digunakan untuk menampilkan komunikasi antar komponen.

Cocok untuk:

* API flow
* Controller → Service → Repository
* Frontend → Backend
* SDK integration
* Payment gateway interaction

Contoh:

sequenceDiagram
  actor User
  participant BookingScreen
  participant PaymentController
  participant PaymentService
  participant StripeSDK
  participant Backend
  User->>BookingScreen: Tap Pay
  BookingScreen->>PaymentController: startPayment()
  PaymentController->>PaymentService: createPaymentIntent()
  PaymentService->>Backend: POST /payment-intent
  Backend-->>PaymentService: clientSecret
  PaymentService->>StripeSDK: presentPaymentSheet()
  StripeSDK-->>PaymentController: paymentSuccess
  PaymentController->>Backend: confirmPayment()

⸻

6. Mermaid Rendering

Flow Pilot menggunakan Mermaid.js untuk render diagram menjadi SVG.

Requirement:

* Mermaid harus dirender di Webview VS Code.
* SVG harus bisa di-zoom.
* SVG harus bisa di-pan / geser.
* Node harus bisa diklik.
* Node harus memiliki ID stabil.
* Node harus terhubung dengan metadata kode.

⸻

7. Interaksi Diagram

7.1 Zoom

User harus bisa melakukan zoom dengan:

* Mouse wheel
* Trackpad pinch
* Tombol zoom in
* Tombol zoom out
* Tombol reset zoom
* Tombol fit to screen

Kontrol minimal:

[ - ] [ 100% ] [ + ] [ Fit ] [ Reset ]

Behavior:

* Zoom tidak boleh membuat diagram keluar total dari viewport.
* Zoom harus smooth.
* Minimal zoom: 25%
* Maksimal zoom: 300%
* Default zoom: fit to screen atau 100%

⸻

7.2 Pan / Geser / Swipe

User harus bisa menggeser diagram dengan:

* Drag mouse
* Trackpad swipe
* Horizontal scroll
* Vertical scroll

Behavior:

* Saat diagram lebih besar dari viewport, user bisa drag untuk melihat area lain.
* Cursor berubah menjadi grab / grabbing.
* Pan tidak boleh konflik dengan klik node.
* Klik node tetap harus bisa digunakan meskipun diagram bisa digeser.

⸻

7.3 Click Node

Saat user klik node:

Panel inspector di kanan akan menampilkan detail node.

Contoh:

Node Detail
Label:
Payment Controller
Type:
Controller
File:
lib/features/payment/presentation/payment_controller.dart
Line:
40 - 120
Description:
Handles payment initialization and result state.
Actions:
[Open File]
[Highlight Code]
[Copy File Path]

⸻

7.4 Highlight Kode

Saat user klik Highlight Code, extension harus:

1. Membuka file terkait di VS Code editor.
2. Scroll ke line yang relevan.
3. Highlight range line.
4. Fokus ke editor.

Contoh:

payment_controller.dart
line 40 - 120

⸻

7.5 Inspector Panel

Inspector harus menampilkan:

* Nama node
* Tipe node
* File path
* Line start
* Line end
* Potongan kode
* Relasi masuk
* Relasi keluar
* Tombol open file
* Tombol highlight code

Jika node belum punya file mapping:

This node does not have source code mapping yet.

⸻

8. History Page

8.1 Tujuan History

History menyimpan semua flow yang pernah berhasil di-generate.

User bisa:

* Melihat flow lama
* Membuka ulang diagram
* Membandingkan hasil generate sebelumnya
* Menghapus flow
* Rename flow
* Generate ulang flow

⸻

8.2 Struktur Item History

Setiap item history minimal memiliki:

{
  "id": "flow_001",
  "title": "Payment System Flow",
  "description": "Flow for parent payment system.",
  "createdAt": "2026-05-31T13:00:00+07:00",
  "updatedAt": "2026-05-31T13:00:00+07:00",
  "status": "success",
  "diagramTypes": ["flowchart", "sequence"],
  "sourceFiles": [
    "lib/features/payment/payment_controller.dart",
    "lib/features/booking/booking_screen.dart"
  ],
  "nodeCount": 12,
  "edgeCount": 16
}

⸻

8.3 Empty State

Saat belum ada history:

No flow history yet
Generate your first code flow using MCP.
Example:
"Generate payment flow from booking to payment completed."

⸻

8.4 History Actions

Setiap item history memiliki action:

Open
Rename
Regenerate
Delete
Copy Prompt
Export Mermaid
Export JSON

⸻

9. Detail Halaman Flow Viewer

Saat user membuka flow dari history, halaman viewer menampilkan:

 ---------------------------------------------------------
| Header                                                  |
| Title: Payment System Flow                              |
| Description                                             |
| Diagram Type Switch: Flowchart | Sequence               |
 ---------------------------------------------------------
| Toolbar                                                 |
| Zoom -, Zoom +, Fit, Reset, Export                      |
 ---------------------------------------------------------
| Diagram Area                              | Inspector    |
| Mermaid SVG                               | Node Detail   |
|                                           | Code Snippet  |
 ---------------------------------------------------------

⸻

10. UI dan Theme Requirement

10.1 Harus Mengikuti Visual Studio Code Theme

Extension tidak boleh memakai style yang terasa asing dari VS Code.

Gunakan CSS variable dari VS Code Webview:

body {
  color: var(--vscode-foreground);
  background-color: var(--vscode-editor-background);
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
}

⸻

10.2 Warna Utama

Gunakan token VS Code:

--vscode-editor-background
--vscode-editor-foreground
--vscode-sideBar-background
--vscode-sideBar-foreground
--vscode-panel-background
--vscode-panel-border
--vscode-button-background
--vscode-button-foreground
--vscode-button-hoverBackground
--vscode-input-background
--vscode-input-foreground
--vscode-input-border
--vscode-list-hoverBackground
--vscode-list-activeSelectionBackground
--vscode-list-activeSelectionForeground
--vscode-focusBorder
--vscode-descriptionForeground
--vscode-errorForeground
--vscode-warningForeground

⸻

10.3 Styling Rule

Dilarang menggunakan warna hardcoded seperti:

background: #ffffff;
color: #000000;
background: #1e1e1e;

Kecuali untuk fallback minimal.

Semua warna harus mengikuti theme VS Code.

⸻

10.4 Layout Style

Style harus mirip native VS Code:

* Flat layout
* Tidak terlalu banyak shadow
* Border tipis
* Font mengikuti VS Code
* Sidebar compact
* Toolbar sederhana
* Hover state jelas
* Active state jelas
* Focus ring sesuai VS Code

⸻

10.5 Komponen UI

Minimal komponen:

History List
Flow Viewer
Diagram Toolbar
Diagram Canvas
Inspector Panel
Code Preview
Error State
Loading State
Empty State

⸻

11. Loading State

Saat AI sedang generate flow, tampilkan status proses.

Contoh:

Generating Flow...
1. Understanding user request
2. Searching relevant files
3. Reading code structure
4. Building flow nodes
5. Generating Mermaid diagram
6. Saving to history

Status harus bisa berubah secara progresif.

⸻

12. Error State

Jika generate gagal, jangan crash.

Tampilkan error yang jelas:

Failed to generate flow
Reason:
No relevant payment files found.
Suggestion:
Try a more specific prompt, for example:
"Generate payment flow from BookingScreen to StripePaymentService"

History boleh menyimpan status failed jika berguna untuk debugging.

⸻

13. Partial Result

Jika AI hanya menemukan sebagian flow, tetap tampilkan hasil partial.

Contoh:

Partial Flow Generated
Flow Pilot found booking and payment controller,
but could not find payment confirmation handler.

Status:

{
  "status": "partial"
}

⸻

14. MCP Tool Specification

14.1 Tool Name

generate_flow

⸻

14.2 Input

{
  "prompt": "Tunjukkan alur payment system di fitur parent",
  "diagramTypes": ["flowchart", "sequence"],
  "maxDepth": 5,
  "includeErrorPath": true,
  "saveToHistory": true
}

⸻

14.3 Output

{
  "flowId": "flow_001",
  "title": "Parent Payment System Flow",
  "status": "success",
  "summary": "Generated payment flow from booking screen to payment completion.",
  "historySaved": true
}

⸻

14.4 Internal Flow Output

MCP harus menghasilkan data lengkap:

{
  "id": "flow_001",
  "title": "Parent Payment System Flow",
  "description": "Payment flow from parent booking to payment completed.",
  "requestPrompt": "Tunjukkan alur payment system di fitur parent",
  "status": "success",
  "createdAt": "2026-05-31T13:00:00+07:00",
  "diagram": {
    "flowchart": "flowchart TD\nA[Booking Screen] --> B[Payment Controller]",
    "sequence": "sequenceDiagram\nparticipant A\nparticipant B"
  },
  "nodes": [
    {
      "id": "booking_screen",
      "label": "Booking Screen",
      "type": "ui",
      "file": "lib/features/booking/booking_screen.dart",
      "lineStart": 20,
      "lineEnd": 100,
      "description": "User starts payment from booking screen."
    }
  ],
  "edges": [
    {
      "from": "booking_screen",
      "to": "payment_controller",
      "label": "tap pay button"
    }
  ],
  "sourceFiles": [
    {
      "path": "lib/features/booking/booking_screen.dart",
      "reason": "Contains payment button entry point."
    }
  ]
}

⸻

15. Data yang Harus Disimpan ke History

Setiap hasil generate harus disimpan.

Minimal disimpan:

flow id
title
description
original prompt
created date
updated date
status
diagram type
mermaid source
nodes
edges
source files
code mapping

Lokasi penyimpanan bisa menggunakan:

VS Code globalState
VS Code workspaceState
local JSON file inside .vscode/flow-pilot

Rekomendasi:

.vscode/flow-pilot/history.json
.vscode/flow-pilot/flows/{flowId}.json

⸻

16. File Structure Extension

Contoh struktur extension:

flow-pilot/
  package.json
  src/
    extension.ts
    commands/
      openHistoryCommand.ts
      openFlowCommand.ts
      highlightCodeCommand.ts
    mcp/
      generateFlowTool.ts
      codebaseScanner.ts
      flowBuilder.ts
      mermaidBuilder.ts
    storage/
      historyStorage.ts
      flowStorage.ts
    webview/
      historyView.ts
      flowViewer.ts
      messageHandler.ts
  media/
    main.css
    main.js
  types/
    flow.ts
    history.ts

⸻

17. Webview Message Protocol

Webview dan extension host harus berkomunikasi lewat message.

17.1 Webview → Extension

{
  "type": "openFile",
  "payload": {
    "file": "lib/features/payment/payment_controller.dart",
    "lineStart": 40,
    "lineEnd": 120
  }
}
{
  "type": "highlightCode",
  "payload": {
    "file": "lib/features/payment/payment_controller.dart",
    "lineStart": 40,
    "lineEnd": 120
  }
}
{
  "type": "deleteFlow",
  "payload": {
    "flowId": "flow_001"
  }
}

⸻

17.2 Extension → Webview

{
  "type": "flowLoaded",
  "payload": {
    "flowId": "flow_001",
    "title": "Payment Flow",
    "nodes": [],
    "edges": [],
    "diagram": {}
  }
}
{
  "type": "generationProgress",
  "payload": {
    "step": "Searching relevant files",
    "progress": 40
  }
}

⸻

18. Anti-Bug Requirement

Flow Pilot harus stabil dan tidak mudah crash.

18.1 Error Handling

Semua bagian harus handle error:

* File tidak ditemukan
* Line number invalid
* Mermaid syntax error
* Diagram terlalu besar
* MCP gagal membaca codebase
* History JSON corrupt
* Webview gagal render
* Node tidak punya metadata
* Workspace belum dibuka
* Permission file bermasalah

⸻

18.2 Fallback Behavior

Jika Mermaid gagal render:

Show raw Mermaid source
Show error message
Allow user to copy Mermaid

Jika file tidak ditemukan:

File not found. It may have been moved or deleted.

Jika history corrupt:

History file is corrupted.
Create backup and start new history.

⸻

18.3 Validasi Data

Sebelum menyimpan flow:

* Pastikan flowId ada.
* Pastikan title ada.
* Pastikan Mermaid valid.
* Pastikan nodes array valid.
* Pastikan edges array valid.
* Pastikan file path relatif workspace.
* Pastikan lineStart dan lineEnd number.
* Pastikan lineStart <= lineEnd.

⸻

19. Kriteria Generate Flow yang Bagus

Flow dianggap bagus jika:

* Sesuai dengan prompt user.
* Tidak terlalu umum.
* Menunjukkan file/fungsi/class penting.
* Node bisa diklik.
* Ada mapping ke kode asli.
* Alur mudah dibaca.
* Ada start dan end.
* Ada success path.
* Ada error path jika ditemukan.
* Disimpan ke history.
* Bisa dibuka ulang tanpa regenerate.

⸻

20. Contoh Prompt User

Generate flow untuk fitur login dari input email sampai masuk dashboard.
Pelajari alur booking parent sampai tutor menerima jadwal.
Tunjukkan flow payment system di fitur parent.
Visualisasikan in-app purchase dari booking → bayar → payment sheet muncul → payment completed.
Cari alur bagaimana notification dikirim dari backend ke mobile app.

⸻

21. Acceptance Criteria

21.1 History

* User membuka extension dan melihat halaman History.
* Jika belum ada flow, tampil empty state.
* Jika sudah ada flow, tampil daftar history.
* User bisa membuka flow lama.
* User bisa menghapus flow.
* User bisa rename flow.
* Flow baru otomatis masuk history setelah generate.

⸻

21.2 Generate Flow

* MCP tool generate_flow tersedia.
* User bisa memberi prompt natural language.
* AI membaca codebase.
* AI menemukan file relevan.
* AI membuat node dan edge.
* AI membuat Mermaid flowchart.
* AI membuat Mermaid sequence diagram jika memungkinkan.
* Hasil disimpan ke history.
* Hasil bisa dibuka di extension.

⸻

21.3 Diagram Viewer

* Diagram tampil di webview.
* Diagram mengikuti theme VS Code.
* Diagram bisa zoom in.
* Diagram bisa zoom out.
* Diagram bisa reset zoom.
* Diagram bisa fit to screen.
* Diagram bisa digeser.
* Node bisa diklik.
* Klik node membuka inspector.

⸻

21.4 Inspector

* Inspector menampilkan detail node.
* Inspector menampilkan file path.
* Inspector menampilkan line range.
* Inspector menampilkan code snippet.
* Tombol Open File berfungsi.
* Tombol Highlight Code berfungsi.
* Klik code snippet membuka file di VS Code.

⸻

21.5 Theme

* UI mengikuti active VS Code theme.
* Dark theme terlihat baik.
* Light theme terlihat baik.
* Warna tidak hardcoded.
* Button, input, panel, border mengikuti VS Code CSS variable.

⸻

22. Non-Goal

Flow Pilot tidak harus:

* Mengubah kode user.
* Refactor otomatis.
* Menjalankan aplikasi.
* Menjamin 100% call graph sempurna.
* Menggantikan dokumentasi manual sepenuhnya.
* Membaca seluruh repo jika tidak relevan.
* Membuat diagram terlalu besar sampai tidak terbaca.

⸻

23. Prioritas MVP

MVP 1 — Core Flow

Fokus:

History page
generate_flow MCP
AI scan codebase
Generate Mermaid flowchart
Save to history
Open flow viewer
Click node
Open file line

⸻

MVP 2 — Better Viewer

Tambahkan:

Zoom
Pan
Fit to screen
Reset zoom
Inspector panel
Code snippet
Sequence diagram

⸻

MVP 3 — Quality Improvement

Tambahkan:

Regenerate flow
Rename flow
Delete history
Export Mermaid
Export JSON
Partial result
Error path detection
Better code mapping

⸻

24. Prompt untuk AI Engineer

Gunakan prompt ini untuk AI coding agent:

You are an AI engineering agent helping me build Flow Pilot, a VS Code Extension integrated with MCP.
Core product:
Flow Pilot allows users to generate interactive code flow diagrams from natural language prompts.
Main use case:
User asks:
"Study the in-app purchase flow from booking → payment → payment sheet appears → payment completed."
The system must:
1. Understand the requested feature flow.
2. Search relevant code in the current workspace.
3. Identify important files, functions, classes, and call relationships.
4. Convert them into flow nodes and edges.
5. Generate Mermaid flowchart and sequence diagram when possible.
6. Render the diagram inside a VS Code Webview.
7. Make every diagram node clickable.
8. Show clicked node detail in inspector.
9. Allow user to open and highlight source code line from the inspector.
10. Save every generated result into History.
11. Make the diagram zoomable and pannable.
12. Ensure UI follows the active Visual Studio Code theme using VS Code CSS variables.
13. Avoid hardcoded colors.
14. Handle errors gracefully and never crash the extension.
Important UX:
- First screen must be History.
- Empty history must show empty state.
- Generated flow must automatically appear in History.
- Viewer must support zoom in, zoom out, reset zoom, fit to screen, and drag to pan.
- Inspector must show file path, line range, node type, description, and code snippet.
- Button "Open File" must open the source file in VS Code.
- Button "Highlight Code" must reveal and highlight the relevant line range.
Technical constraints:
- Use Mermaid.js for diagrams.
- Render Mermaid as SVG inside VS Code Webview.
- Attach click event listeners to SVG nodes.
- Store flow data as JSON.
- Use VS Code globalState/workspaceState or .vscode/flow-pilot storage.
- Use VS Code theme variables:
  var(--vscode-editor-background)
  var(--vscode-foreground)
  var(--vscode-button-background)
  var(--vscode-button-foreground)
  var(--vscode-panel-border)
  var(--vscode-input-background)
Implementation must be incremental:
1. Build History page.
2. Build Flow data model.
3. Build storage layer.
4. Build Webview renderer.
5. Build Mermaid renderer.
6. Build zoom and pan interaction.
7. Build inspector.
8. Build open file and highlight code command.
9. Build MCP generate_flow tool.
10. Connect MCP output to history and viewer.
Do not implement random features outside this scope.
Focus only on generating accurate, clickable, zoomable, pannable code flow diagrams and saving them to history.

⸻

25. Versi Pendek untuk README

Flow Pilot is a VS Code Extension integrated with MCP that helps developers visualize code flow from natural language prompts.
Example:
"Generate payment flow from booking to payment completed."
Flow Pilot will:
- Analyze the current codebase
- Find relevant files and functions
- Generate Mermaid flowchart and sequence diagram
- Render interactive diagrams inside VS Code
- Allow zoom, pan, and node click
- Show node details in inspector
- Open and highlight source code lines
- Save every generated result into History
The UI follows the active VS Code theme and uses VS Code theme variables to support dark and light mode.

⸻