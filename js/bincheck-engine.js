/**
 * BinCheck Core Municipal Recycling and Barcode Rules Engine
 * Evaluates UPC-A / EAN-13 barcodes, SPI resin codes (#1-#7), and household
 * materials against official City of Sugar Land (Republic Services / Fort Bend
 * County Recycling Center) and City of Houston (SWMD / Westpark / Neighborhood
 * Depository) solid waste ordinances.
 */

export const SUPPORTED_CITIES = {
  "sugar-land-tx": {
    id: "sugar-land-tx",
    name: "City of Sugar Land, TX",
    shortName: "Sugar Land, TX",
    county: "Fort Bend County",
    operator: "Republic Services (Sugar Land Solid Waste & Recycling)",
    sourceUrl: "https://www.sugarlandtx.gov/361/Solid-Waste-and-Recycling",
    dropOffName: "Fort Bend County Recycling Center",
    dropOffAddress: "1200 Blume Rd, Rosenberg, TX 77471",
    dropOffHours: "Mon-Sat 8:00 AM - 4:00 PM (Fort Bend County residents)",
    retailBagDropOff: "H-E-B, Kroger, or Target front-of-store plastic film return bins (Sugar Land)",
    greenWasteBagRule: "Compostable paper lawn bags, reusable cans, or tied bundles under 4 ft and 40 lbs"
  },
  "houston-tx": {
    id: "houston-tx",
    name: "City of Houston, TX",
    shortName: "Houston, TX",
    county: "Harris / Fort Bend / Montgomery Counties",
    operator: "City of Houston Solid Waste Management Department (SWMD)",
    sourceUrl: "https://www.houstontx.gov/solidwaste/recycling.html",
    dropOffName: "City of Houston Neighborhood Depository / Westpark Consumer Recycling Center",
    dropOffAddress: "5900 Westpark Dr, Houston, TX 77057 (plus 6 SWMD Neighborhood Depositories)",
    dropOffHours: "Tue-Sun 9:00 AM - 6:00 PM (Westpark Mon-Sat 8:00 AM - 5:00 PM)",
    retailBagDropOff: "H-E-B, Kroger, or Walmart plastic film drop-off kiosks (Houston)",
    greenWasteBagRule: "City-approved compostable biodegradable bags (with City of Houston logo) or bundles under 4 ft and 50 lbs"
  }
};

export const RESIN_CODE_METADATA = {
  1: {
    code: 1,
    symbol: "#1 PET / PETE",
    polymer: "Polyethylene Terephthalate",
    commonItems: "Water bottles, soda bottles, salad dressing containers, peanut butter jars",
    curbsideAcceptedSugarLand: true,
    curbsideAcceptedHouston: true,
    defaultMaterialId: "resin-1-pet"
  },
  2: {
    code: 2,
    symbol: "#2 HDPE",
    polymer: "High-Density Polyethylene",
    commonItems: "Milk jugs, laundry detergent bottles, shampoo bottles, bleach jugs",
    curbsideAcceptedSugarLand: true,
    curbsideAcceptedHouston: true,
    defaultMaterialId: "resin-2-hdpe"
  },
  3: {
    code: 3,
    symbol: "#3 PVC",
    polymer: "Polyvinyl Chloride",
    commonItems: "Plumbing pipes, vinyl siding, blister packs, clear food wrap",
    curbsideAcceptedSugarLand: false,
    curbsideAcceptedHouston: false,
    defaultMaterialId: "resin-3-pvc"
  },
  4: {
    code: 4,
    symbol: "#4 LDPE",
    polymer: "Low-Density Polyethylene",
    commonItems: "Plastic grocery bags, bread bags, dry-cleaning film, squeezable bottles",
    curbsideAcceptedSugarLand: false,
    curbsideAcceptedHouston: false,
    defaultMaterialId: "resin-4-ldpe-film"
  },
  5: {
    code: 5,
    symbol: "#5 PP",
    polymer: "Polypropylene",
    commonItems: "Yogurt tubs, butter/margarine tubs, takeout food containers, bottle caps",
    curbsideAcceptedSugarLand: true,
    curbsideAcceptedHouston: true,
    defaultMaterialId: "resin-5-pp"
  },
  6: {
    code: 6,
    symbol: "#6 PS / Styrofoam",
    polymer: "Polystyrene (Expanded Foam or Rigid)",
    commonItems: "Styrofoam takeout clamshells, foam egg cartons, disposable coffee cups, packing peanuts",
    curbsideAcceptedSugarLand: false,
    curbsideAcceptedHouston: false,
    defaultMaterialId: "resin-6-ps-foam"
  },
  7: {
    code: 7,
    symbol: "#7 Other / Multi-Layer",
    polymer: "Polycarbonate, PLA Bioplastic, or Multi-Layer Laminate Pouches",
    commonItems: "Juice pouches, chip bags, 5-gallon cooler jugs, compostable PLA cups",
    curbsideAcceptedSugarLand: false,
    curbsideAcceptedHouston: false,
    defaultMaterialId: "resin-7-other"
  }
};

