"""Per-scene configuration for the offline pipeline.

Every number here is explicit so that it can be reviewed. Crop rectangles are in
pixels of the legend image: (left, top, right, bottom), right/bottom exclusive.
"""

SCENES = [
    {
        "id": "ocean",
        "svsId": 3912,
        "media": {"kind": "video", "file": "ecco2_sst_flow.mp4", "flat": True},
        "legend": {
            "file": "sst_ecco2_cbar.png",
            "kind": "continuous",
            # Filled in after inspecting the image: the colour strip only, no labels or border.
            "crop": None,
        },
        "tagline": "Follow warm water poleward",
        "geo": {"projection": "equirectangular", "west": -180, "east": 180, "north": 90, "south": -90},
        "quantity": {"name": "sea surface temperature", "unit": "°C", "vmin": 0, "vmax": 32, "kind": "continuous"},
        "match": {"method": "hue", "minChroma": 10, "maxDistance": 14},
        "masks": [],
        "analysis": {"width": 192, "height": 96},
        "events": None,
        "streams": ["probe", "bed", "motion"],
        "musical": {"scale": "majorPentatonic", "root": 48, "bpm": 72},
        "defaultProbes": [{"x": 0.28, "y": 0.33, "r": 0.03}],
        "provenance": "Rendered from the ECCO2 ocean model by NASA's Scientific Visualization Studio. Values here are estimated from pixel colour.",
        "story": (
            "Warm water is carried poleward along the western edges of ocean basins. "
            "Sharp fronts appear where it meets cold water."
        ),
        "description": (
            "A flat map of the whole Earth, with the oceans filled by thin, moving flow lines that trace "
            "surface currents computed by the ECCO2 ocean model between 25 March 2007 and 3 March 2008. "
            "Each flow line is coloured by sea surface temperature: blue near 0 °C, green between about "
            "10 and 20 °C, yellow near 25 °C and red near 32 °C. Land is shown in grey and carries no data. "
            "Red and yellow water fills the tropics. Along the western edges of the ocean basins, such as "
            "the Gulf Stream off North America and the Kuroshio off Japan, warm water is drawn poleward in "
            "narrow, fast currents and curls into eddies where it meets colder water. Near Antarctica and "
            "in the far North Atlantic the lines turn blue."
        ),
        "credits": ["Greg Shirah", "Horace Mitchell", "Eric Sokolowsky", "Hong Zhang (UCLA)", "Dimitris Menemenlis (JPL)"],
    },
    {
        "id": "lightning",
        "svsId": 5011,
        "media": {"kind": "video", "file": "iss_lightning_sos_yearly_07312023_2048p60.mp4", "flat": True},
        "legend": None,
        "tagline": "Hear storms follow the sun",
        "geo": {"projection": "equirectangular", "west": -180, "east": 180, "north": 90, "south": -90},
        "quantity": {"name": "lightning events", "unit": "", "vmin": 0, "vmax": 1, "kind": "event"},
        "match": {"method": "event", "minChroma": 0, "maxDistance": 0},
        "masks": [],
        "analysis": {"width": 256, "height": 128},
        # Tuned on frames at 30 s and 60 s (256x128). Hue is CIELAB hue in degrees, where the
        # yellow dots sit at 95-106 (the starting values 25-65 assumed HSV hue and matched nothing).
        # Downsampled dots have lightness 16-45 and chroma 20-44; the grey Earth has chroma near 0.
        "events": {"hueMin": 80, "hueMax": 118, "minChroma": 22, "minLightness": 18, "grid": [48, 24], "maxPerFrame": 12},
        "streams": ["events", "bed"],
        "musical": {"scale": "minorPentatonic", "root": 48, "bpm": 84},
        "defaultProbes": [{"x": 0.55, "y": 0.47, "r": 0.04}],
        "provenance": "Lightning detected by the Lightning Imaging Sensor on the ISS, rendered by NASA's Scientific Visualization Studio. Events here are estimated from pixel colour.",
        "story": (
            "Lightning concentrates over tropical land. "
            "Through the year the activity follows the summer hemisphere north and south."
        ),
        "description": (
            "A flat map of the Earth in shades of grey, covering 2017 to July 2023. Yellow and orange dots "
            "show where the Lightning Imaging Sensor on the International Space Station detected lightning. "
            "The picture uses a roving 10-day window, so each dot is part of a 10-day accumulation, not one "
            "flash at that instant. Coverage is limited to the latitudes the space station passes over, "
            "roughly 52 degrees north to 52 degrees south, so the far north and south stay empty. The dots "
            "cluster over tropical land: central Africa, South America, the Maritime Continent and South "
            "Asia. Through each year the band of activity drifts north during the northern summer and south "
            "during the southern summer."
        ),
        "credits": ["Michala Garrison (SSAI)", "Greg Shirah", "Kel Elkins", "Alex Kekesi"],
    },
    {
        "id": "aerosols",
        "svsId": 5669,
        "media": {"kind": "image", "file": "Aerosols_2025-08-19T20_00_00_1920x1080.png", "flat": False},
        "legend": {
            "file": "Aerosols_cbar.png",
            "kind": "categorical",
            # Filled in after inspecting the image: one sample rectangle list per class.
            "classes": None,
        },
        "tagline": "Scan the air from west to east",
        # The 16:9 frame holds the whole globe, stretched: checked by locating Hurricane Erin
        # (rendered at about 73 W, 27 N; NHC position for 19 Aug 2025 is similar) and the
        # Strait of Gibraltar (rendered at about 7 W, 37 N; true 5.6 W, 36 N).
        "geo": {"projection": "equirectangular", "west": -180, "east": 180, "north": 90, "south": -90},
        "quantity": {"name": "aerosol type", "unit": "", "vmin": 0, "vmax": 1, "kind": "categorical"},
        # Tuned with preview_match.py. Bright sea salt in the Southern Ocean is partly read as
        # dust (about 3-4% of pixels south of 45 S); the rendered sea salt is bluer than its swatch.
        "match": {"method": "categorical", "minChroma": 8, "maxDistance": 18},
        "masks": [],
        "analysis": {"width": 192, "height": 108},
        "events": None,
        "streams": ["classes"],
        "musical": {"scale": "dorian", "root": 45, "bpm": 66},
        "defaultProbes": [{"x": 0.42, "y": 0.42, "r": 0.03}],
        "scan": {"duration": 24},
        "provenance": "Modelled by the GEOS Forward Processing system and rendered by NASA's Scientific Visualization Studio. Classes here are estimated from pixel colour.",
        "story": (
            "Sea salt rises over windy oceans, Saharan dust crosses the Atlantic, and smoke drifts from fires in Africa and Spain. "
            "Sulfate marks volcanoes such as Kilauea and Etna, and Hurricane Erin stands out in the sea-salt field."
        ),
        "description": (
            "A flat map of the whole Earth, stretched to a wide 16:9 frame, showing aerosols modelled by NASA's GEOS "
            "Forward Processing system for 19 August 2025 at 20:00 UTC. Four kinds of particle are drawn in "
            "different colours over a dark background. Black carbon and smoke appear red-orange, dust appears "
            "lilac to magenta, sea salt appears grey-teal to blue, and sulfate appears green. Sea salt spreads "
            "over the windy oceans, and Hurricane Erin stands out as a swirl in the sea-salt field in the "
            "western Atlantic. Dust from the Sahara streams west across the Atlantic. Smoke rises from fires "
            "in Africa and Spain. Sulfate appears near volcanoes such as Kilauea and Etna. Values are a model "
            "rendering, not observations at a single point."
        ),
        "credits": ["Joseph V. Ardizzone", "Helen-Nicole Kostis", "Lesley Ott"],
    },
]


def by_id(scene_id):
    for s in SCENES:
        if s["id"] == scene_id:
            return s
    raise KeyError(scene_id)
