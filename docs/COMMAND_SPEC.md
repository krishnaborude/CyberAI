# Command Input and Output Contracts

## Roadmap Command
`/roadmap` inputs:
- Required: `goal`
- Optional: `weeks`

Output format:
1. `<Goal> Roadmap` title
2. `Overview` section with duration, pace, prerequisites, lab setup
3. Phase sections (`Phase N: ...`)
4. Week sections (`Week N: ...`) for full duration coverage
5. Weekly bullets: `Learn`, `Do`, `Deliverable`

## Study Plan Command
`/studyplan` requires all of the following inputs:
- `certification`
- `experience_level`
- `hours_per_week`
- `duration_weeks`
- `focus_area`

Output format:
1. Overview Summary
2. Weekly Breakdown
3. Skills Progression Milestones
4. Recommended Lab Types
5. Practice Strategy
6. Review & Reinforcement Plan
7. Final Exam Readiness Checklist
8. Certification Alignment Notes

## Explain Command
`/explain` requires:
- `concept`

Output format:
1. Chunk 1/5: Concept Summary
2. Chunk 2/5
3. Chunk 3/5: Discovery Commands
4. Chunk 4/5: Enumeration Commands
5. Chunk 5/5: Validation and Safety Notes

## Tools Command
`/tools` requires:
- `focus`

Output format:
1. Tool categories
2. Best starter tools per category
3. Safe basic commands with what each command does
4. Common setup mistakes
5. Lab-only safety reminders
6. Next learning steps

## Labs Command
`/labs` inputs:
- Required: `query`
- Optional: `platform`

Output format:
1. User input echo
2. Numbered lab recommendations
3. Per lab: name, platform, difficulty, link, short description

## Quiz Command
`/quiz` inputs:
- Optional: `topic` (default: general cybersecurity fundamentals)
- Optional: `questions` (default: 5, range: 3-10)

Output format:
1. Quiz title heading
2. `Questions` section
3. Each question with exactly four options: `A)`, `B)`, `C)`, `D)`
4. `Answer Key` section using `Qn: <option>`

## News Command
`/news` inputs:
- Required: `focus`
- Optional: `tier` (`all`, `critical`, `intermediate`, `basic`)

Output format:
1. User input echo
2. `Cybersecurity News (Live Links)` heading
3. Tiered sections (`Latest`, `Critical`, `Intermediate`, `Basic`) based on filter
4. Per item: title, source/date/tier, link, summary

## Resource Command
`/resource` inputs:
- Required: `query`
- Optional: `type` (`all`, `articles`, `blogs`, `github`, `books`, `walkthrough`)
- Optional: `limit` (3-8, with mixed `all` mode normalized to 5)

Output format:
1. User input echo
2. Search header with selected filter/count
3. Numbered resources
4. Per resource: name, summary, platform, type, link

## Red Team Command
`/redteam` inputs:
- Required: `objective`
- Required: `scope`
- Optional: `level`
- Optional: `environment`

Output format:
1. Authorization and Scope Assumptions
2. Discovery
3. Filter Analysis
4. Bypass Techniques (Lab-Safe, High-Level)
5. Internal Mapping
6. Metadata Extraction
7. Credential Abuse Paths (Authorized Simulation Only)
8. Pivot Potential
9. MITRE ATT&CK Mapping
10. Detection Evasion Notes (Defender View)
