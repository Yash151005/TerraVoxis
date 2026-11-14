/**
 * Every external resource TerraVoxis relies on: code, tools, data, papers and services.
 * Shown on the Credits page and mirrored in the README "References" section; keep the two in sync.
 */
export interface Reference {
  name: string;
  /** Licence, role or citation detail shown after the name. */
  detail: string;
  url: string;
}

export interface ReferenceGroup {
  id: string;
  title: string;
  items: Reference[];
}

export const REFERENCES: ReferenceGroup[] = [
  {
    id: 'ref-runtime',
    title: 'Libraries in the app bundle',
    items: [
      { name: 'React and React DOM', detail: 'MIT licence. User interface.', url: 'https://react.dev/' },
      { name: 'React Router', detail: 'MIT licence. Page routing.', url: 'https://reactrouter.com/' },
      { name: 'Zustand', detail: 'MIT licence. State management.', url: 'https://github.com/pmndrs/zustand' },
    ],
  },
  {
    id: 'ref-build',
    title: 'Build, styling and test tools',
    items: [
      { name: 'Tailwind CSS and @tailwindcss/vite', detail: 'MIT licence. Styling.', url: 'https://tailwindcss.com/' },
      { name: 'Vite', detail: 'MIT licence. Development server and bundler.', url: 'https://vite.dev/' },
      { name: '@vitejs/plugin-react', detail: 'MIT licence. React support for Vite.', url: 'https://github.com/vitejs/vite-plugin-react' },
      { name: 'TypeScript', detail: 'Apache 2.0 licence. Type checking and compilation.', url: 'https://www.typescriptlang.org/' },
      { name: 'DefinitelyTyped type packages (@types/react, @types/react-dom, @types/node)', detail: 'MIT licence.', url: 'https://github.com/DefinitelyTyped/DefinitelyTyped' },
      { name: 'Vitest', detail: 'MIT licence. Unit tests.', url: 'https://vitest.dev/' },
      { name: 'Playwright', detail: 'Apache 2.0 licence. End-to-end browser tests.', url: 'https://playwright.dev/' },
      { name: 'axe-core and @axe-core/playwright (Deque Systems)', detail: 'MPL 2.0 licence. Automated accessibility checks.', url: 'https://github.com/dequelabs/axe-core' },
      { name: 'oxlint (Oxc project)', detail: 'MIT licence. Linting.', url: 'https://oxc.rs/' },
    ],
  },
  {
    id: 'ref-pipeline',
    title: 'Media pipeline (Python)',
    items: [
      { name: 'Python', detail: 'PSF licence. Runs the offline pipeline.', url: 'https://www.python.org/' },
      { name: 'requests', detail: 'Apache 2.0 licence. Downloads from the SVS API.', url: 'https://requests.readthedocs.io/' },
      { name: 'imageio-ffmpeg', detail: 'BSD 2-Clause licence. Ships an FFmpeg binary used to re-encode the videos.', url: 'https://github.com/imageio/imageio-ffmpeg' },
      { name: 'FFmpeg', detail: 'LGPL/GPL licence (depending on the build). Video transcoding.', url: 'https://ffmpeg.org/' },
      { name: 'Pillow', detail: 'MIT-CMU (HPND) licence. Image handling.', url: 'https://python-pillow.org/' },
      { name: 'NumPy', detail: 'BSD 3-Clause licence. Pixel arithmetic.', url: 'https://numpy.org/' },
    ],
  },
  {
    id: 'ref-papers',
    title: 'Research the design relies on',
    items: [
      { name: 'Dubus & Bresin 2013', detail: 'PLOS ONE. Pitch for magnitude, stereo for location.', url: 'https://doi.org/10.1371/journal.pone.0082491' },
      { name: 'Walker 2002', detail: 'Journal of Experimental Psychology: Applied. Mapping polarity.', url: 'https://doi.org/10.1037/1076-898X.8.4.211' },
      { name: 'Walker & Mauney 2010', detail: 'ACM Transactions on Accessible Computing. Polarity for blind and sighted listeners.', url: 'https://doi.org/10.1145/1714458.1714459' },
      { name: 'Smith & Walker 2005', detail: 'Applied Cognitive Psychology. Reference tones and training; basis for the audio legend.', url: 'https://doi.org/10.1002/acp.1146' },
      { name: 'McGookin & Brewster 2004', detail: 'ACM Transactions on Applied Perception. Concurrent sounds; basis for the three-stream limit.', url: 'https://doi.org/10.1145/1024083.1024087' },
      { name: 'Neuhoff 2019', detail: 'ICAD 2019. Separating scientific and artistic aims.', url: 'https://doi.org/10.21785/icad2019.069' },
      { name: 'Sharif et al. 2025', detail: 'Screen-reader users’ views of sonification.', url: 'https://doi.org/10.1145/3744257.3744263' },
      { name: 'Arcand et al. 2024', detail: 'Frontiers in Communication. Audience response to Chandra sonifications.', url: 'https://doi.org/10.3389/fcomm.2024.1288896' },
      { name: 'Zanella et al. 2022', detail: 'Nature Astronomy. Survey of astronomy sonification.', url: 'https://doi.org/10.1038/s41550-022-01721-z' },
      { name: 'Poco, Mayhua & Heer 2018', detail: 'IEEE TVCG. Extracting colour maps from images.', url: 'https://doi.org/10.1109/tvcg.2017.2744320' },
      { name: 'Zhao et al. 2008', detail: 'ACM TOCHI. Sonified maps for blind users.', url: 'https://doi.org/10.1145/1352782.1352786' },
      { name: 'Kim, Kim & Hullman 2024', detail: 'CHI 2024. Erie sonification grammar.', url: 'https://doi.org/10.1145/3613904.3642442' },
      { name: 'Biggs et al. 2022', detail: 'ICAD 2022. Audiom accessible maps.', url: 'https://doi.org/10.21785/icad2022.027' },
      { name: 'Hermann, Hunt & Neuhoff (eds.) 2011, The Sonification Handbook', detail: 'Background reading.', url: 'https://sonification.de/handbook/downloads/' },
    ],
  },
  {
    id: 'ref-nasa',
    title: 'NASA and challenge resources',
    items: [
      { name: 'NASA Scientific Visualization Studio: Earth Information Center gallery', detail: 'Source of every visual in the app.', url: 'https://svs.gsfc.nasa.gov/gallery/earth-information-center/' },
      { name: 'SVS help and API', detail: 'Metadata and media download.', url: 'https://svs.gsfc.nasa.gov/help/' },
      { name: 'NASA images and media guidelines', detail: 'Usage rules followed by the app.', url: 'https://www.nasa.gov/nasa-brand-center/images-and-media/' },
      { name: 'NASA GIBS', detail: 'Researched as a data source; not used in the app.', url: 'https://gibs.earthdata.nasa.gov/' },
      { name: 'GEOS-CF data portal', detail: 'Researched as a data source; not used in the app.', url: 'https://portal.nccs.nasa.gov/datashare/gmao/geos-cf/v2/' },
      { name: 'NASA Sounds of the Sea', detail: 'Prior sonification work.', url: 'https://www.nasa.gov/science-research/earth-science/sounds-of-the-sea/' },
      { name: 'Chandra sonifications', detail: 'Prior sonification work.', url: 'https://chandra.si.edu/sound/' },
      { name: 'Space Apps 2026: The Earth Information Jukebox', detail: 'Challenge statement.', url: 'https://www.spaceappschallenge.org/2026/challenges/the-earth-information-jukebox/' },
    ],
  },
  {
    id: 'ref-prior',
    title: 'Existing sonification tools studied',
    items: [
      { name: 'TwoTone (Datavized)', detail: 'Compared in the research report.', url: 'https://github.com/datavized/twotone' },
      { name: 'Astronify (STScI)', detail: 'Compared in the research report.', url: 'https://github.com/spacetelescope/astronify' },
      { name: 'STRAUSS', detail: 'Compared in the research report.', url: 'https://github.com/james-trayford/strauss' },
      { name: 'Erie', detail: 'Compared in the research report.', url: 'https://github.com/see-mike-out/erie-web' },
      { name: 'Chart2Music', detail: 'Compared in the research report.', url: 'https://github.com/julianna-langston/chart2music' },
      { name: 'MAIDR', detail: 'Compared in the research report.', url: 'https://github.com/xability/maidr' },
      { name: 'PIXELSYNTH', detail: 'Compared in the research report.', url: 'https://github.com/ojack/PIXELSYNTH' },
      { name: 'Sonification Design', detail: 'Compared in the research report.', url: 'https://sonification.design/' },
    ],
  },
  {
    id: 'ref-platform',
    title: 'Web platform documentation and services',
    items: [
      { name: 'MDN Web Docs', detail: 'Web Audio API, OfflineAudioContext, requestVideoFrameCallback, autoplay and CORS guides.', url: 'https://developer.mozilla.org/' },
      { name: 'GitHub Actions and GitHub Pages', detail: 'Continuous integration and hosting.', url: 'https://pages.github.com/' },
    ],
  },
  {
    id: 'ref-ai',
    title: 'AI tools',
    items: [
      { name: 'Claude (Anthropic), used through Claude Code', detail: 'AI coding assistant used to help write code and documents; see docs/AI_USE.md. No AI runs inside the app.', url: 'https://claude.com/claude-code' },
    ],
  },
];