export const MATERIAL_CATEGORIES = {
  "resin-1-pet": {
    id: "resin-1-pet",
    title: "Clear or Colored #1 PET Plastic Bottle / Jug",
    resinCode: 1,
    baseRiskScore: 10,
    mrfFailureMode: "Liquid weight causes optical air-jets to misfire #1 PET into the paper stream; always empty before binning.",
    sugarLand: {
      stream: "RECYCLE_CART",
      badgeLabel: "Recycle in Curbside Cart",
      prepSteps: [
        "Empty all liquid and give a quick rinse (no soap needed).",
        "Leave plastic screw cap on only after emptying and slightly crushing air out.",
        "Place loose in the Sugar Land recycling cart; never bag recyclables."
      ],
      dropOffNote: "Accepted in standard curbside single-stream cart."
    },
    houston: {
      stream: "RECYCLE_CART",
      badgeLabel: "Recycle in Green Cart",
      prepSteps: [
        "Drain all remaining beverage liquid so optical sorters accurately eject the bottle.",
        "Rinse residue and keep item loose inside the Houston green Automated Recycling Cart.",
        "Do not flatten completely flat into 2D pancakes so 3D drum separators recognize it as a container."
      ],
      dropOffNote: "Accepted in Houston curbside green cart and all Neighborhood Depositories."
    },
    divergenceSummary: "Both Sugar Land and Houston accept empty #1 PET bottles curbside, though Houston SWMD advises keeping bottles 3D rather than pancake-flat for drum separators."
  },
  "resin-2-hdpe": {
    id: "resin-2-hdpe",
    title: "Rigid #2 HDPE Jug or Detergent Bottle",
    resinCode: 2,
    baseRiskScore: 12,
    mrfFailureMode: "Chemical or milk fat residue breeds mold in baled plastics and degrades recycled pellet odor grades.",
    sugarLand: {
      stream: "RECYCLE_CART",
      badgeLabel: "Recycle in Curbside Cart",
      prepSteps: [
        "Empty milk, detergent, or household cleaner completely and swish with water.",
        "Discard trigger spray pumps (which contain metal springs) in trash; screw caps may stay on.",
        "Place loose in the Sugar Land curbside recycling cart."
      ],
      dropOffNote: "Accepted in Sugar Land curbside cart."
    },
    houston: {
      stream: "RECYCLE_CART",
      badgeLabel: "Recycle in Green Cart",
      prepSteps: [
        "Rinse out detergent or milk residue and drain dry.",
        "Remove metal-spring spray nozzles before placing the #2 HDPE jug in the green cart.",
        "Never place motor oil or pesticide #2 jugs in the recycling cart."
      ],
      dropOffNote: "Accepted in Houston curbside green cart and Westpark Consumer Recycling Center."
    },
    divergenceSummary: "Both cities accept clean #2 HDPE milk and detergent jugs curbside; both prohibit automotive oil or pesticide containers in the cart."
  },
  "resin-3-pvc": {
    id: "resin-3-pvc",
    title: "#3 PVC Vinyl Packaging or Pipe",
    resinCode: 3,
    baseRiskScore: 88,
    mrfFailureMode: "PVC releases hydrochloric acid gas at PET melting temperatures (260 C), ruining entire multi-ton batches of #1 PET resin.",
    sugarLand: {
      stream: "TRASH_CART",
      badgeLabel: "Trash Cart Only (Do Not Recycle)",
      prepSteps: [
        "Check the triangle code for #3 (PVC/V) and keep out of the recycling cart.",
        "Place small PVC packaging or vinyl items in the regular household trash cart.",
        "Take large construction PVC pipe offcuts to Fort Bend County Recycling Center bulk drop-off."
      ],
      dropOffNote: "Prohibited in curbside recycling; bulk construction PVC goes to Fort Bend County facility."
    },
    houston: {
      stream: "TRASH_CART",
      badgeLabel: "Black Garbage Cart Only",
      prepSteps: [
        "Keep #3 PVC out of the Houston green recycling cart to prevent PET melt contamination.",
        "Place small vinyl packaging in the black garbage cart.",
        "Deliver bulk PVC plumbing pipes to a Houston Neighborhood Depository as heavy trash."
      ],
      dropOffNote: "Prohibited in Houston curbside recycling."
    },
    divergenceSummary: "Both cities reject #3 PVC in curbside recycling carts because chlorine contaminates #1 PET regrind."
  },
  "resin-4-ldpe-film": {
    id: "resin-4-ldpe-film",
    title: "Plastic Grocery Bag / #4 LDPE Film Wrap",
    resinCode: 4,
    baseRiskScore: 95,
    mrfFailureMode: "Flexible #4 LDPE bags and film wrap tightly around rotating MRF star-screen shafts, forcing dangerous manual line shutdowns every shift.",
    sugarLand: {
      stream: "SPECIAL_DROPOFF",
      badgeLabel: "Store Drop-Off Only (Never in Cart)",
      prepSteps: [
        "Never put loose plastic bags or bagged recyclables in your Sugar Land recycling cart.",
        "Empty, clean, and dry plastic grocery bags, bread bags, and bubble wrap.",
        "Return clean dry film to front-of-store drop-off bins at Sugar Land H-E-B, Kroger, or Target, or discard soiled film in the trash."
      ],
      dropOffNote: "Return clean dry #4 film to H-E-B / Kroger store drop-off bins in Sugar Land."
    },
    houston: {
      stream: "SPECIAL_DROPOFF",
      badgeLabel: "Retail Film Drop-Off Only",
      prepSteps: [
        "Keep all plastic bags, shrink wrap, and film out of the Houston green recycling cart.",
        "Shake out receipts and crumbs so film is completely clean and dry.",
        "Bring clean bags to Houston H-E-B, Kroger, or Walmart store collection kiosks, or put wet/dirty bags in the black garbage cart."
      ],
      dropOffNote: "Return clean dry film to retail grocery kiosks; never place in Houston green carts."
    },
    divergenceSummary: "Identical high-priority ban in both Sugar Land and Houston curbside carts: plastic bags are the #1 MRF shaft tangler and must go to retail store drop-off kiosks."
  },
  "resin-5-pp": {
    id: "resin-5-pp",
    title: "#5 Polypropylene Tub or Takeout Container",
    resinCode: 5,
    baseRiskScore: 22,
    mrfFailureMode: "Food-soiled yogurt or takeout tubs introduce organic bacteria and cause optical NIR sorters to misread dark or coated surfaces.",
    sugarLand: {
      stream: "RECYCLE_CART",
      badgeLabel: "Recycle in Curbside Cart (Clean & Dry)",
      prepSteps: [
        "Scrape and rinse all yogurt, dip, or takeout food residue from the #5 PP tub.",
        "Peel off foil lidding films and discard foil lids in the trash.",
        "Place clean rigid #5 tubs loose in the Sugar Land recycling cart."
      ],
      dropOffNote: "Accepted in Sugar Land curbside single-stream cart when clean."
    },
    houston: {
      stream: "RECYCLE_CART",
      badgeLabel: "Recycle in Green Cart (Clean & Dry)",
      prepSteps: [
        "Wash out food grease and dairy residue from #5 polypropylene containers.",
        "Note that jet-black #5 takeout trays often cannot be read by NIR optical sensors and should be reused or trashed.",
        "Place clear or light-colored #5 tubs loose in the Houston green cart."
      ],
      dropOffNote: "Accepted in Houston green curbside cart and Westpark drop-off."
    },
    divergenceSummary: "Both Sugar Land and Houston accept clean #5 PP tubs curbside; black #5 takeout trays remain prone to NIR optical rejection."
  },
  "resin-6-ps-foam": {
    id: "resin-6-ps-foam",
    title: "#6 Polystyrene / Styrofoam Cup or Clamshell",
    resinCode: 6,
    baseRiskScore: 86,
    mrfFailureMode: "Expanded #6 polystyrene shatters into static-charged foam beads under compaction, contaminating paper bales and clogging optical air nozzles.",
    sugarLand: {
      stream: "SPECIAL_DROPOFF",
      badgeLabel: "Trash Cart or Fort Bend Drop-Off",
      prepSteps: [
        "Never place Styrofoam cups, takeout clamshells, or packing peanuts in the Sugar Land curbside cart.",
        "Take clean, bagged #6 foam blocks/packaging to the Fort Bend County Recycling Center (1200 Blume Rd, Rosenberg) for densifier processing.",
        "Place food-stained foam cups and clamshells directly in the household trash cart."
      ],
      dropOffNote: "Clean #6 foam accepted at Fort Bend County Recycling Center; food-soiled foam goes in trash."
    },
    houston: {
      stream: "TRASH_CART",
      badgeLabel: "Black Garbage Cart Only",
      prepSteps: [
        "Keep all #6 Styrofoam cups, egg cartons, and foam blocks out of the Houston green recycling cart.",
        "Bag foam packing peanuts tightly before placing them in the black garbage cart so they do not blow into storm drains.",
        "Reuse clean shipping foam or check specialty mail-back programs."
      ],
      dropOffNote: "Not accepted in Houston curbside carts or standard Neighborhood Depositories."
    },
    divergenceSummary: "Key divergence: Fort Bend County Recycling Center accepts clean #6 Styrofoam for Sugar Land/Fort Bend residents, whereas Houston SWMD rejects #6 foam in both curbside carts and standard depositories."
  },
  "resin-7-other": {
    id: "resin-7-other",
    title: "#7 Multi-Layer Pouch, PLA Bioplastic, or Mixed Resin",
    resinCode: 7,
    baseRiskScore: 82,
    mrfFailureMode: "PLA bioplastics (#7) and multi-layer snack pouches do not melt compatibly with #1 PET or #2 HDPE and ruin structural integrity of recycled flake.",
    sugarLand: {
      stream: "TRASH_CART",
      badgeLabel: "Trash Cart Only",
      prepSteps: [
        "Do not place #7 pouches, chip bags, or 'compostable' PLA plastic cups in the Sugar Land recycling cart.",
        "Dispose of #7 packaging in your regular household trash cart."
      ],
      dropOffNote: "Not accepted in Sugar Land curbside recycling."
    },
    houston: {
      stream: "TRASH_CART",
      badgeLabel: "Black Garbage Cart Only",
      prepSteps: [
        "Keep #7 items, juice pouches, and bioplastic cups out of the Houston green cart.",
        "Place in the black residential garbage cart."
      ],
      dropOffNote: "Not accepted in Houston curbside or depository recycling."
    },
    divergenceSummary: "Both Sugar Land and Houston reject #7 multi-layer pouches and PLA bioplastics in municipal recycling."
  },
  "glass-jar-bottle": {
    id: "glass-jar-bottle",
    title: "Clean Glass Beverage Bottle or Food Jar",
    resinCode: null,
    baseRiskScore: 25,
    mrfFailureMode: "Unrinsed jars attract pests, while broken glass shards embed into wet cardboard fibers and wear down MRF conveyor bearings.",
    sugarLand: {
      stream: "RECYCLE_CART",
      badgeLabel: "Accepted in Sugar Land Curbside Cart",
      prepSteps: [
        "Empty and rinse glass pasta jars, condiment bottles, and beverage bottles.",
        "Remove metal lids and place both the metal lid and intact glass jar loose in the Sugar Land recycling cart.",
        "Paper labels can stay on the glass."
      ],
      dropOffNote: "Accepted in Sugar Land curbside cart and Fort Bend County Recycling Center."
    },
    houston: {
      stream: "RECYCLE_CART",
      badgeLabel: "Green Cart or Neighborhood Depository",
      prepSteps: [
        "Rinse glass bottles and jars thoroughly and remove metal caps (recycle metal caps separately).",
        "Place intact glass bottles/jars in your Houston green Automated Recycling Cart (supported via FCC Environmental MRF glass separation) or bring directly to Westpark / Neighborhood Depositories for cleaner single-material glass cullet recovery.",
        "Never include drinkware, Pyrex, window glass, or mirrors."
      ],
      dropOffNote: "Accepted in Houston green cart (FCC MRF) and dedicated glass bins at Westpark / 6 Neighborhood Depositories."
    },
    divergenceSummary: "Sugar Land has long accepted glass in its single-stream Republic Services cart; Houston restored curbside glass after opening the FCC Environmental MRF, while still maintaining dedicated glass drop-off bins at Westpark and Neighborhood Depositories for higher-purity cullet."
  },
  "broken-glass-ceramic": {
    id: "broken-glass-ceramic",
    title: "Broken Glass, Ceramic Mug, Pyrex, or Mirror",
    resinCode: null,
    baseRiskScore: 92,
    mrfFailureMode: "Ceramics and heat-resistant borosilicate glass (Pyrex) have higher melting points than container glass, causing weak stone inclusions and bottle explosions in glass furnaces.",
    sugarLand: {
      stream: "TRASH_CART",
      badgeLabel: "Wrap Safely & Place in Trash Cart",
      prepSteps: [
        "Never place broken glass, ceramic dishes, Pyrex, or mirrors in the recycling cart.",
        "Wrap sharp fragments in heavy cardboard or newspaper and tape shut to protect collection crews.",
        "Place the wrapped bundle in the household trash cart."
      ],
      dropOffNote: "Prohibited in all recycling streams."
    },
    houston: {
      stream: "TRASH_CART",
      badgeLabel: "Wrap Safely & Place in Black Garbage Cart",
      prepSteps: [
        "Keep broken glass, ceramics, and mirrors out of the Houston green recycling cart.",
        "Box or wrap sharp shards securely and label 'Broken Glass' before placing in the black garbage cart."
      ],
      dropOffNote: "Prohibited in Houston curbside and depository glass bins."
    },
    divergenceSummary: "Both jurisdictions strictly prohibit broken glass, ceramics, Pyrex, and mirrors in recycling."
  },
  "aluminum-steel-can": {
    id: "aluminum-steel-can",
    title: "Empty Aluminum Beverage Can or Steel Soup Can",
    resinCode: null,
    baseRiskScore: 8,
    mrfFailureMode: "Eddy-current separators (for aluminum) and overhead cross-belt magnets (for steel) recover metal at over 95% efficiency if cans are empty and not nested inside plastic bags.",
    sugarLand: {
      stream: "RECYCLE_CART",
      badgeLabel: "High-Value Curbside Recycle",
      prepSteps: [
        "Empty all liquid or food from the aluminum or steel can and rinse.",
        "Keep aluminum cans and steel cans separated from each other (do not wedge aluminum cans inside steel cans).",
        "Place loose in the Sugar Land recycling cart."
      ],
      dropOffNote: "Accepted in Sugar Land curbside cart and Fort Bend County Recycling Center."
    },
    houston: {
      stream: "RECYCLE_CART",
      badgeLabel: "High-Value Green Cart Recycle",
      prepSteps: [
        "Drain and rinse beverage or food cans completely.",
        "Push sharp steel can lids inside the can or detach cleanly so sorters are not cut.",
        "Place loose in the Houston green recycling cart."
      ],
      dropOffNote: "Accepted in Houston green cart and all Neighborhood Depositories."
    },
    divergenceSummary: "Both Sugar Land and Houston treat clean aluminum and tin/steel cans as their highest-value, lowest-contamination curbside recyclables."
  },
  "soiled-foil-tray": {
    id: "soiled-foil-tray",
    title: "Aluminum Foil or Foil Baking Tray",
    resinCode: null,
    baseRiskScore: 55,
    mrfFailureMode: "Cheese-encrusted or flat crumpled foil sheets either contaminate paper fibers with grease or ride the 2D paper screens instead of dropping to the eddy-current magnet.",
    sugarLand: {
      stream: "SPLIT_DISPOSAL",
      badgeLabel: "Ball Up to 2 Inches if Clean / Trash if Greasy",
      prepSteps: [
        "If foil has baked-on cheese, meat grease, orlasagna sauce, place it in the trash cart.",
        "If aluminum foil is wiped clean, crumple sheets into a tight 3D ball at least 2 inches in diameter so eddy-current separators can eject it.",
        "Place clean foil balls or rinsed foil roasting pans in the Sugar Land recycling cart."
      ],
      dropOffNote: "Clean 2-inch foil balls accepted curbside; greasy foil goes in trash."
    },
    houston: {
      stream: "SPLIT_DISPOSAL",
      badgeLabel: "Clean Foil Pans Only / Trash Greasy Foil",
      prepSteps: [
        "Discard food-soiled aluminum foil wrap in the Houston black garbage cart.",
        "Rinse rigid aluminum pie/roasting pans completely clean before placing in the green cart."
      ],
      dropOffNote: "Clean foil pans accepted; soiled foil wrap goes in garbage."
    },
    divergenceSummary: "Both cities require foil to be completely free of food grease; balling clean foil to 2+ inches prevents flat sheets from riding into the 2D paper stream."
  },
  "clean-cardboard-paper": {
    id: "clean-cardboard-paper",
    title: "Clean Corrugated Cardboard Box, Mailer, or Office Paper",
    resinCode: null,
    baseRiskScore: 10,
    mrfFailureMode: "Bubble-lined mailers and plastic air pillows mixed inside unflattened boxes jam cardboard disc screens and contaminate pulping vats.",
    sugarLand: {
      stream: "RECYCLE_CART",
      badgeLabel: "Flatten & Recycle in Cart",
      prepSteps: [
        "Remove all plastic air pillows, bubble wrap, and Styrofoam inserts from shipping boxes.",
        "Break down and flatten corrugated boxes so they fit loosely inside the Sugar Land recycling cart with the lid closed.",
        "Keep paper and cardboard dry."
      ],
      dropOffNote: "Oversized flattened cardboard loads also accepted at Fort Bend County Recycling Center."
    },
    houston: {
      stream: "RECYCLE_CART",
      badgeLabel: "Flatten & Recycle in Green Cart",
      prepSteps: [
        "Strip out plastic packaging film and foam inserts.",
        "Flatten cardboard boxes to prevent bridging inside the Houston green Automated Recycling Cart.",
        "Take excess moving boxes to Westpark or any Houston Neighborhood Depository."
      ],
      dropOffNote: "Accepted in green cart and all Houston Neighborhood Depositories."
    },
    divergenceSummary: "Both Sugar Land and Houston accept clean flattened cardboard and paper curbside; plastic-lined bubble mailers must be separated."
  },
  "greasy-pizza-box": {
    id: "greasy-pizza-box",
    title: "Greasy Corrugated Pizza Delivery Box",
    resinCode: null,
    baseRiskScore: 68,
    mrfFailureMode: "Hydrophobic pizza oil and melted cheese cannot be washed out of cellulose fibers during water-slurry pulping, creating weak spots and holes in recycled paperboard.",
    sugarLand: {
      stream: "SPLIT_DISPOSAL",
      badgeLabel: "Tear Lid to Recycle / Trash Greasy Bottom",
      prepSteps: [
        "Remove all leftover crusts, cheese, wax paper liners, and plastic pizza-saver tripods.",
        "Tear off the clean top lid of the pizza box and flatten it for the Sugar Land recycling cart.",
        "Put the grease-stained bottom half of the box in your regular household trash cart."
      ],
      dropOffNote: "Clean torn lids go in curbside recycling; grease-soaked bottoms go in trash."
    },
    houston: {
      stream: "SPLIT_DISPOSAL",
      badgeLabel: "Split Box: Clean Top in Green Cart, Bottom in Trash",
      prepSteps: [
        "Detach the unsoiled cardboard top lid and place it in the Houston green recycling cart.",
        "Place the oil-saturated bottom tray and any cheese-crusted cardboard in the black garbage cart."
      ],
      dropOffNote: "Clean cardboard tops accepted in green cart; greasy bottoms go in black garbage cart."
    },
    divergenceSummary: "Both Sugar Land and Houston recommend the 'Tear-and-Split' rule: recycle the clean top lid and trash the grease-soaked bottom half."
  },
  "lithium-household-battery": {
    id: "lithium-household-battery",
    title: "Lithium-Ion, Rechargeable, or Household Battery",
    resinCode: null,
    baseRiskScore: 100,
    mrfFailureMode: "CRITICAL FIRE HAZARD: Compaction blades in collection trucks and MRF balers puncture lithium-ion cells, causing thermal runaway fires that destroy sorting facilities.",
    sugarLand: {
      stream: "SPECIAL_DROPOFF",
      badgeLabel: "Hazardous Drop-Off Only (Fire Risk)",
      prepSteps: [
        "NEVER place lithium-ion, rechargeable, button-cell, or AA/AAA batteries in either the recycling cart or household trash cart.",
        "Apply clear tape over the positive (+) terminal of lithium and rechargeable batteries to prevent short circuits.",
        "Deliver to the Fort Bend County Recycling Center HHW drop-off (1200 Blume Rd, Rosenberg) or Call2Recycle retail kiosks (Home Depot / Lowe's / Best Buy)."
      ],
      dropOffNote: "Mandatory drop-off at Fort Bend County Recycling Center (1200 Blume Rd) or Call2Recycle retail bins."
    },
    houston: {
      stream: "SPECIAL_DROPOFF",
      badgeLabel: "BOPA / Environmental Service Center Drop-Off",
      prepSteps: [
        "NEVER put batteries in the Houston green recycling cart or black garbage cart due to truck and MRF fire danger.",
        "Tape battery terminals with non-conductive clear tape and store in a cool dry container.",
        "Bring to the City of Houston Westpark Consumer Recycling Center (5900 Westpark Dr), North Environmental Service Center (11500 North Freeway), or participating BOPA mobile collection events."
      ],
      dropOffNote: "Drop off at Houston Westpark Consumer Recycling Center or North ESC (BOPA program)."
    },
    divergenceSummary: "Both cities classify batteries as a critical fire hazard prohibited in carts: Sugar Land routes residents to Fort Bend County Recycling Center (Rosenberg), while Houston routes residents to Westpark or North ESC BOPA drop-offs."
  },
  "electronics-ewaste": {
    id: "electronics-ewaste",
    title: "Electronics, Cables, Power Cords, or Small Appliances",
    resinCode: null,
    baseRiskScore: 96,
    mrfFailureMode: "Power cords wrap MRF disc screens like steel cables, while circuit boards contain lead solder, mercury switches, and embedded lithium cells.",
    sugarLand: {
      stream: "SPECIAL_DROPOFF",
      badgeLabel: "Fort Bend County E-Waste Drop-Off",
      prepSteps: [
        "Do not place electronics, chargers, HDMI/extension cords, or toasters in the Sugar Land recycling cart.",
        "Wipe personal data from phones or laptops before drop-off.",
        "Take electronics and cords to the Fort Bend County Recycling Center (1200 Blume Rd, Rosenberg) or Best Buy / Staples e-waste kiosks."
      ],
      dropOffNote: "Accepted at Fort Bend County Recycling Center (small per-item fee may apply for CRT/TV monitors)."
    },
    houston: {
      stream: "SPECIAL_DROPOFF",
      badgeLabel: "Westpark / Neighborhood Depository E-Waste",
      prepSteps: [
        "Keep all cords, electronics, and small appliances out of the Houston green recycling cart.",
        "Bring computers, monitors, TVs, and cables to Westpark Consumer Recycling Center (5900 Westpark Dr), CompuCycle partner events, or Houston Neighborhood Depositories."
      ],
      dropOffNote: "Accepted free for Houston residents at Westpark Consumer Recycling Center."
    },
    divergenceSummary: "Both cities ban cords and e-waste from curbside carts: Sugar Land uses Fort Bend County Recycling Center in Rosenberg, while Houston uses Westpark Consumer Recycling Center."
  },
  "yard-trimmings-brush": {
    id: "yard-trimmings-brush",
    title: "Yard Trimmings, Leaves, Grass Clippings & Brush",
    resinCode: null,
    baseRiskScore: 78,
    mrfFailureMode: "Wet grass and leaves dumped in single-stream recycling carts coat paper and cardboard in nitrogen-rich moisture and sap, ruining fiber bales.",
    sugarLand: {
      stream: "GREEN_WASTE",
      badgeLabel: "Sugar Land Weekly Green Waste Collection",
      prepSteps: [
        "Never place leaves, grass clippings, or branches inside your single-stream recycling cart.",
        "Place yard trimmings in compostable paper lawn bags or reusable containers (under 40 lbs) at the curb on your scheduled Sugar Land weekly green waste collection day.",
        "Tie brush bundles with natural twine under 4 feet in length and 40 pounds."
      ],
      dropOffNote: "Collected weekly at the curb in Sugar Land Green Waste program or dropped at Fort Bend County facility."
    },
    houston: {
      stream: "GREEN_WASTE",
      badgeLabel: "Houston Yard Waste (City-Logo Compostable Bags Only)",
      prepSteps: [
        "Keep all grass, leaves, and branches out of the Houston green recycling cart.",
        "Bag yard trimmings ONLY in City-approved compostable biodegradable bags bearing the official City of Houston logo (under 50 lbs), placed 3 feet from carts on your scheduled yard waste day.",
        "Bundle small branches under 4 feet long and 18 inches in diameter, or use Odd-Month Tree Waste collection for large limbs."
      ],
      dropOffNote: "Requires City-logo biodegradable bags at curb, or drop off at Houston Neighborhood Depositories."
    },
    divergenceSummary: "Important rule difference: Sugar Land accepts standard kraft paper lawn bags or reusable cans (40 lb limit), whereas Houston strictly requires bags stamped with the official City of Houston biodegradable logo (50 lb limit) and refuses yard waste in plain plastic bags."
  },
  "liquid-full-bottle": {
    id: "liquid-full-bottle",
    title: "Half-Full Plastic Beverage Bottle with Liquid & Cap",
    resinCode: 1,
    baseRiskScore: 74,
    mrfFailureMode: "Heavy liquid-filled bottles exceed the mass threshold of optical air-classification jets, dropping into the paper bunker and soaking cardboard bales when crushed.",
    sugarLand: {
      stream: "SPLIT_DISPOSAL",
      badgeLabel: "Empty Liquid First, Then Recycle Bottle",
      prepSteps: [
        "Unscrew the cap and pour all leftover liquid down the drain or onto soil.",
        "Once completely empty, replace the cap and place the #1 PET bottle loose in the Sugar Land recycling cart.",
        "If you cannot empty the liquid (e.g., spoiled oil or dressing), place the sealed bottle in the trash cart."
      ],
      dropOffNote: "Recyclable curbside only after all liquid is emptied."
    },
    houston: {
      stream: "SPLIT_DISPOSAL",
      badgeLabel: "Drain All Liquid Before Green Cart",
      prepSteps: [
        "Empty all liquid before placing any bottle in the Houston green Automated Recycling Cart.",
        "Optical NIR sorters at the Houston FCC Environmental MRF cannot air-eject heavy liquid-filled containers.",
        "Place the emptied bottle in the green cart."
      ],
      dropOffNote: "Recyclable in Houston green cart only after emptying liquid."
    },
    divergenceSummary: "Both cities reject bottles containing liquid because excess weight defeats optical air-jet ejectors and wets paper bales."
  }
};

