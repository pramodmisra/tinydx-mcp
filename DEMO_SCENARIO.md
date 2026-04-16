# TinyDx — Demo Scenario & Synthetic Patient Case

## Synthetic Patient: "Lily Chen" (Age 6)

### Patient Background
Lily is a 6-year-old girl who has been seen by 5 different specialists over 3 years. Each doctor documented different symptoms but nobody connected the dots. Her parents are exhausted, frustrated, and scared.

### Why This Case Works for Demo
- Multi-system symptoms (skeletal, cardiac, ocular, connective tissue) → classic rare disease presentation
- Scattered across multiple providers/encounters → shows the diagnostic odyssey
- Real disease target: **Marfan Syndrome** (ORPHA:558, OMIM:154700)
  - Well-known enough that judges recognize it
  - Complex enough (multi-system) to show TinyDx's value
  - Has clear HPO phenotype profile for validation
- Family history component (father has mild features)
- Visually compelling in demo (scattered → assembled → diagnosed)

### Alternative: Use a LESS common disease for more impact
Consider **Loeys-Dietz Syndrome** (ORPHA:60030) or **Ehlers-Danlos Syndrome, vascular type** (ORPHA:286). These are rarer, making the "no single doctor knows this" narrative even stronger. But ensure the HPO profile is well-documented.

### FHIR Bundle Structure

Create a FHIR Bundle (type: transaction) with these resources:

#### Patient Resource
```json
{
  "resourceType": "Patient",
  "id": "lily-chen-001",
  "name": [{"given": ["Lily"], "family": "Chen"}],
  "gender": "female",
  "birthDate": "2020-03-15"
}
```

#### Conditions (scattered across time — the diagnostic odyssey)
1. **Age 3 (2023-05)** — Pediatrician visit
   - "Tall stature for age" (above 97th percentile)
   - "Joint hypermobility"

2. **Age 4 (2024-02)** — Orthopedic specialist
   - "Scoliosis"
   - "Pectus excavatum" (sunken chest)
   - "Arachnodactyly" (long fingers) — noted but not followed up

3. **Age 4.5 (2024-08)** — Ophthalmologist
   - "Myopia, progressive"
   - "Lens subluxation" — this is a KEY finding for Marfan

4. **Age 5 (2025-03)** — Cardiologist (referral for heart murmur)
   - "Mitral valve prolapse"
   - "Aortic root dilation" — this is the DANGEROUS finding

5. **Age 6 (2026-01)** — Another pediatrician visit
   - "Stretch marks" (striae)
   - "Flat feet" (pes planus)
   - "Recurrent joint pain"

#### Observations
- Growth chart data: height consistently >97th percentile
- Arm span to height ratio: 1.06 (normal <1.05)
- Echocardiogram: aortic root Z-score 2.8 (borderline dilated)

