# Use of AI in TerraVoxis

NASA Space Apps asks teams to disclose their use of AI.

* **Tools used:** Anthropic's Claude (through Claude Code, an AI coding assistant) was used to write
  most of the code, tests, offline media pipeline and documentation, following a design brief written
  by the team (`docs/MASTER_BUILD_PROMPT.md`) and research in `docs/RESEARCH_REPORT.md`. The team
  directed, reviewed and is responsible for the result.
* **What the AI did:** wrote TypeScript, React and Python code; tuned colour thresholds by measuring
  real NASA frames; wrote and ran unit, end-to-end and accessibility tests; drafted these documents.
* **What no AI does:** no AI or language model runs inside the app. Every sound is produced by
  deterministic algorithms from the pixels of NASA frames, and every description is built from fixed
  templates. Scene descriptions come from the brief and the NASA SVS pages; no NASA facts were generated.
* **Images and audio:** no AI-generated images, video or audio are used. All pictures are NASA SVS
  visualizations, credited on every scene and on the Credits page.
