# ARK - Advanced Resume & Karriere Synthesized Intelligence
## Frontend Development Plan (Mockup Prototype)

### 1. Overview
The goal is to build a high-fidelity, interactive frontend prototype of the ARK platform. The prototype will demonstrate the core features of the platform using mock data and simulated processes.

### 2. Design Direction
- **Style**: Futuristic, professional, data-centric ("Cyberpunk Dashboard" meets "Enterprise Consulting").
- **Typography**: `Orbitron` or `Space Grotesk` (Display) paired with `Inter` or `Rajdhani` (UI).
- **Color Palette**: Dark mode by default. Deep blues, neon accents (cyan/emerald for positive, amber for neutral, crimson/magenta for risk).
- **Texture**: Glassmorphism (blur backdrops), subtle grid noise, glowing edges.
- **Motion**: Smooth entry animations for data rendering, counting-up numbers for scores, radar chart drawing animations.

### 3. Application Structure
The application will use `wouter` for routing, with the following main views:

#### 3.1. Landing / Onboarding
- **Path**: `/`
- **Components**:
  - Hero section explaining the "Know Your Worth. Know Your Risk. Know Your Next Move." value proposition.
  - Call to Action to "Start Assessment" or "Upload Resume".

#### 3.2. Resume Intelligence Mining (Simulated Upload)
- **Path**: `/upload`
- **Components**:
  - Drag-and-drop file upload zone.
  - Simulated processing pipeline with loading states (parsing layout, extracting experience, identifying skills, classifying NAICS sector).
  - Transition to Dashboard upon completion.

#### 3.3. User Dashboard (The Assessment Report)
- **Path**: `/dashboard`
- **Features & Components**:
  - **JST Index Meter**: A prominent gauge or circular progress component showing the 0-300 score across Jobs, Skills, and Talent. Includes simulated percentile ranking.
  - **AI Vulnerability Meter**: A 5-level risk indicator with a task automation breakdown.
  - **AI Readiness Profile**: A badge/card classifying the user (Architect / Orchestrator / Conductor).

#### 3.4. Transferability & Upskilling
- **Path**: `/pathways`
- **Components**:
  - **12-Vector Transferability Radar Chart**: A radar/spider chart showing mobility across 12 dimensions.
  - **Pivot Opportunities**: Cards showing top 3 alternative career paths with feasibility %, timeline, and skill gap cost.
  - **Dynamic Upskilling Navigator**: A timeline/gantt view of the 30-day, 90-day, and 12-month upskilling plan.

#### 3.5. Enterprise Workforce Intelligence (Admin/HR View)
- **Path**: `/enterprise`
- **Components**:
  - Aggregated metrics (Attrition risk, AI readiness uplift).
  - Departmental Vulnerability Heatmap.
  - Simulated L&D ROI tracker.

### 4. Implementation Batches

#### BATCH 1 - Foundation & Theming
- Update `package.json` to include any necessary charting libraries (e.g., `recharts`).
- Define the Design System in `index.css` (custom HSL variables for the cyber-professional dark theme).
- Add Google Fonts to `index.html`.
- Create a global Layout component with a Sidebar/Navbar.

#### BATCH 2 - Core UI Components
- Build `JSTGauge`: Custom circular progress for the JST score.
- Build `VulnerabilityMeter`: A step-progress or segmented bar.
- Build `RadarChart`: Wrapper around `recharts` for the 12-vector transferability.
- Build `SkillCard` and `TimelineItem` for the upskilling navigator.

#### BATCH 3 - Page Assembly & Mock Data
- Create comprehensive mock data structures (`mockUser.ts`, `mockEnterprise.ts`).
- Assemble `/upload` with file upload simulation.
- Assemble `/dashboard` with JST, Vulnerability, and Readiness widgets.
- Assemble `/pathways` with Radar Chart and Upskilling timelines.
- Assemble `/enterprise` with high-level aggregate charts and heatmaps.

#### BATCH 4 - Polish & Micro-interactions
- Add `framer-motion` page transitions.
- Animate chart renderings and number counters.
- Ensure all interactive elements have `data-testid` attributes.
- Final visual QA against the Art Direction.

### 5. Tech Stack Requirements
- React 19, Vite, Tailwind CSS v4, `wouter` for routing.
- `lucide-react` for icons.
- `recharts` for complex data visualizations (Radar charts, Line charts).
- `framer-motion` for entry animations and simulated processing states.
