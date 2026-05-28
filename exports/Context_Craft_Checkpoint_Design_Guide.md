<div class="cover">
  <div class="cover-inner">
    <div class="tag">ATANDA Publications Forum · Junglenomics FORGE Institute</div>
    <h1>Checkpoint Page<br/>Design Guide</h1>
    <div class="subtitle">For the PDF onboarding edition of <em>Context Craft — The Last Human Skill</em>. A reusable spec for after-chapter checkpoint pages that convert reading into measurable ARK Platform action.</div>
    <div class="manifesto">
      A checkpoint page does three things, in order: <strong>lock in the concept</strong>, <strong>turn the reading into one concrete platform action</strong>, and <strong>capture a number the reader can compare against later</strong>. Anything more and it stops being a checkpoint. Anything less and it stops being an onboarding guide.
    </div>
    <div class="meta">
      <div>
        <div>Document · Checkpoint Design Guide v1.0</div>
        <div>Audience · Editorial · Layout · Onboarding</div>
        <div>Date · 2026-05-28</div>
      </div>
      <div class="atanda">
        <strong>ATANDA</strong>
        <span>Publications Forum</span>
      </div>
    </div>
  </div>
</div>

# 1 · What a Checkpoint Page Is For

A checkpoint page placed after each chapter has three jobs. Listed in priority order, because when the page runs long you cut from the bottom up.

1. **Lock in the concept.** Convert passive reading into a retrieval moment so the reader still remembers the idea next week.
2. **Convert reading into platform action.** Give the reader one concrete thing to do inside ARK before the next chapter. This is what makes the book an *onboarding guide*, not just a book with quizzes at the end.
3. **Capture a measurable baseline.** Have the reader write down one number — their JST Index, their Vulnerability Level, their Archetype, their CCMI pillar — so the book has a real before-and-after arc by the time they finish it.

If a checkpoint page tries to do more than these three jobs, it stops being a checkpoint and becomes another chapter.

# 2 · Anatomy of a Checkpoint Page

Use the same six blocks in the same order, every chapter. Predictability is what makes readers actually do the work.

| Block | Purpose | Length |
|---|---|---|
| **Concept Recall** (3 prompts) | Free-recall retrieval. No multiple choice — force the reader to reconstruct, not recognise. | ⅙ page |
| **Self-Scan** (1–2 prompts) | Apply the concept to *the reader's own* career. Turns abstract theory into personal stake. | ⅙ page |
| **The Platform Step** | One specific action in ARK. Route name + what to do + what they'll see. | ⅓ page |
| **Your Number to Capture** | A single value to write down. Boxed field, ruled line, generous whitespace. | ⅙ page |
| **Reflection Prompt** | One open question to journal on. Ties the captured number back to the book's narrative. | ⅙ page |
| **What's Coming** | One sentence of cliffhanger continuity, in the book's own voice. | one line |

The page **must fit on one side**. The moment a checkpoint runs to two pages, readers skip it.

# 3 · Mapping Book Concepts to Real ARK Actions

This is the highest-stakes design decision in the whole guide. The book's metaphors map cleanly onto a small set of ARK surfaces — but only the ones that actually ship. Use this table as the canonical mapping. Do not invent new ones.

| Book concept | Real ARK action | Number to capture |
|---|---|---|
| JST Index introduction | Upload resume at `/upload` | JST Index (0–300) + the J/S/T sub-scores |
| AI Vulnerability | View Vulnerability Meter on `/dashboard` | Vulnerability Level (0–4) + risk % |
| Value Osmosis (inflow / outflow) | Read the Flywheel Card CTA on `/dashboard` | The next recommended action, verbatim |
| Bronze vs. Foil professional | Check Archetype Handicap on `/dashboard` | Primary archetype + 3-vector breakdown |
| Context Craft as the survival skill | Play one CCGE round at `/play` | KCSE score + cert tier (Bronze → Platinum) |
| Career pivot / transferability | Open `/pathways` | Top 3 pivot opportunities + skill-gap % |
| Upskilling discipline | Review Upskilling Timeline on `/pathways` | Their 30-day item |
| Cohort / institutional learning *(school readers only)* | Join or view cohort on `/school` | Cohort name + assignment due dates |
| Long-game proof of growth | `/ark/history` — score trajectory chart | Current ARK score vs. starting ARK score |

> **Honesty rule.** If a chapter talks about *organisational anxiety mapping*, *failure DNA*, *governance architecture*, or *AI cost discipline at the firm level*, do **not** invent an ARK checkpoint for it. Use a Reflection Prompt only — never claim the platform measures something it doesn't.

# 4 · PDF-Specific Design Constraints (and How to Use Them Well)