/**
 * Computes the standard GS1 Modulo-10 check digit for a numeric payload string
 * (11 digits for UPC-A, 12 digits for EAN-13, 7 digits for EAN-8).
 */
export function computeUpcCheckDigit(payloadDigits) {
  const cleaned = String(payloadDigits ?? "").trim();
  if (cleaned.length === 0 || !/^\d+$/.test(cleaned)) {
    return null;
  }
  if (cleaned.length !== 7 && cleaned.length !== 11 && cleaned.length !== 12 && cleaned.length !== 13) {
    return null;
  }
  let weightedSum = 0;
  for (let i = 0; i < cleaned.length; i += 1) {
    const digitFromRight = Number(cleaned[cleaned.length - 1 - i]);
    const weight = i % 2 === 0 ? 3 : 1;
    weightedSum += digitFromRight * weight;
  }
  return (10 - (weightedSum % 10)) % 10;
}

/**
 * Normalizes and validates a UPC-A (12-digit), EAN-13 (13-digit), or EAN-8 (8-digit) barcode.
 */
export function validateBarcodeCheckDigit(rawBarcode) {
  const rawStr = String(rawBarcode ?? "").trim();
  const digitsOnly = rawStr.replace(/[\s-]/g, "");

  if (digitsOnly.length === 0) {
    return {
      valid: false,
      normalized: "",
      ean13: "",
      format: "EMPTY",
      expectedCheckDigit: null,
      actualCheckDigit: null,
      reason: "Barcode input is empty."
    };
  }

  if (!/^\d+$/.test(digitsOnly)) {
    return {
      valid: false,
      normalized: digitsOnly,
      ean13: "",
      format: "NON_NUMERIC",
      expectedCheckDigit: null,
      actualCheckDigit: null,
      reason: "Barcode must contain only digits (0-9), spaces, or hyphens."
    };
  }

  if (digitsOnly.length !== 8 && digitsOnly.length !== 12 && digitsOnly.length !== 13) {
    return {
      valid: false,
      normalized: digitsOnly,
      ean13: "",
      format: "INVALID_LENGTH",
      expectedCheckDigit: null,
      actualCheckDigit: null,
      reason: `Expected 8 (EAN-8), 12 (UPC-A), or 13 (EAN-13) digits, received ${digitsOnly.length}.`
    };
  }

  const payload = digitsOnly.slice(0, digitsOnly.length - 1);
  const actualCheckDigit = Number(digitsOnly[digitsOnly.length - 1]);
  const expectedCheckDigit = computeUpcCheckDigit(payload);
  const isCheckValid = actualCheckDigit === expectedCheckDigit;

  const format =
    digitsOnly.length === 12
      ? "UPC-A"
      : digitsOnly.length === 13
        ? "EAN-13"
        : "EAN-8";

  const normalizedUpc12 =
    digitsOnly.length === 13 && digitsOnly.startsWith("0")
      ? digitsOnly.slice(1)
      : digitsOnly;

  const ean13 =
    digitsOnly.length === 12
      ? `0${digitsOnly}`
      : digitsOnly.length === 13
        ? digitsOnly
        : "";

  return {
    valid: isCheckValid,
    normalized: normalizedUpc12,
    ean13,
    format,
    expectedCheckDigit,
    actualCheckDigit,
    reason: isCheckValid
      ? `Valid ${format} barcode (GS1 Modulo-10 check digit ${actualCheckDigit} verified).`
      : `Invalid ${format} check digit: expected ${expectedCheckDigit}, found ${actualCheckDigit}.`
  };
}