#### FamilyMemberHistory
- Father: tall (6'4"), mild scoliosis, wears glasses since age 10, "double-jointed"
- Paternal grandmother: died at age 45 of "heart problems" (aortic dissection?)

#### Encounters (5 different providers)
- Provider 1: Sunshine Pediatrics (2023-05, 2026-01)
- Provider 2: Children's Orthopedic Associates (2024-02)
- Provider 3: Metro Eye Center (2024-08)
- Provider 4: Children's Heart Specialists (2025-03)
- Provider 5: Urgent Care Plus (2025-11 — joint pain episode)

### Expected TinyDx Output

#### Tool 1: assemble_symptom_timeline
Should produce a unified chronological view showing ALL symptoms across ALL 5 providers over 3 years. The visual impact: "This is what no single doctor has seen."

#### Tool 2: extract_phenotype_terms
Expected HPO mappings:
- HP:0000098 Tall stature
- HP:0001382 Joint hypermobility
- HP:0002650 Scoliosis
- HP:0000768 Pectus excavatum
- HP:0001166 Arachnodactyly
- HP:0000545 Myopia
- HP:0001083 Ectopia lentis (lens subluxation)
- HP:0001634 Mitral valve prolapse
- HP:0002616 Aortic root aneurysm
- HP:0001065 Striae distensae
- HP:0001763 Pes planus
- HP:0002829 Arthralgia

#### Tool 3: generate_differential
Expected top candidates:
1. **Marfan Syndrome** (ORPHA:558) — HIGH confidence (~85% phenotype overlap)
2. Loeys-Dietz Syndrome — MODERATE confidence
3. Ehlers-Danlos Syndrome (hypermobility type) — MODERATE confidence

The self-reflection loop should:
- Confirm Marfan as top candidate (lens subluxation + aortic dilation + skeletal features = Ghent criteria)
- Note that father's features support autosomal dominant inheritance
- Flag: "Paternal grandmother's death at 45 from heart problems is consistent with undiagnosed Marfan"

#### Tool 4: suggest_diagnostic_pathway
Expected recommendations:
1. [URGENT] Genetic testing for FBN1 gene (fibrillin-1) — confirms Marfan
2. [HIGH] Cardiology follow-up with serial echocardiograms — monitor aortic root
3. [HIGH] Genetics referral for Ghent criteria clinical assessment
4. [STANDARD] Father should be evaluated (cascade screening)

#### Tool 5: create_navigator_report
Plain-language report explaining:
- "Over 3 years and 5 doctors, Lily has shown a pattern of symptoms that together may point to a condition called Marfan syndrome"
- What Marfan syndrome is (simple terms)
- Why it matters (the heart connection)
- What to do next (genetic test, cardiology follow-up)
- Questions for the doctor
- Resources: The Marfan Foundation (marfan.org), NORD, Global Genes

---

## Demo Video Script (< 3 minutes)

### Structure

**0:00-0:15 — The Hook (Statistics)**
Text on screen (no voiceover needed for first 5 seconds):
"5.6 years. 7 doctors. 7,000 diseases. Nobody sees the whole picture."
Then: "30% of children with rare diseases don't survive past age 5."

**0:15-0:30 — The Problem**
Brief voiceover: "Lily is 6. She's seen 5 specialists in 3 years. Each doctor documented different symptoms. Nobody connected the dots."
Show: Prompt Opinion platform UI with the patient context.

**0:30-0:50 — TinyDx Assembles the Timeline**
Show: Agent in Prompt Opinion calls `assemble_symptom_timeline`
Visual: Scattered symptoms from 5 providers → unified chronological timeline appears
"This is what no single doctor has seen."

**0:50-1:10 — HPO Phenotype Extraction**
Show: Agent calls `extract_phenotype_terms`
Visual: Clinical descriptions transform into standardized HPO terms
"TinyDx maps every finding to the global phenotype standard."

**1:10-1:45 — Differential Diagnosis with Reasoning**
Show: Agent calls `generate_differential`
Visual: Ranked candidates appear with confidence scores and transparent reasoning
Highlight: "Marfan Syndrome — HIGH confidence. 85% phenotype overlap."
Show the reasoning chain: "Lens subluxation + aortic dilation + skeletal features match Ghent criteria"
"The AI shows its work. Every conclusion is traceable."

**1:45-2:10 — The Navigator Report (Emotional Peak)**
Show: Agent calls `create_navigator_report`
Visual: Plain-language report appears — warm, compassionate, clear
Highlight: "Over 3 years and 5 doctors, Lily has shown a pattern..."
"A report a parent can hand to any new doctor."

**2:10-2:30 — Interoperability**
Show: Agent calls `output_phenopacket`
Visual: GA4GH Phenopacket output
"TinyDx speaks the global rare disease data language. Any system can use this."

**2:30-2:50 — Impact**
"300 million people. 5.6-year odyssey. TinyDx is the first MCP server built to end it."
"FHIR-native. HPO-powered. Family-facing. Built on open standards."
"Inspired by DeepRare. Designed for daily clinical use."

**2:50-3:00 — Close**
"TinyDx is live in the Prompt Opinion Marketplace. Any agent can use it today."
Show: Marketplace listing.

### Production Notes
- Record with OBS Studio
- Record voiceover separately (clean audio, quiet room)
- Show Prompt Opinion platform UI prominently
- Use the actual synthetic patient data (Lily Chen)
- Add captions for accessibility (judges will notice)
- Keep transitions snappy — no dead time
- End on the marketplace listing
- TOTAL: Under 3 minutes. Time it before final recording.