- **No interactive forms.** Use ruled lines for handwriting. Print readers will write in pen. Tablet readers will annotate.
- **One QR code per checkpoint.** Top-right corner of the page, linking directly to the relevant ARK route. Static PDFs don't deep-link well from in-document hyperlinks on phones; a QR is universal.
- **Hyperlink the route name too.** For desktop PDF readers. Belt and braces.
- **A coloured rule across the top of every checkpoint page.** Makes them instantly recognisable when flipping through. Suggest cyan to match the ARK primary (`hsl(188 86% 53%)`) so the book and the product look like the same family.
- **Number checkpoints independently of chapters.** Checkpoint 1, 2, 3… Lets readers refer back: *"go redo Checkpoint 4 after your next assessment."*
- **Reserve a Your Numbers Ledger appendix at the back.** One page summarising every Number to Capture across all chapters. By the end the reader has a longitudinal record of their own ARK trajectory written in their own hand. This is the single most powerful retention asset the book can produce.

# 5 · Cadence — Every Chapter, or Every Section?

Every chapter is too frequent if chapters run short (under 10 pages). Too rare if chapters run dense (50+ pages). Two practical options:

- **Option A — Recommended.** One checkpoint at the end of each numbered chapter, plus a quarter-page **Pulse Check** every ~20 pages of dense theory. Pulse Checks don't need a platform action — they just keep recall alive during long stretches.
- **Option B.** One checkpoint per Part / Section. The book is structured around the Prologue's 8–10 Key Concepts; treat each concept cluster as a section. Lower friction, fewer interruptions, less reinforcement.

Pick A if the goal is *active onboarding.* Pick B if the goal is *narrative-first read with light platform tie-in.*

# 6 · Worked Example — Checkpoint 1

Treat this as a template you can copy. The voice mirrors the book's existing narrative voice (the David Martinez cliffhanger that closes the Prologue).

<div class="callout">

## Checkpoint 1
*After the Prologue: The Numbers Don't Lie*

**Concept Recall** *(write your answers in the margin)*

1. In your own words, what do the three letters in JST stand for, and which layer is owned by you vs. by your employer?
2. What is Value Osmosis trying to describe? One sentence.
3. Of the three professional archetypes — Bronze, Foil, Bronze+Foil — which are you most afraid of becoming, and why?

**Self-Scan**

Look at last week's calendar. Count the hours you spent on *Jobs-layer* tasks (routine, pattern-matching, predictable). Write the number here: \_\_\_\_.
Be honest. The number doesn't go anywhere.

**The Platform Step**  ⟶  `arkplatform.app/upload`   [QR code]

Upload your resume — PDF or pasted text, under 10 MB. The platform will run a five-phase analysis and surface your JST Index, your Vulnerability Level, and your primary Archetype. This is the moment David Martinez had at the top of the Prologue. It's yours now.

**Your Number to Capture**

```
My JST Index:  ____ / 300        Sub-scores  J: ___   S: ___   T: ___
Vulnerability Level:  ___ / 4    My Archetype:  ___________________
```

**Reflection Prompt**

The Prologue said *"these numbers don't lie."* When you saw yours, did you agree, disagree, or feel something more complicated? Write one paragraph. Date it.

**What's Coming**

In Chapter 1 we follow David Martinez out of that annual review and into the first decision the JST score forces every professional to make. Bring your numbers with you.

</div>

# 7 · Voice and Tone Notes

- The book's voice is **declarative, slightly dramatic, second-person**. Checkpoints should match. Never go academic (*"In this section we have learned…"*) and never go corporate (*"Action items:"*). Direct address, short sentences, the occasional aphorism. The Prologue is the model.
- **Resist quiz-like multiple choice.** This book sells the idea that the JST score is a personal reckoning. MCQ trivialises that. Free-recall and journaling fit the tone.
- **Treat each Number to Capture as a small ritual.** A boxed field, generous whitespace, a date line. Readers who write their score in pen are far more likely to act on it than readers who just see it on a screen.

# 8 · Two Things to Avoid

1. **Don't gate later chapters on completing checkpoints.** This is a book, not a course platform. Soft pressure — cliffhanger continuity, the Ledger appendix waiting to be filled — outperforms hard pressure in every print-pedagogy study.
2. **Don't promise platform capabilities the code doesn't ship.** If a chapter discusses organisational anxiety mapping, failure DNA, or governance architecture, route the checkpoint into a journal prompt, not a fabricated ARK route. Keep the Capability Reality Check document next to the manuscript while drafting checkpoints — it is your safety net against accidental over-promise.

# 9 · Suggested Next Step

Send the chapter list — titles plus a one-line summary per chapter — and the full checkpoint set can be drafted from it. One page per chapter, mapped against the ARK Action Table in §3, ready to drop into the PDF layout. The **Your Numbers Ledger** appendix template can be produced at the same time so it stays consistent with whatever checkpoints are generated.

If a manuscript read-through is needed first (the full book runs to ~7,965 lines and only the opening ~450 have been reviewed), forward it in chunks of ~1,500–2,000 lines and the chapter-by-chapter checkpoint draft can follow.

---

<div class="callout">

**Companion documents**

- `exports/ARK_Onecraft_Capability_vs_TREE_Reality_Check.md` — the honesty audit of which platform surfaces actually ship. Use it as the safety net referenced in §8.2.
- `exports/ARK_PDD_LLM_Usage_Guardrail.md` — the AI cost discipline framework that governs Claude usage during reader onboarding (Phase O guardrail). Relevant if any future checkpoint surfaces Claude-graded feedback.

</div>