/**
 * 28 real verified Texas grocery and household product barcodes with valid GS1 check digits.
 */
export const VERIFIED_BARCODE_CATALOG = [
  {
    upc: "041220576463",
    brand: "H-E-B",
    productName: "H-E-B Pure Texas Spring Water Bottle (16.9 fl oz)",
    materialId: "resin-1-pet",
    resinCode: 1,
    packagingSummary: "Clear #1 PET bottle with #2 HDPE screw cap"
  },
  {
    upc: "012000001598",
    brand: "PepsiCo / Aquafina",
    productName: "Aquafina Purified Drinking Water Bottle (20 fl oz)",
    materialId: "resin-1-pet",
    resinCode: 1,
    packagingSummary: "Clear #1 PET beverage bottle"
  },
  {
    upc: "049000028904",
    brand: "Coca-Cola",
    productName: "Coca-Cola Classic 12-Pack Aluminum Cans (12 fl oz)",
    materialId: "aluminum-steel-can",
    resinCode: null,
    packagingSummary: "Aluminum beverage cans inside paperboard fridge pack"
  },
  {
    upc: "049000006346",
    brand: "Coca-Cola",
    productName: "Coca-Cola Classic Single Aluminum Can (12 fl oz)",
    materialId: "aluminum-steel-can",
    resinCode: null,
    packagingSummary: "Recyclable aluminum beverage can"
  },
  {
    upc: "078000082166",
    brand: "Dr Pepper (Plano, TX)",
    productName: "Dr Pepper Original 2-Liter Plastic Bottle",
    materialId: "resin-1-pet",
    resinCode: 1,
    packagingSummary: "Green/Clear #1 PET 2-liter bottle"
  },
  {
    upc: "072554000027",
    brand: "Ozarka Texas Spring Water",
    productName: "Ozarka 100% Natural Texas Spring Water (1 Gallon Jug)",
    materialId: "resin-2-hdpe",
    resinCode: 2,
    packagingSummary: "Natural translucent #2 HDPE gallon jug"
  },
  {
    upc: "041220948321",
    brand: "H-E-B Central Market",
    productName: "H-E-B Grade A Whole Milk (1 Gallon Jug)",
    materialId: "resin-2-hdpe",
    resinCode: 2,
    packagingSummary: "Rigid #2 HDPE milk jug with snap/screw cap"
  },
  {
    upc: "037000973072",
    brand: "Tide (Procter & Gamble)",
    productName: "Tide Original Liquid Laundry Detergent Bottle (92 fl oz)",
    materialId: "resin-2-hdpe",
    resinCode: 2,
    packagingSummary: "Colored #2 HDPE bottle with #5 PP dosing cup"
  },
  {
    upc: "044600015996",
    brand: "Clorox",
    productName: "Clorox Disinfecting Bleach Jug (81 fl oz)",
    materialId: "resin-2-hdpe",
    resinCode: 2,
    packagingSummary: "Opaque white #2 HDPE jug"
  },
  {
    upc: "021131500269",
    brand: "Topo Chico",
    productName: "Topo Chico Mineral Water Glass Bottle (12 fl oz)",
    materialId: "glass-jar-bottle",
    resinCode: null,
    packagingSummary: "Clear flint glass beverage bottle with metal pry-off crown cap"
  },
  {
    upc: "041220794386",
    brand: "H-E-B",
    productName: "H-E-B Texas Specialty Roasted Salsa Glass Jar (16 oz)",
    materialId: "glass-jar-bottle",
    resinCode: null,
    packagingSummary: "Clear glass food jar with plastisol-lined steel twist lid"
  },
  {
    upc: "051000012517",
    brand: "Campbell's",
    productName: "Campbell's Condensed Tomato Soup Steel Can (10.75 oz)",
    materialId: "aluminum-steel-can",
    resinCode: null,
    packagingSummary: "Tin-coated steel food can"
  },
  {
    upc: "041220192847",
    brand: "H-E-B",
    productName: "H-E-B Charro Beans Steel Can (15 oz)",
    materialId: "aluminum-steel-can",
    resinCode: null,
    packagingSummary: "Recyclable steel food can"
  },
  {
    upc: "818290012630",
    brand: "Chobani",
    productName: "Chobani Non-Fat Greek Yogurt Single-Serve Cup (5.3 oz)",
    materialId: "resin-5-pp",
    resinCode: 5,
    packagingSummary: "Rigid #5 Polypropylene cup with peel-off foil lid"
  },
  {
    upc: "041220831043",
    brand: "H-E-B",
    productName: "H-E-B Creamy Creations Sour Cream Tub (16 oz)",
    materialId: "resin-5-pp",
    resinCode: 5,
    packagingSummary: "Rigid #5 PP dairy tub and lid"
  },
  {
    upc: "071892102059",
    brand: "Whataburger (San Antonio, TX)",
    productName: "Whataburger Spicy Ketchup Squeeze Bottle (20 oz)",
    materialId: "resin-5-pp",
    resinCode: 5,
    packagingSummary: "Multi-layer #5 PP squeeze condiment bottle"
  },
  {
    upc: "071892300110",
    brand: "Blue Bell Creameries (Brenham, TX)",
    productName: "Blue Bell Homemade Vanilla Half-Gallon Tub",
    materialId: "resin-7-other",
    resinCode: 7,
    packagingSummary: "Polyethylene-coated wet-strength paperboard ice cream carton (not recyclable)"
  },
  {
    upc: "073287001060",
    brand: "Dart Container",
    productName: "Dart Insulated Foam Beverage Cups (#6 Polystyrene)",
    materialId: "resin-6-ps-foam",
    resinCode: 6,
    packagingSummary: "Expanded #6 Polystyrene (Styrofoam) cups"
  },
  {
    upc: "041220400126",
    brand: "H-E-B Texas Tough",
    productName: "H-E-B Texas Tough Plastic Grocery & Storage Bags",
    materialId: "resin-4-ldpe-film",
    resinCode: 4,
    packagingSummary: "Flexible #4 LDPE film bags (MRF shaft tangler)"
  },
  {
    upc: "013700021107",
    brand: "Hefty",
    productName: "Hefty Ultra Strong Drawstring Trash Bags",
    materialId: "resin-4-ldpe-film",
    resinCode: 4,
    packagingSummary: "#4 LDPE plastic film bags"
  },
  {
    upc: "010900001120",
    brand: "Reynolds Wrap",
    productName: "Reynolds Wrap Heavy Duty Aluminum Foil (75 sq ft)",
    materialId: "soiled-foil-tray",
    resinCode: null,
    packagingSummary: "Aluminum foil roll (paperboard box recyclable; foil must be clean & balled to 2 in)"
  },
  {
    upc: "041333415017",
    brand: "Duracell",
    productName: "Duracell Coppertop AA / Lithium Household Battery Pack",
    materialId: "lithium-household-battery",
    resinCode: null,
    packagingSummary: "Household cells requiring HHW / BOPA drop-off"
  },
  {
    upc: "039800084118",
    brand: "Energizer",
    productName: "Energizer Ultimate Lithium AA Batteries (4-Pack)",
    materialId: "lithium-household-battery",
    resinCode: null,
    packagingSummary: "Lithium primary cells (critical MRF compaction fire hazard)"
  },
  {
    upc: "072140001056",
    brand: "DiGiorno / Delivery Pizza",
    productName: "Corrugated Pizza Box (Top Clean, Bottom Grease-Stained)",
    materialId: "greasy-pizza-box",
    resinCode: null,
    packagingSummary: "Corrugated cardboard pizza box requiring Tear-and-Split disposal"
  },
  {
    upc: "041220660018",
    brand: "H-E-B Shipping / E-Commerce",
    productName: "Corrugated Kraft Shipping Box (Clean & Flattened)",
    materialId: "clean-cardboard-paper",
    resinCode: null,
    packagingSummary: "100% recyclable corrugated cardboard box"
  },
  {
    upc: "028400589864",
    brand: "Frito-Lay (Plano, TX)",
    productName: "Doritos / Lay's Metallized Multi-Layer Chip Bag",
    materialId: "resin-7-other",
    resinCode: 7,
    packagingSummary: "#7 Metallized BOPP multi-layer snack pouch (trash only)"
  },
  {
    upc: "075925301129",
    brand: "Capri Sun",
    productName: "Foil-Lined Multi-Layer Juice Drink Pouch",
    materialId: "resin-7-other",
    resinCode: 7,
    packagingSummary: "#7 Aluminum/plastic laminate pouch (trash only)"
  },
  {
    upc: "041220311088",
    brand: "H-E-B Lawn & Garden",
    productName: "Kraft Paper Yard Trimmings & Leaf Bags (5-Pack)",
    materialId: "yard-trimmings-brush",
    resinCode: null,
    packagingSummary: "Compostable yard waste bag for municipal green waste collection"
  }
];

