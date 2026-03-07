export const MOCK_USER_DATA = {
  name: "Alex Vance",
  role: "Senior Systems Analyst",
  jstScore: {
    total: 242,
    jobs: 82,
    skills: 78,
    talent: 82
  },
  vulnerabilityLevel: 1, // At Risk
  readinessProfile: "Architect", // Architect, Orchestrator, Conductor
  transferability: [
    { subject: 'Industry Mobility', A: 85, fullMark: 100 },
    { subject: 'Geographic Port.', A: 60, fullMark: 100 },
    { subject: 'Innovation Trans.', A: 75, fullMark: 100 },
    { subject: 'Leadership Scal.', A: 55, fullMark: 100 },
    { subject: 'Tech Fluency', A: 90, fullMark: 100 },
    { subject: 'Data Literacy', A: 80, fullMark: 100 },
    { subject: 'Creative Problem', A: 70, fullMark: 100 },
    { subject: 'Comm. Impact', A: 65, fullMark: 100 },
    { subject: 'Agility Index', A: 88, fullMark: 100 },
    { subject: 'Domain Breadth', A: 50, fullMark: 100 },
    { subject: 'Execution Speed', A: 75, fullMark: 100 },
    { subject: 'Strategic Vision', A: 60, fullMark: 100 },
  ],
  upskillingPlan: [
    {
      id: "1",
      phase: "30-Day",
      type: "ready-skilling",
      title: "Prompt Engineering Foundations",
      description: "Master LLM interaction protocols for system analysis tasks to mitigate immediate automation risk.",
      hours: 15
    },
    {
      id: "2",
      phase: "90-Day",
      type: "up-skilling",
      title: "Cloud Architecture Synthesis",
      description: "Deepen expertise in multi-cloud environments to increase JST skills score.",
      hours: 45
    },
    {
      id: "3",
      phase: "12-Month",
      type: "new-skilling",
      title: "AI Orchestration Leadership",
      description: "Transition to AI Integration Manager role. Focus on strategic deployment of ML models.",
      hours: 120
    }
  ],
  pivotOpportunities: [
    { role: "AI Integration Manager", feasibility: 82, gapCost: "$2,400", time: "6 Months" },
    { role: "Data Strategy Lead", feasibility: 75, gapCost: "$4,100", time: "9 Months" },
    { role: "Product Operations Dir.", feasibility: 68, gapCost: "$5,500", time: "12 Months" }
  ]
};

export const MOCK_ENTERPRISE_DATA = {
  overview: {
    totalEmployees: 4250,
    averageJST: 195,
    attritionRisk: "High", // 18%
    projectedAttrition: "18%"
  },
  vulnerabilityDistribution: [
    { name: "Critical", value: 15, fill: "hsl(var(--destructive))" },
    { name: "At Risk", value: 30, fill: "#f97316" }, // orange-500
    { name: "Transitional", value: 25, fill: "#eab308" }, // yellow-500
    { name: "Resilient", value: 20, fill: "hsl(var(--primary))" },
    { name: "Flourishing", value: 10, fill: "hsl(var(--secondary))" }
  ],
  departmentHeatmap: [
    { dept: "Customer Support", risk: 88, color: "bg-destructive/20 border-destructive" },
    { dept: "Data Entry & Admin", risk: 95, color: "bg-destructive/20 border-destructive" },
    { dept: "Financial Analysis", risk: 65, color: "bg-orange-500/20 border-orange-500" },
    { dept: "Software Engineering", risk: 40, color: "bg-yellow-500/20 border-yellow-500" },
    { dept: "Strategic Planning", risk: 15, color: "bg-secondary/20 border-secondary" },
  ]
};