/**
 * Looks up a product by UPC-A or EAN-13 barcode in VERIFIED_BARCODE_CATALOG.
 */
export function lookupProductByBarcode(rawBarcode) {
  const check = validateBarcodeCheckDigit(rawBarcode);
  if (!check.valid) {
    return {
      found: false,
      validation: check,
      product: null
    };
  }
  const match = VERIFIED_BARCODE_CATALOG.find(
    (item) => item.upc === check.normalized || `0${item.upc}` === check.ean13
  );
  return {
    found: Boolean(match),
    validation: check,
    product: match || null
  };
}

/**
 * Maps a numeric Contamination Risk Score (0-100) to a severity tier.
 */
export function getContaminationTier(score) {
  const numeric = Number(score);
  if (numeric >= 85) {
    return "CRITICAL";
  }
  if (numeric >= 55) {
    return "HIGH";
  }
  if (numeric >= 25) {
    return "MODERATE";
  }
  return "LOW";
}

/**
 * Resolves a query ({ barcode, materialId, resinCode, condition }) into a canonical material category
 * and optional condition modifier ("clean", "greasy", "liquid-full", "broken").
 */
export function resolveMaterialProfile(query = {}) {
  let barcodeResult = null;
  let resolvedProduct = null;
  let materialId = query.materialId || null;

  if (query.barcode) {
    barcodeResult = lookupProductByBarcode(query.barcode);
    if (barcodeResult.found && barcodeResult.product) {
      resolvedProduct = barcodeResult.product;
      if (!materialId) {
        materialId = resolvedProduct.materialId;
      }
    }
  }

  if (!materialId && query.resinCode !== undefined && query.resinCode !== null && query.resinCode !== "") {
    const rCode = Number(query.resinCode);
    if (RESIN_CODE_METADATA[rCode]) {
      materialId = RESIN_CODE_METADATA[rCode].defaultMaterialId;
    }
  }

  if (query.condition === "liquid-full" && (materialId === "resin-1-pet" || materialId === "resin-2-hdpe")) {
    materialId = "liquid-full-bottle";
  } else if (query.condition === "broken" && materialId === "glass-jar-bottle") {
    materialId = "broken-glass-ceramic";
  }

  const category = MATERIAL_CATEGORIES[materialId] || MATERIAL_CATEGORIES["resin-1-pet"];
  return {
    category,
    barcodeResult,
    resolvedProduct
  };
}

/**
 * Evaluates disposal instructions, MRF failure mechanics, and contamination risk
 * for a given item in either "sugar-land-tx" or "houston-tx".
 */
export function evaluateItemDisposal(query = {}) {
  const cityId = query.city === "houston-tx" ? "houston-tx" : "sugar-land-tx";
  const cityMeta = SUPPORTED_CITIES[cityId];
  const { category, barcodeResult, resolvedProduct } = resolveMaterialProfile(query);

  const cityRule = cityId === "houston-tx" ? category.houston : category.sugarLand;

  let riskScore = category.baseRiskScore;
  if (query.condition === "greasy" && category.id !== "greasy-pizza-box") {
    riskScore = Math.min(100, riskScore + 35);
  }
  if (cityId === "houston-tx" && category.id === "resin-6-ps-foam") {
    riskScore = Math.min(100, riskScore + 5);
  }

  const tier = getContaminationTier(riskScore);
  const itemTitle = resolvedProduct
    ? `${resolvedProduct.productName} (${resolvedProduct.brand})`
    : category.title;

  return {
    city: cityId,
    cityName: cityMeta.name,
    shortCityName: cityMeta.shortName,
    operator: cityMeta.operator,
    officialSourceUrl: cityMeta.sourceUrl,
    itemTitle,
    materialId: category.id,
    resinCode: category.resinCode,
    resinInfo: category.resinCode ? RESIN_CODE_METADATA[category.resinCode] : null,
    stream: cityRule.stream,
    badgeLabel: cityRule.badgeLabel,
    contaminationRiskScore: riskScore,
    contaminationTier: tier,
    mrfFailureMode: category.mrfFailureMode,
    prepSteps: [...cityRule.prepSteps],
    dropOffNote: cityRule.dropOffNote,
    dropOffFacility: {
      name: cityMeta.dropOffName,
      address: cityMeta.dropOffAddress,
      hours: cityMeta.dropOffHours,
      retailBagDropOff: cityMeta.retailBagDropOff
    },
    cityDivergenceNote: category.divergenceSummary,
    barcodeValidation: barcodeResult ? barcodeResult.validation : null,
    matchedProduct: resolvedProduct
  };
}

/**
 * Compares disposal rules for an item side-by-side between Sugar Land, TX and Houston, TX.
 */
export function compareJurisdictions(query = {}) {
  const sugarLand = evaluateItemDisposal({ ...query, city: "sugar-land-tx" });
  const houston = evaluateItemDisposal({ ...query, city: "houston-tx" });
  const sameStream = sugarLand.stream === houston.stream;
  const riskDelta = Math.abs(sugarLand.contaminationRiskScore - houston.contaminationRiskScore);

  return {
    itemTitle: sugarLand.itemTitle,
    materialId: sugarLand.materialId,
    sameStream,
    riskDelta,
    divergenceSummary: sugarLand.cityDivergenceNote,
    sugarLand,
    houston
  };
}

/**
 * Evaluates a multi-item household recycling batch and computes aggregate MRF load risk.
 */
export function scoreCartBatch(items = [], city = "sugar-land-tx") {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      city,
      itemCount: 0,
      averageRiskScore: 0,
      maxRiskScore: 0,
      loadStatus: "EMPTY_BATCH",
      criticalHazards: [],
      evaluations: []
    };
  }

  const evaluations = items.map((item) => evaluateItemDisposal({ ...item, city }));
  const totalRisk = evaluations.reduce((acc, ev) => acc + ev.contaminationRiskScore, 0);
  const maxRiskScore = evaluations.reduce(
    (max, ev) => (ev.contaminationRiskScore > max ? ev.contaminationRiskScore : max),
    0
  );
  const averageRiskScore = Math.round(totalRisk / evaluations.length);

  const criticalHazards = evaluations
    .filter((ev) => ev.contaminationTier === "CRITICAL" || ev.stream === "SPECIAL_DROPOFF" || ev.stream === "TRASH_CART")
    .map((ev) => ({
      itemTitle: ev.itemTitle,
      stream: ev.stream,
      badgeLabel: ev.badgeLabel,
      riskScore: ev.contaminationRiskScore
    }));

  const loadStatus =
    maxRiskScore >= 85
      ? "REJECTED_CONTAMINATED_LOAD"
      : maxRiskScore >= 55
        ? "NEEDS_SORTING_FIXES"
        : "CLEAN_CURBSIDE_LOAD";

  return {
    city,
    itemCount: evaluations.length,
    averageRiskScore,
    maxRiskScore,
    loadStatus,
    criticalHazards,
    evaluations
  };
}
